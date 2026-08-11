import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point, polygon as turfPolygon } from "@turf/helpers";
import simplify from "@turf/simplify";
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
 * Standing a name on the shape it belongs to, using the outlines a vector tile layer is drawing.
 *
 * Names live on their own layer, one point per thing named, because a tile layer holds a shape as
 * one polygon per tile it crosses and would draw the name once per piece. Where each name goes is
 * worked out from those pieces all the same, so it follows the shape rather than sitting on a fixed
 * point of its own.
 */

/** Extent of the shape a name was placed on, and the sign that it has one to stand on at all. */
export const LABEL_SHAPE = "labelShape";

/** Coarser picks the wrong part of a shape with several open areas. */
const CANDIDATES_PER_AXIS = 12;

/** Of the shape's own width. Finer detail costs time and moves the answer by a fraction of a pixel. */
const DETAIL_TO_DROP = 1 / 2000;

type Best = { at: Coordinate; room: number };

/**
 * turf cannot answer this: its point-to-polygon distance reads coordinates as degrees and converts
 * to a length, so on a projected grid the numbers do not even rank in the right order.
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
      const edgeSquared = runX * runX + runY * runY;
      const along = edgeSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - x1) * runX + (y - y1) * runY) / edgeSquared));

      nearest = Math.min(nearest, Math.hypot(x - (x1 + along * runX), y - (y1 + along * runY)));
    }
  }

  return nearest;
}

/**
 * The point inside the shape with the most room around it, which is where a name reads best.
 *
 * A centroid will not serve: the centroid of a crescent or a river system falls outside the shape
 * it belongs to. Holes are filled in first. They are most of the points in a detailed outline, a
 * tile quantised to its grid can flatten a small one to a ring too short for turf to read, and a
 * name wants the middle of the mass anyway.
 */
export function labelPoint(shape: Polygon): Coordinate | undefined {
  const outer = shape.getCoordinates()[0];
  if (shape.getArea() <= 0 || outer === undefined || outer.length < 4) {
    return undefined;
  }

  const [minX, minY, maxX, maxY] = shape.getExtent() as [number, number, number, number];
  const span = Math.max(maxX - minX, maxY - minY);
  const outline = simplify(turfPolygon([outer]), { tolerance: span * DETAIL_TO_DROP, highQuality: false });
  const rings = outline.geometry.coordinates as Coordinate[][];
  let best: Best | undefined;

  for (let column = 1; column <= CANDIDATES_PER_AXIS; column++) {
    for (let row = 1; row <= CANDIDATES_PER_AXIS; row++) {
      const at: Coordinate = [minX + ((maxX - minX) * column) / (CANDIDATES_PER_AXIS + 1), minY + ((maxY - minY) * row) / (CANDIDATES_PER_AXIS + 1)];

      if (!booleanPointInPolygon(point(at), outline)) {
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

/** Vector tiles hand back a RenderFeature; a source told to keep ordinary features hands one of those. */
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

/** The biggest piece of each shape on screen, since a name can only go in one place. */
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
  /** Point features carrying the names. Each is matched to a shape by its feature id. */
  labels: VectorLayer;
  /** The layer drawing the outlines the names belong to. */
  shapes: VectorTileLayer;
  /** Property on a tile feature holding the id of the label it belongs to. */
  matchOn: string;
  view: Extent;
  /** Called before the expensive part, so a name that will not be drawn is not placed. */
  worthPlacing?: (shape: Extent, label: Feature) => boolean;
};

/**
 * Moves each name onto the shape it names. Call when the map has finished drawing, since that is
 * when the outlines it stands on are known.
 *
 * A name whose shape is not on screen is left without {@link LABEL_SHAPE}, for the style to skip.
 * Nothing is written unless it changed: every write redraws the map, and the redraw brings this
 * straight back round.
 */
export function placeLabels({ labels, shapes, matchOn, view, worthPlacing }: LabelPlacement): void {
  const pieces = biggestPieces(shapes, view, matchOn);

  for (const label of labels.getSource()?.getFeatures() ?? []) {
    const piece = pieces.get(String(label.getId() ?? ""));
    const on = piece?.getExtent();
    const wanted = piece !== undefined && on !== undefined && (worthPlacing?.(on, label) ?? true);

    if (sameExtent(label.get(LABEL_SHAPE) as Extent | undefined, wanted ? on : undefined)) {
      continue;
    }

    const at = wanted && piece !== undefined ? labelPoint(piece) : undefined;
    label.set(LABEL_SHAPE, at ? on : undefined);

    if (at) {
      (label.getGeometry() as Point | undefined)?.setCoordinates(at);
    }
  }
}
