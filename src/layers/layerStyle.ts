import { Fill, Stroke, Style } from "ol/style";

import type { LayerStyleType } from "./types";

/**
 * Fixes the style keys by replacing dots in the key with underscores to make it work as i18n key
 *
 * @param styleValues styles values to modify
 * @returns modified style values
 */
export function toLegendStyleValues(styleValues: [LayerStyleType, ...LayerStyleType[]]): LayerStyleType[] {
  const copy = structuredClone(styleValues);
  copy.forEach((s) => (s.key = s.key?.replace(/\./g, "_")));
  return copy;
}

/**
 * Constructs a Map of OpenLayers Style objects given the list of Layer style values.
 *
 * @param styleValues list of layer styles
 * @returns Map of OpenLayers Style objects
 */
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
 * Finds the key in the list of style values for which the given value is smaller than either
 * the max (using <) or maxAnd (using <=) is. Style value should contain either max or maxAnd.
 * The give list should be ordered from small to large values.
 * If no value matches the last entry of the list is returned.
 *
 * @param styleValues Style values to test against
 * @param value value to use to find the matching style
 * @returns the key of the found style value.
 */
export function findStyleKey(styleValues: [LayerStyleType, ...LayerStyleType[]], value: number): string {
  return (
    styleValues.find((style) => (style.max !== undefined && value < style.max) || (style.maxAnd !== undefined && value <= style.maxAnd))?.key ??
    (styleValues[styleValues.length - 1] as LayerStyleType).key
  );
}
