import type { LayerProps } from "../layers/types";
import { scaleDenominatorToResolution } from "../layers/resolution";

/** Scale past which a detailed background gives way to an overview. */
const MAX_SCALE = 800_000;

export const maxResolution = scaleDenominatorToResolution(MAX_SCALE);

/**
 * In levels, not resolution: resolution doubles per level, so a fixed span of
 * it means something different at either end of the scale.
 *
 * One level, because the overview has to be solid by the zoom a map opens on,
 * which sits a little over a level past the cut-off.
 */
const FADE_ZOOM_LEVELS = 1;

/**
 * 0 at the cut-off, rising to 1 fully zoomed out, undefined once the
 * background is gone. Below {@link maxResolution} the result is negative, so
 * callers must handle that range first.
 */
export function backgroundFadeProgress(resolution: number): number | undefined {
  const levels = Math.log2(resolution / maxResolution);
  return levels < FADE_ZOOM_LEVELS ? levels / FADE_ZOOM_LEVELS : undefined;
}

/**
 * Raster layers have no style function, so they are faded by hand. Each keeps
 * its own opacity as the ceiling the fade works down from.
 */
export function applyBackgroundFade(resolution: number, layers: Array<LayerProps | undefined>): void {
  const progress = backgroundFadeProgress(resolution);
  const visible = resolution < maxResolution || progress !== undefined;
  const remaining = resolution < maxResolution ? 1 : 1 - (progress ?? 1);

  for (const layer of layers) {
    layer?.layerRef?.setVisible(visible && layer.visibility);
    layer?.layerRef?.setOpacity(layer.opacity * remaining);
  }
}
