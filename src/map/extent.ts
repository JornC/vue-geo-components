import type { Extent } from "ol/extent.js";
import type { Size } from "ol/size.js";

/**
 * OpenLayers types extents and sizes as plain number arrays, so reading them
 * index by index leaves every value possibly undefined. These narrow them once,
 * at the edge, so the arithmetic that follows works on real numbers.
 *
 * Internal - not part of the public API.
 */

export type Corners = { minX: number; minY: number; maxX: number; maxY: number };

/** An extent's four numbers, or `null` if it is not a full, finite extent. */
export function extentCorners(extent: Extent | undefined): Corners | null {
  if (!extent) {
    return null;
  }
  const [minX, minY, maxX, maxY] = extent;
  if (minX === undefined || minY === undefined || maxX === undefined || maxY === undefined) {
    return null;
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
    return null;
  }
  return { minX, minY, maxX, maxY };
}

/** A size's width and height, or `null` if it is not a full size. */
export function sizeOf(size: Size | undefined): { width: number; height: number } | null {
  if (!size) {
    return null;
  }
  const [width, height] = size;
  if (width === undefined || height === undefined) {
    return null;
  }
  return { width, height };
}
