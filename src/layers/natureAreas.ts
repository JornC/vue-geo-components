import Feature from "ol/Feature.js";
import type { FeatureLike } from "ol/Feature.js";
import WKT from "ol/format/WKT.js";
import type { Extent } from "ol/extent.js";
import Circle from "ol/style/Circle.js";
import Fill from "ol/style/Fill.js";
import Stroke from "ol/style/Stroke.js";
import Style from "ol/style/Style.js";
import Text from "ol/style/Text.js";

/**
 * Natura 2000 sites shown as points on the map.
 *
 * A site is drawn at a point inside it, and picking one flies the map to the site's
 * bounding box. So a feature here carries a point and four numbers - never the
 * site's actual boundary. Nothing in this module can outline a site; a product
 * that needs outlines has to fetch the polygons and render them itself.
 *
 * Fetching and caching stays with the product as well: every AERIUS product
 * reaches a different service for these, and they differ in when the data goes
 * stale.
 */

/** Font for the hover label; Georama is the AERIUS typeface. */
const LABEL_FONT = "14px Georama, Calibri, sans-serif";
const AERIUS_DARK_BLUE = "#193884";

/** Feature property holding a site's extent, as written by {@link natureAreasToFeatures}. */
export const NATURE_AREA_EXTENT = "extent";

/** Feature property holding a site's name. */
export const NATURE_AREA_NAME = "name";

/** Feature property holding the authority responsible for a site. */
export const NATURE_AREA_AUTHORITY = "authority";

/**
 * A Natura 2000 site, in the shape this module needs it.
 *
 * Both geometries are WKT, which is how AERIUS services publish them. Only the
 * point survives as a geometry - the other is reduced to its bounding box on the
 * way in and the shape itself is dropped.
 */
export type NatureArea = {
  id: string;
  name: string;
  authority?: string;
  /** Point the site is drawn at. Not a centroid: the centre of a crescent falls outside it. */
  interiorPointWkt: string;
  /** Any geometry covering the site; only its bounding box is kept. */
  extentWkt: string;
};

const wkt = new WKT();

/**
 * Turn sites into features ready for a vector source.
 *
 * Sites whose geometry cannot be read are logged and skipped rather than failing
 * the whole batch - one malformed record should not empty the map.
 */
export function natureAreasToFeatures(areas: NatureArea[]): Feature[] {
  const features: Feature[] = [];

  for (const area of areas) {
    try {
      const feature = new Feature(wkt.readGeometry(area.interiorPointWkt));
      feature.setId(area.id);
      feature.set(NATURE_AREA_NAME, area.name);
      feature.set(NATURE_AREA_AUTHORITY, area.authority);
      feature.set(NATURE_AREA_EXTENT, wkt.readGeometry(area.extentWkt).getExtent());
      features.push(feature);
    } catch (error) {
      // Unreadable geometry: skip this site, keep the rest. Loud, because a site
      // missing from the map is otherwise indistinguishable from one that is not
      // in the data at all.
      console.warn(`Skipping Natura 2000 site ${area.id}: geometry could not be read.`, error);
    }
  }

  return features;
}

/** The extent stored on a site feature, if it has one. */
export function natureAreaExtent(feature: FeatureLike | undefined): Extent | undefined {
  return feature?.get(NATURE_AREA_EXTENT) as Extent | undefined;
}

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

/**
 * Style for a Natura 2000 site point: a dot, or a labelled marker when hovered.
 *
 * Whether a feature counts as hovered is the caller's to decide, since that
 * lives in product state rather than on the feature.
 */
export function natureAreaPointStyle(feature: FeatureLike, hovered: boolean = false): Style | Style[] {
  return hovered ? hoverStyle(String(feature.get(NATURE_AREA_NAME) ?? "")) : defaultStyle;
}
