import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon as turfPolygon } from "@turf/helpers";
import pointToPolygonDistance from "@turf/point-to-polygon-distance";
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

/** Candidates per axis. Finer finds a slightly better spot for a lot more work. */
const CANDIDATES_PER_AXIS = 12;

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

  const outline = turfPolygon(rings);
  const extent = shape.getExtent();
  const minX = extent[0];
  const minY = extent[1];
  const maxX = extent[2];
  const maxY = extent[3];

  if (minX === undefined || minY === undefined || maxX === undefined || maxY === undefined) {
    return undefined;
  }

  let best: { at: Coordinate; room: number } | undefined;

  for (let column = 1; column <= CANDIDATES_PER_AXIS; column++) {
    for (let row = 1; row <= CANDIDATES_PER_AXIS; row++) {
      const at: Coordinate = [minX + ((maxX - minX) * column) / (CANDIDATES_PER_AXIS + 1), minY + ((maxY - minY) * row) / (CANDIDATES_PER_AXIS + 1)];
      const candidate = point(at);

      if (!booleanPointInPolygon(candidate, outline)) {
        continue;
      }

      // Planar, because these are RD metres rather than degrees. The distance is only ever compared
      // against another from the same call, so whatever the unit works out as does not matter.
      const room = Math.abs(pointToPolygonDistance(candidate, outline, { method: "planar" }));

      if (best === undefined || room > best.room) {
        best = { at, room };
      }
    }
  }

  return best?.at;
}
