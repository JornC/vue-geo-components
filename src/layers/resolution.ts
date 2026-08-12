/**
 * Screen resolution in dots per inch. Note this is the browser convention, not
 * the 0.28 mm pixel (about 90.7 dpi) the OGC assumes, so a resolution derived
 * here is a few percent off a strict WMTS scale denominator. Kept at 96 because
 * the scales it converts are chosen by eye against a screen.
 */
const SCREEN_DPI = 96;

/** Inches in a metre. */
const INCHES_PER_METER = 39.37;

/**
 * Convert a scale denominator (the 25000 in "1:25000") to an OpenLayers
 * resolution in map units per pixel.
 *
 * Useful for expressing a cut-off the way cartographers do - "stop drawing this
 * beyond 1:800000" - and comparing it against the resolutions OpenLayers reports.
 */
export function scaleDenominatorToResolution(scaleDenominator: number): number {
  return scaleDenominator / (SCREEN_DPI * INCHES_PER_METER);
}
