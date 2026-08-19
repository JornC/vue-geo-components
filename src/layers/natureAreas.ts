import Feature from "ol/Feature.js";
import WKT from "ol/format/WKT.js";

/**
 * Natura 2000 sites as point features.
 *
 * A site becomes one point carrying its name and its bounding box, never its own boundary:
 * a product that needs outlines fetches the polygons itself.
 */

/** Feature property holding a site's extent, as written by {@link natureAreasToFeatures}. */
export const NATURE_AREA_EXTENT = "extent";

/** Feature property holding a site's name. */
export const NATURE_AREA_NAME = "name";

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
  /** Point the site is drawn at. Not a centroid: the centre of a crescent falls outside it. */
  interiorPointWkt: string;
  /** Any geometry covering the site; only its bounding box is kept. */
  extentWkt: string;
};

const wkt = new WKT();

/**
 * Turn sites into features ready for a vector source.
 *
 * A site whose geometry cannot be read is skipped rather than costing the whole batch.
 */
export function natureAreasToFeatures(areas: NatureArea[]): Feature[] {
  const features: Feature[] = [];

  for (const area of areas) {
    try {
      const feature = new Feature(wkt.readGeometry(area.interiorPointWkt));
      feature.setId(area.id);
      feature.set(NATURE_AREA_NAME, area.name);
      feature.set(NATURE_AREA_EXTENT, wkt.readGeometry(area.extentWkt).getExtent());
      features.push(feature);
    } catch (error) {
      // Loud, because a site dropped here is otherwise indistinguishable from one
      // that is not in the data at all.
      console.warn(`Skipping Natura 2000 site ${area.id}: geometry could not be read.`, error);
    }
  }

  return features;
}
