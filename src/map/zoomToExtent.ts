import type { Coordinate } from "ol/coordinate.js";
import type { Extent } from "ol/extent.js";
import type Map from "ol/Map.js";
import type View from "ol/View.js";

import { extentCorners, sizeOf, type Corners } from "./extent";
import { createMapFlyTo, type FlyController } from "./flyTo";

/** Assumed viewport when the map has not been sized yet. */
const DEFAULT_MAP_SIZE = { width: 800, height: 600 };

/** Zoom bounds for a fitted extent. */
const MIN_ZOOM = 3;
const MAX_ZOOM = 14;

/** Fraction of the viewport kept clear around a fitted extent. */
const VIEWPORT_PADDING = 0.1;
const EXTENT_PADDING = 0.2;

/** Extents smaller than this in either direction just go to {@link MAX_ZOOM}. */
const MIN_MEANINGFUL_EXTENT = 100;

type MapFlightState = {
  controller: FlyController;
  lastCenter: Coordinate | null;
  lastZoom: number | null;
};

// Per map, so each map cancels only its own flight and remembers only its own
// last target. Weak so nothing here keeps a discarded map alive.
const flights = new WeakMap<Map, MapFlightState>();

function flightStateFor(map: Map): MapFlightState {
  let state = flights.get(map);
  if (!state) {
    state = { controller: createMapFlyTo(map.getView(), map), lastCenter: null, lastZoom: null };
    flights.set(map, state);
  }
  return state;
}

/**
 * Fly the map so a given extent fills the view, leaving a margin around it.
 *
 * Repeating the same extent is a no-op, so this is safe to call from a watcher
 * that fires more often than the target actually changes.
 */
export function zoomToExtent(map: Map, extent: Extent): void {
  const view = map?.getView();
  const corners = extentCorners(extent);
  if (!map || !view || !corners) {
    return;
  }

  const startZoom = view.getZoom();
  if (startZoom === undefined) {
    return;
  }

  const targetCenter: Coordinate = [(corners.minX + corners.maxX) / 2, (corners.minY + corners.maxY) / 2];
  const size = sizeOf(map.getSize()) ?? DEFAULT_MAP_SIZE;
  const targetZoom = zoomForExtent(view, corners, size, startZoom);
  if (!Number.isFinite(targetZoom)) {
    return;
  }

  const state = flightStateFor(map);
  if (state.lastCenter?.[0] === targetCenter[0] && state.lastCenter?.[1] === targetCenter[1] && state.lastZoom === targetZoom) {
    return;
  }

  state.lastCenter = targetCenter;
  state.lastZoom = targetZoom;
  state.controller.flyTo({ center: targetCenter, zoom: targetZoom });
}

function zoomForExtent(view: View, corners: Corners, size: { width: number; height: number }, startZoom: number): number {
  const width = corners.maxX - corners.minX;
  const height = corners.maxY - corners.minY;

  if (width < MIN_MEANINGFUL_EXTENT || height < MIN_MEANINGFUL_EXTENT) {
    return MAX_ZOOM;
  }

  const padded: Extent = [
    corners.minX - width * EXTENT_PADDING,
    corners.minY - height * EXTENT_PADDING,
    corners.maxX + width * EXTENT_PADDING,
    corners.maxY + height * EXTENT_PADDING,
  ];
  const visible: [number, number] = [size.width * (1 - VIEWPORT_PADDING * 2), size.height * (1 - VIEWPORT_PADDING * 2)];

  const resolution = view.getResolutionForExtent(padded, visible);
  if (!resolution) {
    return Math.min(startZoom + 2, MAX_ZOOM);
  }

  // ?? rather than ||: zoom 0 is a real zoom, and || would turn the widest
  // possible view into the narrowest one.
  return Math.max(Math.min(view.getZoomForResolution(resolution) ?? MAX_ZOOM, MAX_ZOOM), MIN_ZOOM);
}
