<script setup lang="ts">
import type { ColorRangesLegendProps } from "../layers/types";

defineProps<{ colorRangesLegend: ColorRangesLegendProps }>();

// An open-ended range is labelled with the bound it does have.
const formatLabel = (range: number[] | undefined) => {
  if (!range) {
    return "";
  }
  if (range[0] === Number.MIN_VALUE) {
    return `< ${range[1]}`;
  }
  if (range[1] === Number.MAX_VALUE) {
    return `> ${range[0]}`;
  }
  return range.join(" - ");
};
</script>

<template>
  <div class="legend-list">
    <div v-for="range in colorRangesLegend.colorRanges" :key="range.color" class="legend-item">
      <div class="color-range" :style="{ backgroundColor: range.color }"></div>
      <span class="legend-label">{{ formatLabel(range.labelValues) }}</span>
    </div>
  </div>
</template>

<style scoped>
.legend-list {
  margin: var(--fame-spacing-8, 0.5rem) 0;
  display: flex;
  flex-direction: column;
  gap: var(--fame-spacing-8, 0.5rem);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--fame-spacing-8, 0.5rem);
}

.color-range {
  width: 20px;
  height: 20px;
  display: inline-block;
  border-radius: 50%;
}
</style>
