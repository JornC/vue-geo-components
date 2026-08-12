import { Fill, Stroke, Style } from "ol/style.js";

import type { LayerStyleType } from "./types";

/** A dot separates segments of an i18n key, so a style key carrying one gets underscores instead. */
export function toLegendStyleValues(styleValues: [LayerStyleType, ...LayerStyleType[]]): LayerStyleType[] {
  const copy = structuredClone(styleValues);
  copy.forEach((s) => (s.key = s.key?.replace(/\./g, "_")));
  return copy;
}

export function toStylesMap(styleValues: [LayerStyleType, ...LayerStyleType[]]): Map<string, Style> {
  return new Map(
    styleValues.map((ls) => [
      ls.key,
      new Style({
        fill: new Fill({ color: ls.fillColor }),
        stroke: new Stroke({ color: ls.strokeColor, width: 0.5 }),
      }),
    ]),
  );
}

/**
 * The first style whose `max` (exclusive) or `maxAnd` (inclusive) the value falls under, so the list
 * has to run from small to large. A value past every bound falls back to the last style.
 */
export function findStyleKey(styleValues: [LayerStyleType, ...LayerStyleType[]], value: number): string {
  return (
    styleValues.find((style) => (style.max !== undefined && value < style.max) || (style.maxAnd !== undefined && value <= style.maxAnd))?.key ??
    (styleValues[styleValues.length - 1] as LayerStyleType).key
  );
}
