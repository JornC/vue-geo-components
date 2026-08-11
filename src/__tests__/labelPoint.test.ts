import { Polygon } from "ol/geom.js";
import { describe, expect, it } from "vitest";

import { labelPoint } from "@/map/labelPoint";

/** True when the point is inside the shape, which is the whole promise of this function. */
function inside(polygon: Polygon, point: [number, number] | undefined): boolean {
  return point !== undefined && polygon.intersectsCoordinate(point);
}

describe("Label point", () => {
  it("Puts the point inside a plain square", () => {
    const square = new Polygon([
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ]);

    const point = labelPoint(square);

    expect(inside(square, point as [number, number]), "A point in a square should be in the square").toBe(true);
  });

  it("Stays inside a crescent, where the centroid does not", () => {
    // A C shape: the middle of it is the gap, so its average sits outside the shape entirely.
    const crescent = new Polygon([
      [
        [0, 0],
        [10, 0],
        [10, 3],
        [3, 3],
        [3, 7],
        [10, 7],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ]);

    const point = labelPoint(crescent);
    const centroid = crescent.getInteriorPoint().getCoordinates();

    expect(inside(crescent, point as [number, number]), "This is the Rijntakken case in miniature").toBe(true);
    expect(centroid, "Sanity: the shape is one whose average is worth avoiding").toBeDefined();
  });

  it("Avoids a hole in the middle", () => {
    const ringed = new Polygon([
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      [
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7],
        [3, 3],
      ],
    ]);

    const point = labelPoint(ringed);

    expect(inside(ringed, point as [number, number]), "The hole is not part of the shape").toBe(true);
  });

  it("Picks the wider arm of a shape that has two", () => {
    // A wide arm on the left, a narrow one on the right; the name belongs on the wide one.
    const arms = new Polygon([
      [
        [0, 0],
        [6, 0],
        [6, 4],
        [9, 4],
        [9, 5],
        [6, 5],
        [6, 10],
        [0, 10],
        [0, 0],
      ],
    ]);

    const point = labelPoint(arms);

    expect(point?.[0], "The wide arm runs from 0 to 6, so its middle is 3").toBeLessThan(6);
    expect(inside(arms, point as [number, number]), "And it should still be inside").toBe(true);
  });

  it("Gives nothing for a shape with no area", () => {
    const sliver = new Polygon([
      [
        [0, 0],
        [5, 0],
        [10, 0],
        [0, 0],
      ],
    ]);

    expect(labelPoint(sliver), "A flat sliver has no inside to put a name in").toBeUndefined();
  });
});
