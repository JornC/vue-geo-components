// Public entry point for @aerius/vue-geo-components.
// Keep this list curated: everything exported here is part of the public API.

export { default as MapView } from "./components/MapView.vue";

export { useMap, provideMap, mapInjectionKey } from "./composables/useMap";

export { RD, registerRdProjection, isRdRegistered } from "./projections/rd";

export { useMapViewStore } from "./stores/mapView";
