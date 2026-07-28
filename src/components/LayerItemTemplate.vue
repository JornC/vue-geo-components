<script setup lang="ts">
import { computed } from "vue";

import LayerItemsLegend from "./LayerItemsLegend.vue";
import type { LegendDisplay } from "./legendDisplay";
import SimpleFoldout from "./SimpleFoldout.vue";
import ToggleIcon from "./ToggleIcon.vue";

const props = defineProps<{
  enabled: boolean;
  /** 0 to 1, matching OpenLayers. */
  opacity: number;
  legend?: LegendDisplay;
}>();

const emit = defineEmits<{
  /** No payload: the consumer owns the visibility state. */
  toggle: [];
  opacity: [value: number];
}>();

const opacityModel = computed({
  get: () => props.opacity,
  set: (newValue) => emit("opacity", Number(newValue)),
});
</script>

<template>
  <simple-foldout>
    <template #header>
      <slot name="header"></slot>
      <toggle-icon :enabled="enabled" data-id="maplayer-item-show-icon" @click="emit('toggle')" />
    </template>
    <div>
      <div class="slider-container">
        <input v-model="opacityModel" class="slider" type="range" min="0" max="1" step="0.01" data-id="maplayer-item-opacity-slider" />
      </div>
      <layer-items-legend v-if="legend" :legend="legend" />
    </div>
  </simple-foldout>
</template>

<style scoped>
.slider-container {
  margin-top: 10px;
}
</style>
