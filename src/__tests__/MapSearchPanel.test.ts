import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

import MapSearchPanel from "@/components/MapSearchPanel.vue";
import type { SearchConfig, SearchResult } from "@/search/searchTypes";

const config: SearchConfig = {
  endpoint: "https://search.example.org",
  capabilities: ["RECEPTOR", "BASIC_INFO"],
  region: "nl",
};

const translator = {
  t: (key: string) => key,
  te: (key: string) => key.startsWith("map.search.type."),
};

function result(overrides: Partial<SearchResult>): SearchResult {
  return { complete: true, results: [], uuid: "u1", ...overrides };
}

describe("MapSearchPanel", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders the input with the placeholder from the translator", () => {
    const wrapper = mount(MapSearchPanel, { props: { config, translator } });
    const input = wrapper.get('[data-id="map-search-input"]');
    expect(input.attributes("placeholder")).toBe("map.search.placeholder");
  });

  it("shows a clear cross once something is typed and clears on click", async () => {
    const wrapper = mount(MapSearchPanel, { props: { config, translator } });
    const input = wrapper.get('[data-id="map-search-input"]');

    await input.setValue("ab");
    expect(wrapper.find('[data-id="map-search-clear"]').exists()).toBe(true);

    await wrapper.get('[data-id="map-search-clear"]').trigger("click");
    await nextTick();
    expect((wrapper.get('[data-id="map-search-input"]').element as HTMLInputElement).value).toBe("");
    expect(wrapper.find('[data-id="map-search-clear"]').exists()).toBe(false);
  });

  it("renders grouped results with bolded matches and emits select", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        result({
          results: [
            { id: "r1", type: "RECEPTOR", description: "100000123", score: 1 },
            { id: "a1", type: "ADDRESS", description: "Kerkstraat 10", score: 0.8 },
          ],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(MapSearchPanel, { props: { config, translator } });
    await wrapper.get('[data-id="map-search-input"]').setValue("100");
    await vi.advanceTimersByTimeAsync(500);

    const resultButton = wrapper.get('[data-id="map-search-result-r1"]');
    expect(resultButton.get("b").text()).toBe("100");
    expect(resultButton.attributes("aria-label")).toBe("map.search.type.RECEPTOR result 1: 100000123");
    expect(wrapper.text()).toContain("map.search.type.RECEPTOR");
    expect(wrapper.find('[role="tree"]').exists(), "search results should not claim tree behavior").toBe(false);
    expect(wrapper.get("ul").findAll("li"), "suggestions should use native list semantics").toHaveLength(1);
    expect(wrapper.get('[role="status"]').attributes("aria-live"), "result changes should be announced politely").toBe("polite");

    await resultButton.trigger("click");
    expect(wrapper.emitted("select")).toEqual([[{ id: "r1", type: "RECEPTOR", description: "100000123", score: 1 }]]);
    vi.unstubAllGlobals();
  });

  it("shows the no-results message when a completed search finds nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => result({ results: [] }) }));

    const wrapper = mount(MapSearchPanel, { props: { config, translator } });
    await wrapper.get('[data-id="map-search-input"]').setValue("zzz");
    await vi.advanceTimersByTimeAsync(500);

    expect(wrapper.get('[data-id="map-search-no-results"]').text()).toContain("map.search.noResults.title");
    expect(wrapper.findAll('[data-id^="map-search-result-"]')).toHaveLength(0);
    vi.unstubAllGlobals();
  });

  it("shows an error message when the search service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("search service unavailable")));

    const wrapper = mount(MapSearchPanel, { props: { config, translator } });
    await wrapper.get('[data-id="map-search-input"]').setValue("100000123");
    await vi.advanceTimersByTimeAsync(500);

    expect(wrapper.get('[data-id="map-search-error"]').text()).toContain("map.search.error");
    expect(wrapper.find('[data-id="map-search-no-results"]').exists()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("keeps the markup balanced when multiple query terms overlap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => result({ results: [{ id: "r1", type: "RECEPTOR", description: "B", score: 1 }] }),
      }),
    );

    const wrapper = mount(MapSearchPanel, { props: { config, translator } });
    await wrapper.get('[data-id="map-search-input"]').setValue("b b");
    await vi.advanceTimersByTimeAsync(500);

    const highlightedParts = wrapper.get('[data-id="map-search-result-r1"]').findAll("b");
    expect(highlightedParts).toHaveLength(1);
    expect(highlightedParts[0]?.text()).toBe("B");
    vi.unstubAllGlobals();
  });

  it("renders search-result descriptions as text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => result({ results: [{ id: "r1", type: "RECEPTOR", description: "<script>", score: 1 }] }),
      }),
    );

    const wrapper = mount(MapSearchPanel, { props: { config, translator } });
    await wrapper.get('[data-id="map-search-input"]').setValue("script");
    await vi.advanceTimersByTimeAsync(500);

    const resultButton = wrapper.get('[data-id="map-search-result-r1"]');
    expect(resultButton.find("script").exists()).toBe(false);
    expect(resultButton.text()).toBe("<script>");
    vi.unstubAllGlobals();
  });
});
