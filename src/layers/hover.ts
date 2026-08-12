import type { Coordinate } from "ol/coordinate.js";
import type { FeatureLike } from "ol/Feature.js";
import type Layer from "ol/layer/Layer.js";
import type VectorSource from "ol/source/Vector.js";

/** What a layer is told about the pointer when it is asked what lies under it. */
export type HoverContext = {
  layer: Layer;
  coordinate: Coordinate;
  /** Map units per pixel, for turning an on-screen distance into a map distance. */
  resolution: number;
};

/**
 * How a layer answers what the pointer is over.
 *
 * A layer without one is answered by the map's hit detection, which is the only
 * option for shapes and the only option at all for a vector tile layer.
 */
export type HoverResolver = (context: HoverContext) => FeatureLike | undefined;

const DEFAULT_RADIUS_PX = 8;

/**
 * Answers from the source's own spatial index rather than by drawing the layer.
 *
 * Only sound for points: a shape's closest point sits on its edge, so a pointer
 * well inside a large shape would measure as far away and fall outside the radius.
 */
export function nearestFeatureHover({ radiusPx = DEFAULT_RADIUS_PX } = {}): HoverResolver {
  return ({ layer, coordinate, resolution }) => {
    const source = layer.getSource() as VectorSource | null;
    if (!source?.getClosestFeatureToCoordinate) {
      return undefined;
    }

    const feature = source.getClosestFeatureToCoordinate(coordinate);
    const geometry = feature?.getGeometry();
    if (!geometry) {
      return undefined;
    }

    const closest = geometry.getClosestPoint(coordinate);
    const distance = Math.hypot(closest[0]! - coordinate[0]!, closest[1]! - coordinate[1]!);
    return distance <= radiusPx * resolution ? (feature ?? undefined) : undefined;
  };
}
