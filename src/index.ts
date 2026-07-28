// Public entry point for @aerius/vue-geo-components.
// Keep this list curated: everything exported here is part of the public API.

export { default as MapView } from "./components/MapView.vue";

// SimpleFoldout, ToggleIcon and VerticalCollapse stay internal on purpose: they
// are the chrome LayerItemTemplate is built from, not map components. Keeping
// them unexported means no product depends on them, so we stay free to change
// them and this library does not become a catch-all component library.
export { default as LayerItemTemplate } from "./components/LayerItemTemplate.vue";
export { default as LayerItemsLegend } from "./components/LayerItemsLegend.vue";
export type { LegendDisplay, LegendItem } from "./components/legendDisplay";

export { useMap, provideMap, mapInjectionKey } from "./composables/useMap";

export { RD, registerRdProjection, isRdRegistered } from "./projections/rd";

// Shared map layer model.
export { LayerType, LegendType, ColorRangeIconType, LegendIconType } from "./layers/types";
export type {
  GeoInformation,
  LayerProps,
  LayerBaseProps,
  EmptyVectorLayerProps,
  WMSLayerProps,
  WMTSLayerProps,
  WFSLayerProps,
  RESTLayerProps,
  VectorTileLayerProps,
  LayerStyleType,
  LegendProps,
  TextLegendProps,
  ColorRange,
  ColorRangesLegendProps,
  ExtendedLegendProps,
  Datum,
} from "./layers/types";
export { CombinedLayers } from "./layers/combinedLayers";
export { createLayer } from "./layers/createLayer";
export { toLegendStyleValues, toStylesMap, findStyleKey } from "./layers/layerStyle";

export { useMapViewStore } from "./stores/mapView";
