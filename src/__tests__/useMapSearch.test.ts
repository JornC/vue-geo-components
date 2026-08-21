import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMapSearch } from "@/search/useMapSearch";
import type { SearchService } from "@/search/searchService";
import type { SearchResult, SearchSuggestion } from "@/search/searchTypes";

const CUSTOM_SEARCH_TIMEOUT_MILLISECONDS = 1_000;

function suggestion(overrides: Partial<SearchSuggestion>): SearchSuggestion {
  return { id: "1", type: "RECEPTOR", description: "100000123", score: 1, ...overrides };
}

function result(overrides: Partial<SearchResult>): SearchResult {
  return { complete: false, results: [], uuid: "u1", ...overrides };
}

describe("useMapSearch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("debounces typing and starts a search after 500ms", async () => {
    const service = {
      startSearchQuery: vi.fn().mockResolvedValue(result({ complete: true })),
      retrieveResults: vi.fn(),
    } as unknown as SearchService;
    const search = useMapSearch(service);

    search.query.value = "ab";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect(service.startSearchQuery).toHaveBeenCalledTimes(1);
    expect(service.startSearchQuery).toHaveBeenCalledWith("ab", expect.any(AbortSignal));
  });

  it("does not start a search for an empty query", async () => {
    const service = {
      startSearchQuery: vi.fn().mockResolvedValue(result({ complete: true })),
      retrieveResults: vi.fn(),
    } as unknown as SearchService;
    const search = useMapSearch(service);

    search.query.value = "   ";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect(service.startSearchQuery).not.toHaveBeenCalled();
    expect(search.noResults.value).toBe(false);
  });

  it("keeps polling until the result is complete", async () => {
    const service = {
      startSearchQuery: vi.fn().mockResolvedValue(result({ complete: false, results: [suggestion({ description: "partial" })] })),
      retrieveResults: vi
        .fn()
        .mockResolvedValueOnce(result({ complete: false }))
        .mockResolvedValueOnce(result({ complete: true, results: [suggestion({ description: "final" })] })),
    } as unknown as SearchService;
    const search = useMapSearch(service);

    search.query.value = "100000123";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    // Partial results render immediately.
    expect([...(search.groupedResults.value.get("RECEPTOR") ?? [])].map((s) => s.description)).toEqual(["partial"]);

    await vi.advanceTimersByTimeAsync(250);
    expect(search.searching.value).toBe(true); // still incomplete, keeps polling
    await vi.advanceTimersByTimeAsync(250);

    expect(service.retrieveResults).toHaveBeenCalledTimes(2);
    expect([...(search.groupedResults.value.get("RECEPTOR") ?? [])].map((s) => s.description)).toEqual(["final"]);
    expect(search.searching.value).toBe(false);
  });

  it("groups results by type and sorts by score descending", async () => {
    const service = {
      startSearchQuery: vi.fn().mockResolvedValue(
        result({
          complete: true,
          results: [
            suggestion({ id: "a", type: "ADDRESS", description: "Street 1", score: 0.5 }),
            suggestion({ id: "b", type: "RECEPTOR", description: "100000123", score: 1 }),
            suggestion({ id: "c", type: "ADDRESS", description: "Street 2", score: 0.8 }),
          ],
        }),
      ),
      retrieveResults: vi.fn(),
    } as unknown as SearchService;
    const search = useMapSearch(service);

    search.query.value = "street";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect([...search.groupedResults.value.keys()]).toEqual(["ADDRESS", "RECEPTOR"]);
    const addresses = search.groupedResults.value.get("ADDRESS") ?? [];
    expect(addresses.map((s) => s.description)).toEqual(["Street 2", "Street 1"]);
  });

  it("reports noResults for a completed search without matches", async () => {
    const service = {
      startSearchQuery: vi.fn().mockResolvedValue(result({ complete: true, results: [] })),
      retrieveResults: vi.fn(),
    } as unknown as SearchService;
    const search = useMapSearch(service);

    search.query.value = "zzz";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect(search.noResults.value).toBe(true);
    expect(search.hasQuery.value).toBe(true);
  });

  it("marks the search as failed when startSearchQuery rejects", async () => {
    const service = {
      startSearchQuery: vi.fn().mockRejectedValue(new Error("search service unavailable")),
      retrieveResults: vi.fn(),
    } as unknown as SearchService;
    const search = useMapSearch(service);

    search.query.value = "100000123";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect(search.error.value).toBe(true);
    expect(search.searching.value).toBe(false);
    expect(search.noResults.value).toBe(false);
  });

  it("clears the error flag when a new query is accepted", async () => {
    const service = {
      startSearchQuery: vi
        .fn()
        .mockRejectedValueOnce(new Error("search service unavailable"))
        .mockResolvedValueOnce(result({ complete: true, results: [suggestion({ description: "found" })] })),
      retrieveResults: vi.fn(),
    } as unknown as SearchService;
    const search = useMapSearch(service);

    search.query.value = "100000123";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);
    expect(search.error.value).toBe(true);

    search.query.value = "200000456";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    expect(search.error.value).toBe(false);
    expect(search.noResults.value).toBe(false);
  });

  it("discards results from a superseded query", async () => {
    let resolveFirst: (value: SearchResult) => void;
    const first = new Promise<SearchResult>((resolve) => {
      resolveFirst = resolve;
    });
    const service = {
      startSearchQuery: vi
        .fn()
        .mockReturnValueOnce(first)
        .mockResolvedValueOnce(result({ complete: true, results: [suggestion({ id: "new", description: "new" })] })),
      retrieveResults: vi.fn(),
    } as unknown as SearchService;
    const search = useMapSearch(service);

    search.query.value = "old";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    search.query.value = "new";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    resolveFirst!(result({ complete: true, results: [suggestion({ id: "old", description: "stale" })] }));
    await nextTick();

    // The stale response must not overwrite the newer results.
    expect([...(search.groupedResults.value.get("RECEPTOR") ?? [])].map((s) => s.description)).toEqual(["new"]);
  });

  it("clear resets the query and results", async () => {
    const service = {
      startSearchQuery: vi.fn().mockResolvedValue(result({ complete: true, results: [suggestion({})] })),
      retrieveResults: vi.fn(),
    } as unknown as SearchService;
    const search = useMapSearch(service);

    search.query.value = "100000123";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);

    search.clear();
    expect(search.query.value).toBe("");
    expect(search.hasQuery.value).toBe(false);
    expect(search.groupedResults.value.size).toBe(0);
    expect(search.searching.value).toBe(false);
  });

  it("aborts a request when the query changes", async () => {
    const startSearchQuery = vi.fn().mockReturnValue(new Promise<SearchResult>(() => undefined));
    const service = {
      startSearchQuery,
      retrieveResults: vi.fn(),
    } as unknown as SearchService;
    const search = useMapSearch(service);

    search.query.value = "old";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500);
    const signal = startSearchQuery.mock.calls[0]?.[1] as AbortSignal;

    search.query.value = "new";
    await nextTick();

    expect(signal.aborted, "superseded HTTP requests should be aborted").toBe(true);
  });

  it("stops a search after the polling budget", async () => {
    const service = {
      startSearchQuery: vi.fn().mockResolvedValue(result({ results: [suggestion({ description: "partial" })] })),
      retrieveResults: vi.fn().mockImplementation(
        (_uuid: string, signal: AbortSignal) =>
          new Promise<SearchResult>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
          }),
      ),
    } as unknown as SearchService;
    const search = useMapSearch(service, { timeoutMilliseconds: CUSTOM_SEARCH_TIMEOUT_MILLISECONDS });

    search.query.value = "never completes";
    await nextTick();
    await vi.advanceTimersByTimeAsync(500 + CUSTOM_SEARCH_TIMEOUT_MILLISECONDS);

    expect(search.searching.value, "an expired search should stop polling").toBe(false);
    expect(search.error.value, "an expired search should expose the failure state").toBe(true);
    expect(search.groupedResults.value.get("RECEPTOR")?.[0]?.description, "an expired search should preserve partial suggestions").toBe("partial");
  });

  it("rejects an invalid polling budget", () => {
    const service = {
      startSearchQuery: vi.fn(),
      retrieveResults: vi.fn(),
    } as unknown as SearchService;

    expect(() => useMapSearch(service, { timeoutMilliseconds: 0 }), "a non-positive timeout should fail before searching").toThrow(/positive number/);
  });
});
