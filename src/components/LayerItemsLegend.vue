<script setup lang="ts">
import { LegendIconType } from "../layers/types";
import HexagonIcon from "./icons/HexagonIcon.vue";
import type { LegendDisplay } from "./legendDisplay";

defineProps<{ legend: LegendDisplay }>();
</script>

<template>
  <div class="legend-list">
    <div v-if="legend.title" data-id="maplayer-item-legend-title">{{ legend.title }}</div>
    <div v-for="item in legend.items" :key="item.key" class="legend-item" :data-id="`maplayer-item-legend-items-container-${item.key}`">
      <hexagon-icon
        v-if="legend.iconType === LegendIconType.HEXAGON"
        class="hexagon-icon"
        :style="{ '--hexagon-color': item.color }"
        :data-id="`maplayer-item-legend-item-hexagon-icon-${item.key}`" />
      <div v-else class="circle-icon" :style="{ backgroundColor: item.color }" :data-id="`maplayer-item-legend-item-circle-icon-${item.key}`"></div>
      <span class="legend-label" :data-id="`maplayer-item-legend-item-label-${item.key}`">{{ item.label }}</span>
    </div>
    <div v-if="legend.explainer" class="legend-explainer" data-id="maplayer-item-legend-explainer">{{ legend.explainer }}</div>
  </div>
</template>

<style scoped>
.legend-list {
  margin: var(--geo-spacing, 0.5rem) 0;
  display: flex;
  flex-direction: column;
  gap: var(--geo-spacing, 0.5rem);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--geo-spacing, 0.5rem);
}

.hexagon-icon {
  width: 20px;
  height: 20px;
  --outline-color: var(--geo-accent, #333);
  overflow: visible;
}

.circle-icon {
  width: 20px;
  height: 20px;
  display: inline-block;
  border-radius: 50%;
}

.legend-explainer {
  max-width: 300px;
}
</style>
