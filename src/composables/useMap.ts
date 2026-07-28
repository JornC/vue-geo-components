import type Map from "ol/Map.js";
import { type InjectionKey, type ShallowRef, inject, provide } from "vue";

/**
 * Injection key for sharing the OpenLayers map with descendant components.
 * The value is a ref so descendants stay reactive: it is empty until the
 * MapView has mounted and created the map.
 */
export const mapInjectionKey: InjectionKey<ShallowRef<Map | undefined>> = Symbol("aerius-ol-map");

/** Provide the (ref-wrapped) OpenLayers map to descendants. Called by MapView during setup. */
export function provideMap(map: ShallowRef<Map | undefined>): void {
  provide(mapInjectionKey, map);
}

/**
 * Access the OpenLayers map ref provided by an ancestor MapView.
 * Throws when used outside of a MapView, so misuse fails loudly.
 */
export function useMap(): ShallowRef<Map | undefined> {
  const map = inject(mapInjectionKey, null);
  if (map === null) {
    throw new Error("useMap() must be used within a <MapView> component.");
  }
  return map;
}
