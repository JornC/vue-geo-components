import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon as turfPolygon } from "@turf/helpers";
import pointToPolygonDistance from "@turf/point-to-polygon-distance";
import simplify from "@turf/simplify";
import type { Coordinate } from "ol/coordinate.js";
import type Polygon from "ol/geom/Polygon.js";

/**
 * Where to write a name so that it sits in the open, inside the shape it names.
 *
 * A centroid will not do: the centroid of a crescent, a river system or a ring of lakes falls
 * outside the shape it belongs to, and a name drawn there labels whatever it lands on. What is
 * wanted is the point furthest from any edge - the middle of the widest open part - which is both
 * inside by definition and the roomiest place to put words. GeoServer picks its labels on the same
 * principle, which is why calculator's names sit where they do.
 *
 * Candidates are laid out on a grid and the one with the most room around it wins. The grid is
 * plain arithmetic; both geometric questions - is this inside, and how far from the edge - are
 * turf's to answer.
 */

/**
 * Candidates per axis. Coarser is quicker but picks the wrong part of a shape with several open
 * areas: at eight the Veluwe's name moved five kilometres, into a different stretch of forest.
 */
const CANDIDATES_PER_AXIS = 12;

/**
 * How much of the shape's own size counts as detail worth dropping first.
 *
 * A nature area can arrive with tens of thousands of points, and every candidate is weighed against
 * every edge, so the detail is what makes this slow. None of it moves the answer: at a two-thousandth
 * of the shape's width the point shifts by a few metres, which is a fraction of a pixel at any zoom
 * where a name is drawn.
 */
const DETAIL_TO_DROP = 1 / 2000;

type Best = { at: Coordinate; room: number };

function roomiest(outline: ReturnType<typeof turfPolygon>, within: number[], perAxis: number): Best | undefined {
  const [minX, minY, maxX, maxY] = within as [number, number, number, number];
  let best: Best | undefined;

  for (let column = 1; column <= perAxis; column++) {
    for (let row = 1; row <= perAxis; row++) {
      const at: Coordinate = [minX + ((maxX - minX) * column) / (perAxis + 1), minY + ((maxY - minY) * row) / (perAxis + 1)];
      const candidate = point(at);

      if (!booleanPointInPolygon(candidate, outline)) {
        continue;
      }

      // Planar, because these are projected metres rather than degrees. The distance is only ever
      // compared against another from the same shape, so its unit does not matter.
      const room = Math.abs(pointToPolygonDistance(candidate, outline, { method: "planar" }));

      if (best === undefined || room > best.room) {
        best = { at, room };
      }
    }
  }

  return best;
}

export function labelPoint(shape: Polygon): Coordinate | undefined {
  const rings = shape.getCoordinates();

  // Nothing to name, and turf counts a point on the edge as inside, so a flat shape would otherwise
  // come back with a point sitting on the line itself.
  if (shape.getArea() <= 0) {
    return undefined;
  }

  // turf will not read a ring of fewer than four positions. Refusing it here keeps the throw out of
  // a pass that runs while the map is drawing.
  if (rings.some((ring) => ring.length < 4)) {
    return undefined;
  }

  const [minX, minY, maxX, maxY] = shape.getExtent() as [number, number, number, number];
  const span = Math.max(maxX - minX, maxY - minY);
  const outline = simplify(turfPolygon(rings), { tolerance: span * DETAIL_TO_DROP, highQuality: false });

  return roomiest(outline, [minX, minY, maxX, maxY], CANDIDATES_PER_AXIS)?.at;
}
