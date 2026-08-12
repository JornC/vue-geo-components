import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import Polygon from "ol/geom/Polygon.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorTileLayer from "ol/layer/VectorTile.js";
import VectorSource from "ol/source/Vector.js";
import VectorTileSource from "ol/source/VectorTile.js";
import { describe, expect, it } from "vitest";

import { nearestFeatureHover } from "@/layers/hover";

function pointLayer(...coordinates: number[][]): VectorLayer {
  const features = coordinates.map((at, index) => {
    const feature = new Feature(new Point(at));
    feature.setId(`p${index}`);
    return feature;
  });
  return new VectorLayer({ source: new VectorSource({ features }) });
}

describe("nearestFeatureHover", () => {
  const hover = nearestFeatureHover({ radiusPx: 8 });

  it("claims a point inside the radius", () => {
    const layer = pointLayer([100, 100]);

    // 5 map units away, radius reaches 8.
    const feature = hover({ layer, coordinate: [105, 100], resolution: 1 });

    expect(feature?.getId()).toBe("p0");
  });

  it("leaves a point outside the radius alone", () => {
    const layer = pointLayer([100, 100]);

    const feature = hover({ layer, coordinate: [120, 100], resolution: 1 });

    expect(feature).toBeUndefined();
  });

  it("measures the radius in pixels, so zooming out widens its reach in map units", () => {
    const layer = pointLayer([100, 100]);
    const coordinate = [140, 100];

    expect(hover({ layer, coordinate, resolution: 1 })).toBeUndefined();
    expect(hover({ layer, coordinate, resolution: 10 })?.getId()).toBe("p0");
  });

  it("picks the closer of two points", () => {
    const layer = pointLayer([100, 100], [104, 100]);

    const feature = hover({ layer, coordinate: [103, 100], resolution: 1 });

    expect(feature?.getId()).toBe("p1");
  });

  it("cannot answer for a vector tile layer, which has no feature index", () => {
    const layer = new VectorTileLayer({ source: new VectorTileSource({}) });

    const feature = hover({ layer, coordinate: [100, 100], resolution: 1 });

    expect(feature).toBeUndefined();
  });

  it("measures a shape from its edge, which is why shapes are left to hit detection", () => {
    const square = new Feature(
      new Polygon([
        [
          [0, 0],
          [1000, 0],
          [1000, 1000],
          [0, 1000],
          [0, 0],
        ],
      ]),
    );
    const layer = new VectorLayer({ source: new VectorSource({ features: [square] }) });

    // Dead centre of the shape, and still too far from any edge to be claimed.
    expect(hover({ layer, coordinate: [500, 500], resolution: 1 })).toBeUndefined();
  });
});
