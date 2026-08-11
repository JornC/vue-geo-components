import Feature from "ol/Feature.js";
import { Point, Polygon } from "ol/geom.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import { describe, expect, it, vi } from "vitest";

import { LABEL_SHAPE, placeLabels } from "@/map/labelPlacement";

function shape(id: string, rings: number[][][]): Feature {
  const feature = new Feature(new Polygon(rings));
  feature.set("code", id);
  return feature;
}

const square = [
  [
    [0, 0],
    [1000, 0],
    [1000, 1000],
    [0, 1000],
    [0, 0],
  ],
];

function setUp(rings: number[][][]) {
  const labels = new VectorLayer({ source: new VectorSource() });
  const label = new Feature(new Point([0, 0]));
  label.setId("1");
  labels.getSource()?.addFeature(label);

  const features = [shape("1", rings)];
  const getFeaturesInExtent = vi.fn(() => features);
  const shapes = { getFeaturesInExtent } as unknown as Parameters<typeof placeLabels>[0]["shapes"];

  return { labels, label, shapes, getFeaturesInExtent };
}

describe("Placing labels", () => {
  it("Places a name once and then leaves it alone", () => {
    const { labels, label, shapes } = setUp(square);
    const call = { labels, shapes, matchOn: "code", view: [0, 0, 1000, 1000] as [number, number, number, number] };

    placeLabels(call);
    const settled = [...(label.getGeometry() as Point).getCoordinates()];
    expect(settled, "The name moves onto its shape").not.toEqual([0, 0]);
    expect(label.get(LABEL_SHAPE), "And records what it stands on, so the style draws it").toBeDefined();
    const changed = vi.fn();
    label.on("change", changed);

    placeLabels(call);

    expect(changed, "A second pass over the same shape must write nothing, or the map redraws forever").not.toHaveBeenCalled();
    expect((label.getGeometry() as Point).getCoordinates(), "And the name stays put").toEqual(settled);
  });

  it("Drops a name whose shape has left the view", () => {
    const { labels, label, shapes } = setUp(square);
    placeLabels({ labels, shapes, matchOn: "code", view: [0, 0, 1000, 1000] });

    const empty = { getFeaturesInExtent: () => [] } as unknown as Parameters<typeof placeLabels>[0]["shapes"];
    placeLabels({ labels, shapes: empty, matchOn: "code", view: [0, 0, 1000, 1000] });

    expect(label.get(LABEL_SHAPE), "A name with no outline in view is not drawn").toBeUndefined();
  });
});
