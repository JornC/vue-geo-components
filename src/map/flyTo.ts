import { interpolateZoom } from "d3-interpolate";
import type { Coordinate } from "ol/coordinate.js";
import type Map from "ol/Map.js";
import type View from "ol/View.js";

/**
 * Smooth pan-and-zoom for an OpenLayers view using the van Wijk & Nuij (2003)
 * "Smooth and efficient zooming and panning" path. A single coupled trajectory
 * pulls back, sweeps across, and zooms in along one continuous arc with constant
 * perceived velocity - no midpoint stop, no hand-tuned intermediate zoom.
 *
 * Create one controller per view and call `flyTo` as needed; each call cancels
 * the previous flight.
 */

export interface FlyTarget {
  center: Coordinate;
  zoom: number;
}

export interface FlyOptions {
  /**
   * Path curvature (van Wijk's rho). Higher zooms out farther / arcs more
   * dramatically; lower is flatter and more direct. The paper's "least effort"
   * optimum is sqrt(2) ~= 1.41; we pull back farther by default.
   */
  rho?: number;
  /** Multiplier on the algorithm's recommended duration. >1 is slower. */
  speedFactor?: number;
  /** Lower and upper bounds (ms) on the flight duration. */
  minDuration?: number;
  maxDuration?: number;
}

const DEFAULTS: Required<FlyOptions> = {
  rho: 1.7,
  speedFactor: 1.5,
  minDuration: 500,
  maxDuration: 2400,
};

export interface FlyController {
  /** Fly the view to the given center/zoom. Cancels any in-flight animation. */
  flyTo(target: FlyTarget): void;
  /** Stop the current flight, if any. */
  cancel(): void;
}

const mapFlights = new WeakMap<Map, FlyController>();

export function mapFlightFor(map: Map): FlyController {
  let flight = mapFlights.get(map);
  if (!flight) {
    flight = createMapFlyTo(map.getView(), map);
    mapFlights.set(map, flight);
  }
  return flight;
}

type ZoomView = [number, number, number];
type RhoZoomFactory = (a: ZoomView, b: ZoomView) => ((t: number) => ZoomView) & { duration: number };

// At runtime `.rho` is a static on interpolateZoom that returns a curvature-tuned
// factory. @types/d3-interpolate mistakenly places `rho` on the interpolator
// result instead, so reach for it through a narrow cast.
const tunedZoomFactory = (rho: number): RhoZoomFactory => (interpolateZoom as unknown as { rho(rho: number): RhoZoomFactory }).rho(rho);

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

const prefersReducedMotion = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export function createMapFlyTo(view: View, map: Map, options: FlyOptions = {}): FlyController {
  const { rho, speedFactor, minDuration, maxDuration } = { ...DEFAULTS, ...options };
  const zoom = tunedZoomFactory(rho);

  let rafId: number | null = null;
  let activeTarget: FlyTarget | null = null;

  const cancel = (): void => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    activeTarget = null;
  };

  const flyTo = (target: FlyTarget): void => {
    const size = map.getSize();
    const startCenter = view.getCenter();
    const startResolution = view.getResolution();
    if (!size || !startCenter || startResolution === undefined) {
      return;
    }

    const widthPx = size[0];
    const startX = startCenter[0];
    const startY = startCenter[1];
    const targetX = target.center[0];
    const targetY = target.center[1];
    if (widthPx === undefined || startX === undefined || startY === undefined || targetX === undefined || targetY === undefined) {
      return;
    }

    const targetResolution = view.getResolutionForZoom(target.zoom);

    // van Wijk operates on viewport WIDTH (linear in world units), not zoom
    // (logarithmic). w = resolution * map width in pixels.
    const p0: ZoomView = [startX, startY, startResolution * widthPx];
    const p1: ZoomView = [targetX, targetY, targetResolution * widthPx];

    if (p0[0] === p1[0] && p0[1] === p1[1] && p0[2] === p1[2]) {
      return; // already there
    }

    if (activeTarget?.center[0] === targetX && activeTarget.center[1] === targetY && activeTarget.zoom === target.zoom) {
      return;
    }

    cancel();
    view.cancelAnimations();

    if (prefersReducedMotion()) {
      view.setCenter([targetX, targetY]);
      view.setResolution(targetResolution);
      return;
    }

    const path = zoom(p0, p1);
    const duration = Math.min(maxDuration, Math.max(minDuration, path.duration * speedFactor));
    activeTarget = { center: [targetX, targetY], zoom: target.zoom };

    let startTime: number | null = null;
    const step = (now: number): void => {
      startTime ??= now;
      const t = Math.min(1, (now - startTime) / duration);
      // smoothstep softens the start/stop only; the spatial arc stays optimal.
      const [cx, cy, w] = path(smoothstep(t));
      view.setCenter([cx, cy]);
      view.setResolution(w / widthPx);
      rafId = t < 1 ? requestAnimationFrame(step) : null;
      if (rafId === null) {
        activeTarget = null;
      }
    };
    rafId = requestAnimationFrame(step);
  };

  return { flyTo, cancel };
}
