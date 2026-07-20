<script setup lang="ts">
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef } from "vue";

import { provideMap } from "../composables/useMap";
import { RD, registerRdProjection } from "../projections/rd";

const props = withDefaults(
  defineProps<{
    /** Map center, in the active projection. Defaults to the centre of the Netherlands in RD. */
    center?: [number, number];
    zoom?: number;
    /** Projection code for the view. Defaults to RD (EPSG:28992). */
    projection?: string;
  }>(),
  {
    center: () => [155000, 463000],
    zoom: 3,
    projection: RD,
  },
);

const emit = defineEmits<{
  ready: [map: Map];
}>();

const container = useTemplateRef<HTMLDivElement>("container");
const map = shallowRef<Map>();
let resizeObserver: ResizeObserver | undefined;

// Share the ref during setup so descendants can inject it; it fills in on mount.
provideMap(map);

onMounted(() => {
  registerRdProjection();

  const instance = new Map({
    target: container.value ?? undefined,
    layers: [new TileLayer({ source: new OSM() })],
    view: new View({
      projection: props.projection,
      center: props.center,
      zoom: props.zoom,
    }),
  });

  map.value = instance;
  emit("ready", instance);

  // The container can be 0-sized at mount (e.g. inside a panel that lays out
  // later); keep the map sized to it.
  resizeObserver = new ResizeObserver(() => instance.updateSize());
  if (container.value) resizeObserver.observe(container.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  map.value?.setTarget(undefined);
  map.value?.dispose();
});
</script>

<template>
  <div ref="container" class="aerius-map-view">
    <slot></slot>
  </div>
</template>

<style scoped>
.aerius-map-view {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 240px;
}
</style>
