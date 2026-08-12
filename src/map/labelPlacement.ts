import type { Coordinate } from "ol/coordinate.js";
import type { Extent } from "ol/extent.js";
import type Feature from "ol/Feature.js";
import type { FeatureLike } from "ol/Feature.js";
import type Geometry from "ol/geom/Geometry.js";
import { MultiPolygon, Point, Polygon } from "ol/geom.js";
import type VectorLayer from "ol/layer/Vector.js";
import type VectorTileLayer from "ol/layer/VectorTile.js";
import RenderFeature, { toGeometry } from "ol/render/Feature.js";

/**
 * Puts a name on the shape it belongs to, using the outlines a vector tile layer is drawing.
 * Names sit on their own layer, one point each, because a tile layer holds a shape as one polygon
 * per tile it crosses and would draw the name once per piece.
 *
 * A name has to end up:
 * - drawn once, however many pieces its shape arrives in;
 * - inside its own shape, which a centroid does not guarantee - the centre of a crescent or a river
 *   system lies outside it;
 * - in the most open part of that shape, so it reads as belonging to it.
 *
 * For each name, once the map has finished drawing:
 * - find its shape by feature id, and take the biggest piece of it on screen;
 * - drop that piece's fine detail and its holes;
 * - lay a grid of points over it and keep the ones that fall inside;
 * - use the one furthest from any edge;
 * - remember which shape it was worked out for, so the redraw that follows does not start the
 *   search over again.
 */

/** Extent of the shape a name stands on, and the sign that it has one to stand on at all. */
export const LABEL_SHAPE = "labelShape";

const LABEL_TRIED = "labelTried";

const CANDIDATES_PER_AXIS = 12;

/** Of the shape's own width. */
const DETAIL_TO_DROP = 1 / 2000;

type Best = { at: Coordinate; room: number };

function distanceToNearestEdge(at: Coordinate, rings: Coordinate[][]): number {
  const [x, y] = at as [number, number];
  let nearest = Number.POSITIVE_INFINITY;

  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const [x1, y1] = ring[i] as [number, number];
      const [x2, y2] = ring[i + 1] as [number, number];
      const diffX = x2 - x1;
      const diffY = y2 - y1;
      const edgeSquared = diffX * diffX + diffY * diffY;
      const along = edgeSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * diffX + (y - y1) * diffY) / edgeSquared));

      nearest = Math.min(nearest, Math.hypot(x - (x1 + along * diffX), y - (y1 + along * diffY)));
    }
  }

  return nearest;
}

export function labelPoint(shape: Polygon): Coordinate | undefined {
  const outer = shape.getCoordinates()[0];
  if (shape.getArea() <= 0 || outer === undefined || outer.length < 4) {
    return undefined;
  }

  const [minX, minY, maxX, maxY] = shape.getExtent() as [number, number, number, number];
  const span = Math.max(maxX - minX, maxY - minY);
  const outline = new Polygon([outer]).simplify(span * DETAIL_TO_DROP) as Polygon;
  const rings = outline.getCoordinates();
  let best: Best | undefined;

  for (let column = 1; column <= CANDIDATES_PER_AXIS; column++) {
    for (let row = 1; row <= CANDIDATES_PER_AXIS; row++) {
      const at: Coordinate = [minX + ((maxX - minX) * column) / (CANDIDATES_PER_AXIS + 1), minY + ((maxY - minY) * row) / (CANDIDATES_PER_AXIS + 1)];

      if (!outline.intersectsCoordinate(at)) {
        continue;
      }

      const room = distanceToNearestEdge(at, rings);
      if (best === undefined || room > best.room) {
        best = { at, room };
      }
    }
  }

  return best?.at;
}

function geometryOf(feature: FeatureLike): Geometry | undefined {
  return feature instanceof RenderFeature ? toGeometry(feature) : (feature.getGeometry() as Geometry | undefined);
}

function polygonsOf(geometry: Geometry | undefined): Polygon[] {
  if (geometry instanceof MultiPolygon) {
    return geometry.getPolygons();
  }
  return geometry instanceof Polygon ? [geometry] : [];
}

function sameExtent(one: Extent | undefined, other: Extent | undefined): boolean {
  return one === undefined || other === undefined ? one === other : one.every((at, index) => at === other[index]);
}

function biggestPieces(shapes: VectorTileLayer, view: Extent, matchOn: string): Map<string, Polygon> {
  const biggest = new Map<string, Polygon>();

  for (const feature of shapes.getFeaturesInExtent(view)) {
    const key = String(feature.get(matchOn) ?? "");
    if (key === "") {
      continue;
    }

    for (const polygon of polygonsOf(geometryOf(feature))) {
      const held = biggest.get(key);
      if (held === undefined || polygon.getArea() > held.getArea()) {
        biggest.set(key, polygon);
      }
    }
  }

  return biggest;
}

export type LabelPlacement = {
  labels: VectorLayer;
  shapes: VectorTileLayer;
  /** Property on a tile feature holding the id of the label it belongs to. */
  matchOn: string;
  view: Extent;
  /** Called before the expensive part, so a name that will not be drawn is not placed. */
  worthPlacing?: (shape: Extent, label: Feature) => boolean;
};

/** A name whose shape is not on screen is left without {@link LABEL_SHAPE}, for the style to skip. */
export function placeLabels({ labels, shapes, matchOn, view, worthPlacing }: LabelPlacement): void {
  const pieces = biggestPieces(shapes, view, matchOn);

  for (const label of labels.getSource()?.getFeatures() ?? []) {
    const piece = pieces.get(String(label.getId() ?? ""));
    const on = piece?.getExtent();
    const wanted = piece !== undefined && on !== undefined && (worthPlacing?.(on, label) ?? true);

    const considering = wanted ? on : undefined;
    if (sameExtent(label.get(LABEL_TRIED) as Extent | undefined, considering)) {
      continue;
    }
    label.set(LABEL_TRIED, considering);

    const at = wanted && piece !== undefined ? labelPoint(piece) : undefined;
    label.set(LABEL_SHAPE, at ? on : undefined);

    if (at) {
      (label.getGeometry() as Point | undefined)?.setCoordinates(at);
    }
  }
}
