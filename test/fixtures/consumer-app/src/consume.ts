// Uses the library the way a real app does, across the OpenLayers boundary in
// both directions: an ol Projection goes in, an ol Layer comes back out. When
// the app resolves a second copy of ol, both of those stop type-checking.
import { createLayer, createPdokBackgroundLayer, PdokBackgroundVariant, RD, registerRdProjection } from "@aerius/vue-geo-components";
import type OlMap from "ol/Map.js";
import { get as getProjection } from "ol/proj.js";

registerRdProjection();

const projection = getProjection(RD);
if (!projection) {
  throw new Error("RD should be registered");
}

const descriptor = createPdokBackgroundLayer({
  name: "Achtergrondkaart",
  variant: PdokBackgroundVariant.GREY,
  visibility: true,
});

const layer = createLayer(descriptor, projection);

export function addBackgroundTo(map: OlMap): void {
  map.addLayer(layer);
}
