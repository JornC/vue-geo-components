import Feature from "ol/Feature.js";
import type { Coordinate } from "ol/coordinate.js";
import Polygon from "ol/geom/Polygon.js";

/**
 * The AERIUS receptor grid: a fixed hexagonal lattice anchored to RD
 * (EPSG:28992), in which every hexagon has a stable numeric id.
 *
 * The lattice is shared by every AERIUS product, so these constants and the
 * arithmetic below must stay identical everywhere - two products that disagree
 * about where receptor 1234 is would disagree about where their data belongs.
 * Treat this module as a specification, not as code to tune.
 *
 * Zoom levels are the grid's own aggregation levels, not map zoom: a level-1
 * hexagon covers 10 000 m², and each further level quadruples that area (so the
 * radius doubles).
 */

/** Hexagons per lattice row. */
const HEX_HOR = 1529;
const HEX_RADIUS = 62.04032394013997;
const TRIPLE_RADIUS = 186.12097182041992;
const DOUBLE_HEX_ROW = HEX_HOR * 2;

/** South-west origin of the lattice, in RD metres. */
const MIN_X = 3604.0;
const MIN_Y = 296800.0;

const HALF_HEIGHT = 53.72849659117709;
const ONE_AND_HALF_RADIUS = HEX_RADIUS * 1.5;

const HEXAGON_CORNERS = 6;

/** Surface of a level-1 hexagon, in m². */
const SURFACE_LEVEL_1 = 10000;

/** area = factor * r², for a regular hexagon. */
const SURFACE_TO_RADIUS_FACTOR = (3.0 * Math.sqrt(3.0)) / 2.0;

/** Corner offsets, as multiples of the radius and of the half-height. */
const HORIZONTAL_HEXAGON_MODS: HexagonOffsets = [0.5, 1.0, 0.5, -0.5, -1.0, -0.5];
const VERTICAL_HEXAGON_MODS: HexagonOffsets = [1.0, 0.0, -1.0, -1.0, 0.0, 1.0];

/** The six per-corner offsets of a hexagon, in corner order. */
export type HexagonOffsets = [number, number, number, number, number, number];

type CornerIndex = 0 | 1 | 2 | 3 | 4 | 5;

function surfaceForLevel(level: number): number {
  return SURFACE_LEVEL_1 * Math.pow(4, level - 1);
}

function radiusForLevel(level: number): number {
  return Math.sqrt(surfaceForLevel(level) / SURFACE_TO_RADIUS_FACTOR);
}

function halfHeightFromRadius(radius: number): number {
  const half = radius / 2.0;
  return Math.sqrt(radius * radius - half * half);
}

function offsetsForLevel(level: number): { horizontal: HexagonOffsets; vertical: HexagonOffsets; radius: number; height: number } {
  const radius = radiusForLevel(level);
  const halfHeight = halfHeightFromRadius(radius);
  const height = halfHeight * 2.0;
  const horizontal = HORIZONTAL_HEXAGON_MODS.map((m) => m * radius) as HexagonOffsets;
  const vertical = VERTICAL_HEXAGON_MODS.map((m) => m * halfHeight) as HexagonOffsets;
  return { horizontal, vertical, radius, height };
}

/**
 * The centre of the lattice cell containing a point, at a given grid level.
 *
 * Rows sit `halfHeight` apart with every odd row shifted half a column, so the
 * nearest centre is not always in the nearest row: a point can be closer to a
 * shifted neighbour one row up or down. Rounding the row first and the column
 * second gets this wrong for points near a cell edge, which is why the two
 * neighbouring rows are considered as well and the closest candidate wins.
 *
 * A cell's Voronoi region is exactly its hexagon, so the nearest centre is the
 * centre of the hexagon covering the point.
 */
function nearestCenterAtZoom(x: number, y: number, level: number): [number, number] {
  const { radius, height } = offsetsForLevel(level);
  const tripleRadius = radius * 3.0;
  const halfHeight = height / 2.0;
  const oneAndHalfRadius = tripleRadius / 2.0;

  const nearestRow = Math.floor((y - MIN_Y) / halfHeight);
  let best: [number, number] = [MIN_X, MIN_Y];
  let bestDistance = Infinity;

  for (let offset = -1; offset <= 1; offset++) {
    const row = nearestRow + offset;
    // Rows below the origin make the remainder negative, so normalise it.
    const shift = ((row % 2) + 2) % 2 !== 0 ? oneAndHalfRadius : 0;
    const column = Math.round((x - MIN_X - shift) / tripleRadius);
    const cx = MIN_X + column * tripleRadius + shift;
    const cy = MIN_Y + row * halfHeight;
    const distance = (x - cx) * (x - cx) + (y - cy) * (y - cy);
    // Strict, so a point exactly on an edge lands on the lower row every time.
    if (distance < bestDistance - 1e-9) {
      bestDistance = distance;
      best = [cx, cy];
    }
  }

  return best;
}

/**
 * The id of the receptor covering an RD coordinate.
 *
 * Inverse of {@link pointFromReceptorId}; use it to turn a map click into a
 * receptor.
 */
export function receptorIdFromPoint(x: number, y: number): number {
  const tripleHexRadius = TRIPLE_RADIUS;
  const oneAndHalfRadius = ONE_AND_HALF_RADIUS;
  const hexHeight = HALF_HEIGHT * 2;
  const xEven = x - MIN_X;
  const xOdd = xEven + oneAndHalfRadius;
  const yEven = y - MIN_Y;
  const yOdd = yEven + HALF_HEIGHT;
  const xEvenMinusOneAndHalfRadius = xEven - oneAndHalfRadius;
  const horDistToEven = xEvenMinusOneAndHalfRadius - Math.floor(xEven / tripleHexRadius) * tripleHexRadius;
  const horDistToOdd =
    Math.abs(xEvenMinusOneAndHalfRadius - Math.floor(xEvenMinusOneAndHalfRadius / tripleHexRadius) * tripleHexRadius) - oneAndHalfRadius;
  const yEvenMinusHalfHeight = yEven - HALF_HEIGHT;
  const vertDistToEven = yEvenMinusHalfHeight - Math.floor(yEven / hexHeight) * hexHeight;
  const vertDistToOdd = Math.abs(yEvenMinusHalfHeight - Math.floor(yEvenMinusHalfHeight / hexHeight) * hexHeight) - HALF_HEIGHT;
  const distToEvenGrid = horDistToEven * horDistToEven + vertDistToEven * vertDistToEven;
  const distToOddGrid = horDistToOdd * horDistToOdd + vertDistToOdd * vertDistToOdd;
  if (distToEvenGrid >= distToOddGrid) {
    return HEX_HOR * 2 * Math.floor(yOdd / hexHeight) + Math.floor(xOdd / tripleHexRadius) + 1;
  }
  return HEX_HOR * (2 * Math.floor(yEven / hexHeight) + 1) + Math.floor(xEven / tripleHexRadius) + 1;
}

/**
 * The RD coordinate at the centre of a receptor.
 *
 * Inverse of {@link receptorIdFromPoint}.
 */
export function pointFromReceptorId(receptorId: number): [number, number] {
  const id = receptorId - 1;
  const dx = Math.floor(id % HEX_HOR);
  const dy = Math.floor(id / HEX_HOR);
  const sndrow = id % DOUBLE_HEX_ROW >= HEX_HOR ? ONE_AND_HALF_RADIUS : 0;

  const x = dx * TRIPLE_RADIUS + sndrow + MIN_X;
  const y = dy * HALF_HEIGHT + MIN_Y;
  return [x, y];
}

/**
 * Snap an RD coordinate to the centre of the receptor covering it.
 *
 * The level-1 shorthand for {@link centerPointOnReceptorAtZoom}.
 */
export function centerPointOnReceptor(x: number, y: number): [number, number] {
  return pointFromReceptorId(receptorIdFromPoint(x, y));
}

/**
 * Snap an RD coordinate to the centre of the cell covering it at a given grid
 * level.
 *
 * Unlike {@link centerPointOnReceptor} this does not go via a receptor id,
 * because above level 1 a cell aggregates several receptors and has no id of
 * its own.
 */
export function centerPointOnReceptorAtZoom(x: number, y: number, level: number): [number, number] {
  return nearestCenterAtZoom(x, y, level);
}

function createHexagonFeatureAtZoom(receptorId: number, level: number): Feature {
  const [centerX, centerY] = pointFromReceptorId(receptorId);
  const { horizontal, vertical } = offsetsForLevel(level);

  const corners: Coordinate[] = [];
  for (let i = 0; i < HEXAGON_CORNERS; i++) {
    const corner = i as CornerIndex;
    corners.push([Math.round(centerX + horizontal[corner]), Math.round(centerY + vertical[corner])]);
  }
  // Repeat the first corner to close the ring.
  corners.push([Math.round(centerX + horizontal[0]), Math.round(centerY + vertical[0])]);

  return new Feature(new Polygon([corners]));
}

/**
 * The hexagon of a receptor, as a feature ready to add to a vector source.
 *
 * Corners are produced in this order, with `x` the receptor centre:
 * ```
 *    6 - 1
 *   /     \
 *  5   x   2
 *   \     /
 *    4 - 3
 * ```
 *
 * @param receptorId receptor id
 * @param zoomLevel grid level of the hexagon to draw; defaults to 1
 */
export function createHexagonFeature(receptorId: number, zoomLevel?: number): Feature {
  return createHexagonFeatureAtZoom(receptorId, zoomLevel ?? 1);
}

/**
 * Where a receptor's label should be anchored, or `null` when it should not be
 * labelled at all.
 *
 * Levels 4 and 5 aggregate too many receptors for a per-hexagon label to mean
 * anything, so they get none.
 */
export function centerFromHexagon(hexagonCode: number, featureZoomLevel: number): [number, number] | null {
  if (featureZoomLevel === 4 || featureZoomLevel === 5) {
    return null;
  }
  const [bx, by] = pointFromReceptorId(hexagonCode);
  return nearestCenterAtZoom(bx, by, featureZoomLevel);
}

/**
 * Whether a receptor is one of the lattice centres at a given grid level.
 *
 * Only receptors that survive aggregation to `zoomLevel` sit exactly on that
 * level's lattice; the rest are covered by a neighbour.
 */
export function isReceptorAtZoomLevel(receptorId: number, zoomLevel: number, epsilon: number = 1e-6): boolean {
  const [x, y] = pointFromReceptorId(receptorId);
  const [cx, cy] = nearestCenterAtZoom(x, y, zoomLevel);
  return Math.abs(x - cx) <= epsilon && Math.abs(y - cy) <= epsilon;
}
