import type { LayerStyleType } from "../layers/types";

/**
 * The colour scales AERIUS products render nitrogen data with.
 *
 * These are data, not styles: pass them through `toStylesMap` to get OpenLayers
 * styles, or through `toLegendStyleValues` for a legend. What a product does
 * with them - which feature property it reads, how it labels the classes - stays
 * with the product, which is also why no translation lives here.
 *
 * The class boundaries and colours are an AERIUS-wide convention. Keep them in
 * step across products: a hexagon that is orange in one product and red in
 * another is a bug, however pretty either looks.
 *
 * `key` doubles as the translation key each product resolves, so the keys are
 * part of the contract too.
 */

/**
 * Sensitivity to nitrogen deposition relative to the critical load (KDW).
 *
 * Exported as bare colours rather than a finished scale because the layers that
 * render this classification differ in outline: receptor hexagons take a black
 * stroke, habitat-type polygons a grey one.
 */
export const kdwSensitivityFillColors = {
  high_sensitivity: "#920056",
  normal_sensitivity: "#F98D63",
  low_sensitivity: "#3690C0",
} as const;

/** Build a KDW sensitivity scale with the outline a given layer wants. */
export function kdwSensitivityScale(strokeColor: string): [LayerStyleType, ...LayerStyleType[]] {
  return [
    { key: "high_sensitivity", fillColor: kdwSensitivityFillColors.high_sensitivity, strokeColor },
    { key: "normal_sensitivity", fillColor: kdwSensitivityFillColors.normal_sensitivity, strokeColor },
    { key: "low_sensitivity", fillColor: kdwSensitivityFillColors.low_sensitivity, strokeColor },
  ];
}

/** Natura 2000 protection regime: Habitat directive, Birds directive, or both. */
export const natura2000DirectiveScale: [LayerStyleType, ...LayerStyleType[]] = [
  { key: "HR", fillColor: "#F4E798", strokeColor: "#808080" },
  { key: "VR", fillColor: "#BBDDEA", strokeColor: "#808080" },
  { key: "VR+HR", fillColor: "#CFE2A1", strokeColor: "#808080" },
];

/** Total nitrogen deposition, in mol/ha/yr. */
export const depositionTotalScale: [LayerStyleType, ...LayerStyleType[]] = [
  { key: "0_to_10", maxAnd: 10, fillColor: "#FFFFD4", strokeColor: "#000000" },
  { key: "10_to_13", maxAnd: 13, fillColor: "#FEE391", strokeColor: "#000000" },
  { key: "13_to_17", maxAnd: 17, fillColor: "#FEC44F", strokeColor: "#000000" },
  { key: "17_to_21", maxAnd: 21, fillColor: "#FE9929", strokeColor: "#000000" },
  { key: "21_to_26", maxAnd: 26, fillColor: "#EC7014", strokeColor: "#000000" },
  { key: "26_to_32", maxAnd: 32, fillColor: "#CC4C02", strokeColor: "#000000" },
  { key: "greater_than_32", fillColor: "#8C2D04", strokeColor: "#000000" },
];

/**
 * Change in deposition between two years, in mol/ha/yr - green for a decrease,
 * purple for an increase.
 *
 * Note the boundary semantics differ from {@link depositionOtherScale} despite
 * the shared colours: the negative classes here are exclusive (`max`) where the
 * other scale's are inclusive (`maxAnd`). Preserved as-is from the products that
 * defined them.
 */
export const depositionDeltaScale: [LayerStyleType, ...LayerStyleType[]] = [
  { key: "less_than_-3.5", max: -3.5, fillColor: "#6C8B41", strokeColor: "#000000" },
  { key: "-3.5_to_-2.0", max: -2.0, fillColor: "#A7B98D", strokeColor: "#000000" },
  { key: "-2.0_to_-0.5", max: -0.5, fillColor: "#E2E8D9", strokeColor: "#000000" },
  { key: "-0.5_to_0.5", maxAnd: 0.5, fillColor: "#F2F2F2", strokeColor: "#000000" },
  { key: "0.5_to_2.0", maxAnd: 2.0, fillColor: "#DCD9E9", strokeColor: "#000000" },
  { key: "2.0_to_3.5", maxAnd: 3.5, fillColor: "#978CBE", strokeColor: "#000000" },
  { key: "greater_than_3.5", fillColor: "#514093", strokeColor: "#000000" },
];

/** Deposition from other sources, in kg/ha/yr. */
export const depositionOtherScale: [LayerStyleType, ...LayerStyleType[]] = [
  { key: "less_than_-3.5_kg", max: -3.5, fillColor: "#6C8B41", strokeColor: "#000000" },
  { key: "-3.5_to_-2.0_kg", maxAnd: -2, fillColor: "#A7B98D", strokeColor: "#000000" },
  { key: "-2.0_to_-0.5_kg", maxAnd: -0.5, fillColor: "#E2E8D9", strokeColor: "#000000" },
  { key: "-0.5_to_0.5_kg", maxAnd: 0.5, fillColor: "#F2F2F2", strokeColor: "#000000" },
  { key: "0.5_to_2.0_kg", maxAnd: 2.0, fillColor: "#DCD9E9", strokeColor: "#000000" },
  { key: "2.0_to_3.5_kg", maxAnd: 3.5, fillColor: "#978CBE", strokeColor: "#000000" },
  { key: "greater_than_3.5_kg", fillColor: "#514093", strokeColor: "#000000" },
];

/** Deposition attributed to one sector, country or source group, in mol/ha/yr. */
export const depositionBreakdownScale: [LayerStyleType, ...LayerStyleType[]] = [
  { key: "less_than_0", max: 0.0, fillColor: "#F0F071", strokeColor: "#000000" },
  { key: "0_to_0.5", maxAnd: 0.5, fillColor: "#F6EFF7", strokeColor: "#000000" },
  { key: "0.5_to_1.0", maxAnd: 1.0, fillColor: "#D0D1E6", strokeColor: "#000000" },
  { key: "1.0_to_2.0", maxAnd: 2.0, fillColor: "#A6BDDB", strokeColor: "#000000" },
  { key: "2.0_to_3.0", maxAnd: 3.0, fillColor: "#67A9CF", strokeColor: "#000000" },
  { key: "3.0_to_5.0", maxAnd: 5.0, fillColor: "#3690C0", strokeColor: "#000000" },
  { key: "5.0_to_8.0", maxAnd: 8.0, fillColor: "#02818A", strokeColor: "#000000" },
  { key: "greater_than_8.0", fillColor: "#016450", strokeColor: "#000000" },
];

/**
 * How far a habitat's nitrogen load sits over its critical load.
 *
 * Classified server-side, so the classes carry no numeric bounds here.
 */
export const nitrogenLoadScale: [LayerStyleType, ...LayerStyleType[]] = [
  { key: "no_nitrogen_problem", fillColor: "#33AD59", strokeColor: "#000000" },
  { key: "near_overload", fillColor: "#99CF6D", strokeColor: "#000000" },
  { key: "light_overload", fillColor: "#D9C3E2", strokeColor: "#000000" },
  { key: "moderate_overload", fillColor: "#C4A3D0", strokeColor: "#000000" },
  { key: "heavy_overload", fillColor: "#7E2A96", strokeColor: "#000000" },
];
