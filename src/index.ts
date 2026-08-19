// Public entry point for @aerius/vue-geo-components.
// Keep this list curated: everything exported here is part of the public API.

export { default as MapView } from "./components/MapView.vue";

// SimpleFoldout, ToggleIcon and VerticalCollapse stay internal on purpose: they
// are the chrome LayerItemTemplate is built from, not map components. Keeping
// them unexported means no product depends on them, so we stay free to change
// them and this library does not become a catch-all component library.
export { default as LayerItemTemplate } from "./components/LayerItemTemplate.vue";
export { default as LayerItemsLegend } from "./components/LayerItemsLegend.vue";
export { toLegendDisplay } from "./components/legendDisplay";
export type { LegendDisplay, LegendItem, LegendTranslator } from "./components/legendDisplay";

export { useMap, provideMap, mapInjectionKey } from "./composables/useMap";

export { RD, RD_EXTENT, RD_PROJ4_DEFINITION, registerRdProjection, isRdRegistered } from "./projections/rd";
export { registerProjection, isProjectionRegistered } from "./projections/registerProjection";

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
export { isLayerGroupVisible, layerGroupOpacity, setLayerGroupOpacity, setLayerGroupVisible } from "./layers/layerGroup";
export type { LayerGroup } from "./layers/layerGroup";
export { createLayer } from "./layers/createLayer";
export { toLegendStyleValues, toStylesMap, findStyleKey } from "./layers/layerStyle";

export { useMapViewStore } from "./stores/mapView";

// The AERIUS receptor grid: a fixed hexagonal lattice anchored to RD, in which
// every hexagon has a stable id. Shared so no two products can disagree about
// where a given receptor is.
export {
  centerFromHexagon,
  centerPointOnReceptor,
  centerPointOnReceptorAtZoom,
  createHexagonFeature,
  isReceptorAtZoomLevel,
  pointFromReceptorId,
  receptorIdFromPoint,
} from "./receptors/hexagonGrid";
export type { HexagonOffsets } from "./receptors/hexagonGrid";
export { createSelectedReceptorLayer, createReceptorLabelStyle, renderSelectedReceptor, selectedReceptorStyle } from "./receptors/selectedReceptor";

// Dutch public map services.
export {
  BASE_LAYER_GROUP,
  PdokBackgroundVariant,
  createPdokAerialLayer,
  createPdokBackgroundLayer,
  createPdokProvinceBoundaryLayer,
} from "./layers/pdok";

// Natura 2000 sites as point features.
export { NATURE_AREA_EXTENT, NATURE_AREA_NAME, natureAreasToFeatures } from "./layers/natureAreas";
export type { NatureArea } from "./layers/natureAreas";

// Layer plumbing.
export { getMatrixLimitsForLayer } from "./layers/wmtsCapabilities";
export type { WmtsCapabilitiesJson } from "./layers/wmtsCapabilities";
export { createHandleFeatureClicked } from "./layers/featureInteraction";
export { scaleDenominatorToResolution } from "./layers/resolution";

// Smooth camera movement.
export { createMapFlyTo } from "./map/flyTo";
export type { FlyController, FlyOptions, FlyTarget } from "./map/flyTo";
export { zoomToExtent } from "./map/zoomToExtent";
export { labelPoint, placeLabels, LABEL_SHAPE } from "./map/labelPlacement";
export {
  createNatureAreaLayers,
  natureAreaViewParams,
  NATURE_AREAS_GROUP,
  directiveAreaLegend,
  directiveAreaStyle,
  directiveAreaStyleValues,
  fetchNatureAreas,
  wrapLabel,
  NATURE_AREA_LABEL_FONT,
  UNDETERMINED,
} from "./layers/fameNatureAreas";
export type { NatureAreaLayers, NatureAreaLayersOptions } from "./layers/fameNatureAreas";
export type { LabelPlacement } from "./map/labelPlacement";

// Handing a detailed background over to an overview as the map zooms out.
// What fades in, and how it looks, stays with the product.
export { applyBackgroundFade, backgroundFadeProgress, maxResolution } from "./map/backgroundFade";
