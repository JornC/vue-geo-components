import { describe, expect, it, vi } from "vitest";

import { createSearchService } from "@/search/searchService";
import type { SearchConfig, SearchResult } from "@/search/searchTypes";

const config: SearchConfig = {
  endpoint: "https://search.example.org",
  capabilities: ["RECEPTOR", "ASSESSMENT_AREA", "BASIC_INFO"],
  region: "nl",
};

describe("createSearchService", () => {
  it("calls the async endpoint with query, capabilities and region", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ complete: true, results: [], uuid: "u1" }) satisfies SearchResult,
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createSearchService(config);
    await service.startSearchQuery("100000123");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url.startsWith(`${config.endpoint}/search-async?`)).toBe(true);
    expect(url).toContain("query=100000123");
    expect(url).toContain("capabilities=RECEPTOR,ASSESSMENT_AREA,BASIC_INFO");
    expect(url).toContain("region=nl");
    vi.unstubAllGlobals();
  });

  it("scrubs backslashes from the query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ complete: true, results: [], uuid: "u1" }) satisfies SearchResult,
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createSearchService(config);
    await service.startSearchQuery("a\\b");

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("query=ab");
    vi.unstubAllGlobals();
  });

  it("polls the uuid endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ complete: true, results: [], uuid: "u1" }) satisfies SearchResult,
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createSearchService(config);
    await service.retrieveResults("u1");

    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(`${config.endpoint}/results/u1`);
    vi.unstubAllGlobals();
  });

  it("throws when the service responds with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "Unavailable" }));

    const service = createSearchService(config);
    await expect(service.startSearchQuery("x")).rejects.toThrow(/503/);
    vi.unstubAllGlobals();
  });

  it("uses the configured fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ complete: true, results: [], uuid: "u1" }) satisfies SearchResult,
    });
    const service = createSearchService({ ...config, fetcher });

    await service.startSearchQuery("configured");

    expect(fetcher, "the configured HTTP pipeline should receive the request").toHaveBeenCalledOnce();
  });

  it("passes the abort signal to the fetcher", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ complete: true, results: [], uuid: "u1" }) satisfies SearchResult,
    });
    const controller = new AbortController();
    const service = createSearchService({ ...config, fetcher });

    await service.startSearchQuery("abortable", controller.signal);

    expect(fetcher.mock.calls[0]?.[1]?.signal, "the request should use the search abort signal").toBe(controller.signal);
  });

  it("rejects an invalid response envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }));
    const service = createSearchService(config);

    await expect(service.startSearchQuery("invalid"), "invalid service responses should fail at the boundary").rejects.toThrow(
      /invalid result envelope/,
    );
    vi.unstubAllGlobals();
  });

  it("rejects an invalid suggestion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ complete: true, results: [{ id: "missing-fields" }], uuid: "u1" }),
      }),
    );
    const service = createSearchService(config);

    await expect(service.startSearchQuery("invalid"), "invalid suggestions should not reach the UI").rejects.toThrow(/invalid suggestion at index 0/);
    vi.unstubAllGlobals();
  });

  it.each(["centroid", "geometry", "bbox"] as const)("accepts null for the optional %s field", async (field) => {
    const suggestion: Record<string, unknown> = {
      id: "s1",
      type: "CITY",
      description: "Amsterdam",
      score: 8.7,
      centroid: "POINT(1 2)",
      geometry: "MULTIPOLYGON(((0 0,1 0,1 1,0 1,0 0)))",
      bbox: "BOX(0 0,1 1)",
    };
    suggestion[field] = null;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ complete: true, uuid: "u1", results: [suggestion] }),
      }),
    );
    const service = createSearchService(config);

    const result = await service.startSearchQuery("amsterdam");

    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.id, "the suggestion should round-trip").toBe("s1");
    expect(result.results[0]?.[field], `a null ${field} should parse as absent`).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
