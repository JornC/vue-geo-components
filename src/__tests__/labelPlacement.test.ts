import { Polygon } from "ol/geom.js";
import { describe, expect, it } from "vitest";

import { labelPoint } from "@/map/labelPlacement";

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

  it("Puts the point where there is most room, not merely inside", () => {
    const square = new Polygon([
      [
        [0, 0],
        [1000, 0],
        [1000, 1000],
        [0, 1000],
        [0, 0],
      ],
    ]);

    const [x, y] = labelPoint(square) as [number, number];

    // turf's own point-to-polygon distance reads these as degrees and ranks them wrongly, which put
    // the name of an empty square nearer its corner than its middle.
    expect(Math.hypot(x - 500, y - 500), "The middle of a square is where a name has most room").toBeLessThan(100);
  });

  it("Fills the holes in, so a broken one cannot cost the label", () => {
    // Tiles are quantised to their own grid, which flattens a small enough hole to two or three
    // points; turf will not read a ring that short. The Veluwe has 739 holes, so one arriving
    // broken used to leave the whole area unnamed.
    const nicked = new Polygon([
      [
        [0, 0],
        [1000, 0],
        [1000, 1000],
        [0, 1000],
        [0, 0],
      ],
      [
        [200, 200],
        [210, 200],
        [200, 200],
      ],
    ]);

    const [x, y] = labelPoint(nicked) as [number, number];

    expect(Math.hypot(x - 500, y - 500), "The holes are not part of the question").toBeLessThan(100);
  });
});
