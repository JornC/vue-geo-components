import Map from "ol/Map.js";
import View from "ol/View.js";
import { WKT } from "ol/format.js";
import Point from "ol/geom/Point.js";
import VectorLayer from "ol/layer/Vector.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applySearchSuggestion } from "@/search/searchActions";
import type { SearchSuggestion } from "@/search/searchTypes";

// Make flyTo jump instead of animating: jsdom has no reliable rAF.
function reducedMotion() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  });
}

function suggestion(overrides: Partial<SearchSuggestion>): SearchSuggestion {
  return { id: "1", type: "RECEPTOR", description: "100000123", score: 1, ...overrides };
}

function wktPoint(x: number, y: number): string {
  return new WKT().writeGeometry(new Point([x, y]));
}

describe("applySearchSuggestion", () => {
  let map: Map;

  beforeEach(() => {
    reducedMotion();
    map = new Map({
      target: undefined,
      layers: [],
      view: new View({ center: [155000, 463000], zoom: 3, minZoom: 0, maxZoom: 14 }),
    });
    map.setSize([1000, 800]);
  });

  afterEach(() => {
    map.setTarget(undefined);
    map.dispose();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("flies to a receptor and highlights it with the selected-receptor layer", () => {
    const center = [149988.14433676028, 459973.44414740487] as const;
    const mapSpy = vi.spyOn(map, "addLayer");

    applySearchSuggestion(map, suggestion({ type: "RECEPTOR", centroid: wktPoint(center[0], center[1]) }));

    expect(mapSpy).toHaveBeenCalled();
    const view = map.getView();
    expect(view.getCenter()![0]).toBeCloseTo(center[0], 0);
    expect(view.getCenter()![1]).toBeCloseTo(center[1], 0);
    // The added layer is the selected-receptor layer (hexagon + crosshair).
    const layer = map.getLayers().item(map.getLayers().getLength() - 1) as VectorLayer;
    expect(layer.getSource()!.getFeatures().length).toBeGreaterThan(0);
  });

  it("zooms to the extent for a nature area and marks its centroid", () => {
    const centroid = wktPoint(150000, 460000);
    const bbox = new WKT().readGeometry("POLYGON((146000 456000, 154000 456000, 154000 464000, 146000 464000, 146000 456000))");
    const mapSpy = vi.spyOn(map, "addLayer");

    applySearchSuggestion(
      map,
      suggestion({
        type: "ASSESSMENT_AREA",
        centroid,
        bbox: new WKT().writeGeometry(bbox),
      }),
    );

    expect(mapSpy).toHaveBeenCalled();
    const layer = map.getLayers().item(map.getLayers().getLength() - 1) as VectorLayer;
    expect(layer.getSource()!.getFeatures().length).toBe(1);
    // The view must have moved (zoomed out to fit the extent).
    expect(map.getView().getZoom()).toBeLessThan(14);
  });

  it("ignores a suggestion whose geometries cannot be read", () => {
    const mapSpy = vi.spyOn(map, "addLayer");
    const warningSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    applySearchSuggestion(map, suggestion({ centroid: "not wkt" }));

    expect(mapSpy).not.toHaveBeenCalled();
    expect(warningSpy, "the malformed suggestion should be identifiable in logs").toHaveBeenCalledWith(
      expect.stringContaining("Search suggestion 1"),
      expect.anything(),
    );
  });

  it("replaces the previous search-result layer on repeated selections", () => {
    applySearchSuggestion(map, suggestion({ type: "RECEPTOR", centroid: wktPoint(150000, 460000) }));
    const layerCountAfterFirst = map.getLayers().getLength();

    applySearchSuggestion(map, suggestion({ type: "ADDRESS", centroid: wktPoint(152000, 462000) }));

    expect(map.getLayers().getLength()).toBe(layerCountAfterFirst);
  });

  it("cancels an active flight before starting another", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
    vi.stubGlobal("requestAnimationFrame", vi.fn().mockReturnValueOnce(101).mockReturnValueOnce(102));
    const cancelFrame = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);

    applySearchSuggestion(map, suggestion({ centroid: wktPoint(150000, 460000) }));
    applySearchSuggestion(map, suggestion({ centroid: wktPoint(160000, 470000) }));

    expect(cancelFrame, "a new selection should stop the previous map flight").toHaveBeenCalledWith(101);
  });

  it("returns to an extent after a receptor flight", () => {
    const extent = "POLYGON((146000 456000, 154000 456000, 154000 464000, 146000 464000, 146000 456000))";
    const area = suggestion({ type: "ASSESSMENT_AREA", bbox: extent });

    applySearchSuggestion(map, area);
    applySearchSuggestion(map, suggestion({ centroid: wktPoint(160000, 470000) }));
    applySearchSuggestion(map, area);

    expect(map.getView().getCenter(), "the repeated extent should not be suppressed after another flight").toEqual([150000, 460000]);
  });
});
