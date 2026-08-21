import Feature from "ol/Feature.js";
import VectorLayer from "ol/layer/Vector.js";
import type Map from "ol/Map.js";
import { WKT } from "ol/format.js";
import type { Geometry } from "ol/geom.js";
import Point from "ol/geom/Point.js";
import Circle from "ol/style/Circle.js";
import Fill from "ol/style/Fill.js";
import Style from "ol/style/Style.js";
import { createLayer } from "../layers/createLayer";
import { LayerType, type LayerProps } from "../layers/types";
import { mapFlightFor } from "../map/flyTo";
import { zoomToExtent } from "../map/zoomToExtent";
import { createHexagonFeature, pointFromReceptorId, receptorIdFromPoint } from "../receptors/hexagonGrid";
import { createSelectedReceptorLayer, renderSelectedReceptor } from "../receptors/selectedReceptor";
import type { SearchSuggestion } from "./searchTypes";

const HEXAGON_VIEWPORT_FRACTION = 1 / 3;

const wkt = new WKT();

const SEARCH_RESULT_MARKER_COLOR = "#193884";
const SEARCH_RESULT_MARKER_RADIUS = 5;

const searchResultStyle = new Style({
  image: new Circle({
    radius: SEARCH_RESULT_MARKER_RADIUS,
    fill: new Fill({ color: SEARCH_RESULT_MARKER_COLOR }),
  }),
});

const resultLayers = new WeakMap<Map, LayerProps>();

/**
 * Fly to and highlight a search suggestion. Hexagons get the selected-receptor
 * layer (hexagon + crosshair); other results get the extent zoomed to and a
 * point marker at the centroid. Unreadable geometries are ignored.
 */
export function applySearchSuggestion(map: Map, suggestion: SearchSuggestion): void {
  const centroid = readGeometry(suggestion.centroid, suggestion.id, "centroid");
  const extentGeometry = readGeometry(suggestion.bbox, suggestion.id, "bounding box") ?? readGeometry(suggestion.geometry, suggestion.id, "geometry");
  if (!centroid && !extentGeometry) {
    return;
  }

  removePreviousResultLayer(map);

  if (suggestion.type === "RECEPTOR") {
    applyReceptor(map, centroid);
    return;
  }
  applyExtentResult(map, centroid, extentGeometry);
}

function readGeometry(wktText: string | undefined, suggestionId: string, geometryName: string): Geometry | undefined {
  if (!wktText) {
    return undefined;
  }
  try {
    return wkt.readGeometry(wktText);
  } catch (error) {
    console.warn(`Search suggestion ${suggestionId} has an unreadable ${geometryName}.`, error);
    return undefined;
  }
}

function removePreviousResultLayer(map: Map) {
  const previous = resultLayers.get(map);
  if (previous?.layerRef) {
    map.removeLayer(previous.layerRef);
  }
  resultLayers.delete(map);
}

function applyReceptor(map: Map, centroid: Geometry | undefined) {
  const coordinates = centroid instanceof Point ? centroid.getCoordinates() : undefined;
  if (!coordinates) {
    return;
  }
  const [x, y] = coordinates;
  if (x === undefined || y === undefined) {
    return;
  }
  const receptorId = receptorIdFromPoint(x, y);
  const [centerX, centerY] = pointFromReceptorId(receptorId);

  const layer = createSelectedReceptorLayer();
  const olLayer = createLayer(layer, map.getView().getProjection());
  map.addLayer(olLayer);
  resultLayers.set(map, layer);
  renderSelectedReceptor(layer, receptorId, true, 1);

  const zoom = zoomForHexagon(map, receptorId);
  mapFlightFor(map).flyTo({ center: [centerX, centerY], zoom });
}

function zoomForHexagon(map: Map, receptorId: number): number {
  const view = map.getView();
  const size = map.getSize();
  if (!size || size[0] === undefined || size[0] === 0) {
    return view.getMaxZoom();
  }
  const geometry = createHexagonFeature(receptorId).getGeometry();
  if (!geometry) {
    return view.getMaxZoom();
  }
  const [minimumX, , maximumX] = geometry.getExtent();
  if (minimumX === undefined || maximumX === undefined) {
    return view.getMaxZoom();
  }
  const resolution = (maximumX - minimumX) / (size[0] * HEXAGON_VIEWPORT_FRACTION);
  const zoom = view.getZoomForResolution(resolution) ?? view.getMaxZoom();
  return Math.min(view.getMaxZoom(), Math.max(view.getMinZoom(), zoom));
}

function applyExtentResult(map: Map, centroid: Geometry | undefined, extentGeometry: Geometry | undefined) {
  const projection = map.getView().getProjection();
  const layer: LayerProps = {
    name: "Search result",
    type: LayerType.EMPTY_VECTOR_LAYER,
    visibility: true,
    opacity: 1,
    zIndex: 3,
    styleFunction: () => searchResultStyle,
  };
  const olLayer = createLayer(layer, projection) as VectorLayer;
  const source = olLayer.getSource();
  if (centroid?.getType() === "Point") {
    source?.addFeature(new Feature(centroid));
  }
  map.addLayer(olLayer);
  resultLayers.set(map, layer);

  const extent = extentGeometry?.getExtent() ?? centroid?.getExtent();
  if (extent) {
    zoomToExtent(map, extent);
  }
}
