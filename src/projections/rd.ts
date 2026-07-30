import { isProjectionRegistered, registerProjection } from "./registerProjection";

/** Amersfoort / RD New - the Dutch national projection used across AERIUS. */
export const RD = "EPSG:28992";

export const RD_PROJ4_DEFINITION =
  "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 " +
  "+k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel " +
  "+towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs";

/** Extent of the RD grid, in RD coordinates. */
export const RD_EXTENT = [-285401.92, 22598.08, 595401.92, 903401.92];

/**
 * Register the RD (EPSG:28992) projection with proj4 and OpenLayers.
 * Safe to call more than once; only the first call does work.
 */
export function registerRdProjection(): void {
  registerProjection({ epsgCode: RD, extent: RD_EXTENT, projection: RD_PROJ4_DEFINITION });
}

/** Returns true once {@link registerRdProjection} has made RD available to OpenLayers. */
export function isRdRegistered(): boolean {
  return isProjectionRegistered(RD);
}
