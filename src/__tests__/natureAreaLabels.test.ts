import Feature from "ol/Feature.js";
import { Point, Polygon } from "ol/geom.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import { describe, expect, it, vi } from "vitest";

import { createNatureAreaLabels } from "@/layers/fameNatureAreas";
import { LABEL_SHAPE } from "@/map/labelPlacement";
import { NATURE_AREA_NAME } from "@/layers/natureAreas";

const square = [
  [
    [0, 0],
    [20000, 0],
    [20000, 20000],
    [0, 20000],
    [0, 0],
  ],
];

/** Enough of a map for the names to be placed once: a view, a size, and something to redraw on. */
function fakeMap() {
  const listeners: Array<() => void> = [];
  return {
    // Only what a finished redraw fires, so a name hung on any other event never gets placed here.
    on: (event: string, listener: () => void) => event === "rendercomplete" && listeners.push(listener),
    getView: () => ({ getResolution: () => 10, calculateExtent: () => [0, 0, 20000, 20000] }),
    getSize: () => [800, 800],
    redraw: () => listeners.forEach((listener) => listener()),
  };
}

function outline(areaCode: string) {
  const feature = new Feature(new Polygon(square));
  feature.set("natura2000_area_code", areaCode);
  return feature;
}

describe("Naming the areas a product draws itself", () => {
  it("Refuses to place names that are not on the map yet", () => {
    const names = createNatureAreaLabels({ name: "Names" });

    expect(() => names.ready(fakeMap() as never, {} as never), "Silently doing nothing here would look like the data is missing").toThrow();
  });

  it("Stands a name on the outline carrying its id", () => {
    const names = createNatureAreaLabels({ name: "Names" });
    const layer = new VectorLayer({ source: new VectorSource() });
    names.layer.layerRef = layer as never;

    const label = new Feature(new Point([0, 0]));
    label.setId("42");
    label.set(NATURE_AREA_NAME, "Veluwe");
    layer.getSource()?.addFeature(label);

    const map = fakeMap();
    names.ready(map as never, { getFeaturesInExtent: vi.fn(() => [outline("42")]) } as never);
    map.redraw();

    expect(label.get(LABEL_SHAPE), "Without this the style draws nothing").toBeDefined();
    expect((label.getGeometry() as Point).getCoordinates(), "The name moves onto the outline").not.toEqual([0, 0]);
  });
});
