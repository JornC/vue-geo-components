import Feature from "ol/Feature.js";
import type { Coordinate } from "ol/coordinate.js";
import { getCenter } from "ol/extent.js";
import LineString from "ol/geom/LineString.js";
import Point from "ol/geom/Point.js";
import type VectorSource from "ol/source/Vector.js";
import Fill from "ol/style/Fill.js";
import Stroke from "ol/style/Stroke.js";
import Style from "ol/style/Style.js";
import Text from "ol/style/Text.js";

import { LayerType, type LayerProps } from "../layers/types";
import { extentCorners } from "../map/extent";
import { centerFromHexagon, createHexagonFeature } from "./hexagonGrid";

/**
 * Rendering of the receptor the user has selected: the hexagon itself plus
 * crosshair lines running from it to the edges of the map, and the label style
 * used when receptor values are drawn on the map.
 */

/** Default font for on-map receptor labels; Georama is the AERIUS typeface. */
const LABEL_FONT = "14px Georama, Calibri, sans-serif";

const selectedHexagonStyle = new Style({
  zIndex: 2,
  stroke: new Stroke({
    color: "#000",
    width: 4,
  }),
});

const crosshairLineStyle = new Style({
  zIndex: 1,
  stroke: new Stroke({
    color: "rgba(255, 255, 255, 1)",
    width: 2,
  }),
});

/**
 * Style for the selected-receptor layer.
 *
 * The layer holds two kinds of geometry - the hexagon and the crosshair lines -
 * and this tells them apart so each gets its own look.
 */
export function selectedReceptorStyle(feature: Feature): Style {
  return feature.getGeometry()?.getType() === "LineString" ? crosshairLineStyle : selectedHexagonStyle;
}

/** A ready-made descriptor for the layer {@link renderSelectedReceptor} draws into. */
export function createSelectedReceptorLayer(name: string = "Selected receptor"): LayerProps {
  return {
    name,
    type: LayerType.EMPTY_VECTOR_LAYER,
    visibility: true,
    opacity: 1,
    styleFunction: selectedReceptorStyle,
    zIndex: 2,
  } as LayerProps;
}

/**
 * A label anchored to a receptor's lattice centre, or `null` when that receptor
 * should carry no label at the given grid level.
 *
 * Callers read the values off their own features, so this carries no assumption
 * about what those properties are named.
 */
export function createReceptorLabelStyle(label: string, hexagonCode: number, zoomLevel: number, font: string = LABEL_FONT): Style | null {
  if (typeof hexagonCode !== "number" || typeof zoomLevel !== "number") {
    return null;
  }
  const center = centerFromHexagon(hexagonCode, zoomLevel);
  if (!center) {
    return null;
  }
  return new Style({
    geometry: new Point(center),
    text: new Text({
      overflow: true,
      text: label,
      font,
      fill: new Fill({ color: "#000" }),
      stroke: new Stroke({ color: "#fff", width: 5 }),
    }),
  });
}

/**
 * Draw the selected receptor into its layer, replacing whatever was there.
 *
 * The crosshair lines are drawn out to the current view extent, so this needs
 * redrawing whenever the map moves. Passing no receptor - or `render: false` -
 * clears the layer.
 */
export function renderSelectedReceptor(
  selectedReceptorLayer: LayerProps | null,
  receptorId: string | number | undefined,
  render: boolean = true,
  zoomLevel?: number,
): void {
  const source = selectedReceptorLayer?.layerRef?.getSource() as VectorSource | undefined;
  const map = selectedReceptorLayer?.layerRef?.getMapInternal();

  source?.clear();
  if (!source || !map || !receptorId || !render) {
    return;
  }

  const feature = createHexagonFeature(Number(receptorId), zoomLevel);
  const geometry = feature.getGeometry();
  if (!geometry) {
    return;
  }

  const hexagon = extentCorners(geometry.getExtent());
  const view = extentCorners(map.getView().calculateExtent());
  const center = getCenter(geometry.getExtent());
  const [centerX, centerY] = center;
  if (!hexagon || !view || centerX === undefined || centerY === undefined) {
    return;
  }

  source.addFeatures([
    // Lines from each side of the hexagon out to the matching edge of the view.
    crosshair([hexagon.minX, centerY], [view.minX, centerY]),
    crosshair([hexagon.maxX, centerY], [view.maxX, centerY]),
    crosshair([centerX, hexagon.maxY], [centerX, view.maxY]),
    crosshair([centerX, hexagon.minY], [centerX, view.minY]),
    feature,
  ]);
}

function crosshair(from: Coordinate, to: Coordinate): Feature {
  return new Feature(new LineString([from, to]));
}
