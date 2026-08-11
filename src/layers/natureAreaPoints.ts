import type { FeatureLike } from "ol/Feature.js";
import Circle from "ol/style/Circle.js";
import Fill from "ol/style/Fill.js";
import Stroke from "ol/style/Stroke.js";
import Style from "ol/style/Style.js";
import Text from "ol/style/Text.js";

import { NATURE_AREA_NAME } from "./natureAreaFeatures";

/**
 * How a Natura 2000 site point is drawn: a dot, and a labelled marker while the pointer is on it.
 *
 * The colours and the typeface are AERIUS', not any one product's. When a point counts as hovered,
 * and whether the points are shown at all, are the product's to decide - both live in its own state
 * rather than on the feature.
 */

/** Georama is the AERIUS typeface. */
const LABEL_FONT = "14px Georama, Calibri, sans-serif";
const AERIUS_DARK_BLUE = "#193884";

const defaultStyle = new Style({
  image: new Circle({
    radius: 5,
    fill: new Fill({ color: AERIUS_DARK_BLUE }),
  }),
});

function hoverStyle(name: string): Style[] {
  return [
    new Style({
      image: new Circle({
        radius: 8,
        fill: new Fill({ color: "#fff" }),
        stroke: new Stroke({ color: "#d4ecf5", width: 3 }),
      }),
    }),
    defaultStyle,
    new Style({
      text: new Text({
        text: name,
        font: LABEL_FONT,
        fill: new Fill({ color: "#fff" }),
        backgroundFill: new Fill({ color: AERIUS_DARK_BLUE }),
        backgroundStroke: new Stroke({ color: "#fff", width: 3 }),
        padding: [4, 4, 4, 4],
        offsetY: -25,
      }),
    }),
  ];
}

export function natureAreaPointStyle(feature: FeatureLike, hovered: boolean = false): Style | Style[] {
  return hovered ? hoverStyle(String(feature.get(NATURE_AREA_NAME) ?? "")) : defaultStyle;
}
