import { Polygon } from "ol/geom.js";
import { describe, expect, it } from "vitest";

import { labelPoint } from "@/map/labelPlacement";

function inside(polygon: Polygon, point: [number, number] | undefined): boolean {
  return point !== undefined && polygon.intersectsCoordinate(point);
}

describe("Label point", () => {
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

    // Getting this wrong once put the name of an empty square nearer its
    // corner than its middle.
    expect(Math.hypot(x - 500, y - 500), "The middle of a square is where a name has most room").toBeLessThan(100);
  });

  it("Fills the holes in, so a broken one cannot cost the label", () => {
    // Tiles are quantised to their own grid, which flattens a small enough hole to two or three
    // points, which cannot be read as a ring. The Veluwe has 739 holes, so one arriving
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
