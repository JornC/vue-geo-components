// Public entry point for @aerius/vue-geo-components.
// Keep this list curated: everything exported here is part of the public API.

export { default as MapView } from "./components/MapView.vue";

// SimpleFoldout, ToggleIcon and VerticalCollapse stay internal: they are the
// chrome LayerItemTemplate is built from.
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
export { toLegendStyleValues, toStylesMap, findStyleKey } from "./layers/layerStyle";

export { useMapViewStore } from "./stores/mapView";
