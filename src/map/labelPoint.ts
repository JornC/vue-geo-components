import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon as turfPolygon } from "@turf/helpers";
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
 * Candidates are laid out on a grid and the one with the most room around it wins. turf answers
 * whether a candidate is inside and does the simplifying; how far it sits from the nearest edge is
 * worked out here, because turf's answer to that is wrong on a projected grid. See below.
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

/**
 * Holes narrower than this, in projected metres, are left out of the search.
 *
 * Simplifying cannot touch them: a ring needs four points to stay a ring, so a shape riddled with
 * small holes has a floor no tolerance gets under. The Veluwe is one outer ring and 739 holes -
 * villages, farms and roads inside the forest - and however coarse the tolerance, 736 of them sit at
 * that floor. That is most of the work, for holes under a pixel at the zooms a name is drawn at.
 *
 * No larger than this: on a river system the holes are the shape, and dropping 250 metre ones moves
 * Rijntakken's name the better part of a kilometre.
 */
const HOLE_TOO_SMALL_TO_MATTER = 100;

type Best = { at: Coordinate; room: number };

/**
 * How far a point is from the nearest edge, in the units the coordinates are in.
 *
 * turf cannot answer this one. Its point-to-polygon distance reads coordinates as degrees of
 * longitude and latitude and converts the result to a length, so on a projected grid such as RD it
 * wraps the globe several times over and returns numbers that do not even rank correctly: in a
 * square kilometre it scores a point 77 metres from the edge above one 250 metres from it. Its
 * planar option only changes how a line is measured, not what the coordinates are taken to be.
 */
function distanceToNearestEdge(at: Coordinate, rings: Coordinate[][]): number {
  const [x, y] = at as [number, number];
  let nearest = Number.POSITIVE_INFINITY;

  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const [x1, y1] = ring[i] as [number, number];
      const [x2, y2] = ring[i + 1] as [number, number];
      const runX = x2 - x1;
      const runY = y2 - y1;
      const lengthSquared = runX * runX + runY * runY;

      // How far along the edge the closest point lies, clamped to the edge itself.
      const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * runX + (y - y1) * runY) / lengthSquared));
      const toX = x - (x1 + along * runX);
      const toY = y - (y1 + along * runY);

      nearest = Math.min(nearest, Math.hypot(toX, toY));
    }
  }

  return nearest;
}

/** The width or height of a ring, whichever is greater. */
function across(ring: Coordinate[]): number {
  const xs = ring.map((position) => position[0] as number);
  const ys = ring.map((position) => position[1] as number);

  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function roomiest(outline: ReturnType<typeof turfPolygon>, within: number[], perAxis: number): Best | undefined {
  const rings = outline.geometry.coordinates as Coordinate[][];
  const [minX, minY, maxX, maxY] = within as [number, number, number, number];
  let best: Best | undefined;

  for (let column = 1; column <= perAxis; column++) {
    for (let row = 1; row <= perAxis; row++) {
      const at: Coordinate = [minX + ((maxX - minX) * column) / (perAxis + 1), minY + ((maxY - minY) * row) / (perAxis + 1)];
      const candidate = point(at);

      if (!booleanPointInPolygon(candidate, outline)) {
        continue;
      }

      const room = distanceToNearestEdge(at, rings);

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
  const worthKeeping = [rings[0] as Coordinate[], ...rings.slice(1).filter((hole) => across(hole) >= HOLE_TOO_SMALL_TO_MATTER)];
  const outline = simplify(turfPolygon(worthKeeping), { tolerance: span * DETAIL_TO_DROP, highQuality: false });

  return roomiest(outline, [minX, minY, maxX, maxY], CANDIDATES_PER_AXIS)?.at;
}
