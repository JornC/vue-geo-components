/** Dots per inch assumed by OGC scale denominators. */
const OGC_DPI = 96;

/** Inches in a metre. */
const INCHES_PER_METER = 39.37;

/**
 * Convert an OGC scale denominator (the 25000 in "1:25000") to an OpenLayers
 * resolution in map units per pixel.
 *
 * Useful for expressing a cut-off the way cartographers do - "stop drawing this
 * beyond 1:800000" - and comparing it against the resolutions OpenLayers reports.
 */
export function scaleDenominatorToResolution(scaleDenominator: number): number {
  return scaleDenominator / (OGC_DPI * INCHES_PER_METER);
}
