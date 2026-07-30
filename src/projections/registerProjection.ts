import { get as getProjection } from "ol/proj.js";
import { register } from "ol/proj/proj4.js";
import proj4 from "proj4";

import type { GeoInformation } from "../layers/types";

type ProjectionInfo = Pick<GeoInformation, "epsgCode" | "extent" | "projection">;

const registeredEpsgCodes = new Set<string>();

/**
 * Register a projection's proj4 definition and extent with proj4 and OpenLayers.
 * Safe to call more than once for the same EPSG code; only the first call does work.
 */
export function registerProjection(geo: ProjectionInfo): void {
  if (registeredEpsgCodes.has(geo.epsgCode)) {
    return;
  }
  proj4.defs(geo.epsgCode, geo.projection);
  register(proj4);
  // The extent is needed for tile-grid resolutions and for reprojecting raster sources into this
  // projection. Copied because setExtent stores the array by reference, and callers likely pass a
  // shared constant, which OpenLayers would then be able to mutate out from under them.
  getProjection(geo.epsgCode)?.setExtent([...geo.extent]);
  registeredEpsgCodes.add(geo.epsgCode);
}

/** Returns true once {@link registerProjection} has made `epsgCode` available to OpenLayers. */
export function isProjectionRegistered(epsgCode: string): boolean {
  return registeredEpsgCodes.has(epsgCode) && getProjection(epsgCode) !== null;
}
