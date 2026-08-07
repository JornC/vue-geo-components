import type { LayerProps } from "../layers/types";
import { scaleDenominatorToResolution } from "../layers/resolution";

/**
 * Scale past which a detailed background stops earning its keep and an
 * overview takes over. Shared so products fading against the same overview do
 * not drift apart.
 */
const MAX_SCALE = 800_000;

export const maxResolution = scaleDenominatorToResolution(MAX_SCALE);

/**
 * Zoom levels the fade runs over. Measured in levels rather than in
 * resolution, because resolution doubles per level: a fixed span of it covers
 * less than one level here, so no resting zoom lands inside the fade and what
 * is fading in arrives in one step instead of easing.
 */
const FADE_ZOOM_LEVELS = 2;

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
