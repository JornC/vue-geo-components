import type { FeatureLike } from "ol/Feature.js";

/**
 * Helpers for turning raw map interaction into something a product can act on.
 */

/**
 * Handle a click on the map by picking the first feature that carries a given
 * property, and handing it to the caller.
 *
 * A click reports every feature under the cursor, across layers. `featureKey`
 * is how you say which of them you meant. Nothing matching means the user
 * clicked past your features, so the handler is called with `undefined` - which
 * is how a caller clears its selection.
 */
export function createHandleFeatureClicked(
  onFeature: (feature: FeatureLike | undefined) => void,
  featureKey: string,
): (features: FeatureLike[]) => void {
  return (features: FeatureLike[]) => onFeature(features.find((feature) => feature.get(featureKey) !== undefined));
}
