<script setup lang="ts">
import { ref } from "vue";

import ChevronRightIcon from "./icons/ChevronRightIcon.vue";
import VerticalCollapse from "./VerticalCollapse.vue";

const isOpen = ref(false);
</script>

<template>
  <div class="container" :class="{ isOpen }">
    <div class="header">
      <chevron-right-icon class="arrowIcon" :class="{ open: isOpen }" data-id="foldout-open-icon" @click="isOpen = !isOpen" />
      <slot name="header"></slot>
    </div>
    <vertical-collapse :is-open="isOpen"><slot></slot></vertical-collapse>
  </div>
</template>

<style scoped>
.container {
  background-color: var(--geo-surface, #fff);
  display: flex;
  flex-direction: column;
  padding: var(--geo-spacing, 0.5rem);
}

.container.isOpen {
  background-color: var(--geo-surface-raised, #f4f4f6);
}

.container .header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-gap: var(--geo-spacing, 0.5rem);
  align-items: center;
  cursor: pointer;
  transition: all var(--geo-anim, 0.2s);
}

.arrowIcon {
  color: var(--geo-accent, #333);
  transition: transform var(--geo-anim, 0.2s);
  width: 18px;
}

.arrowIcon.open {
  transform: rotate(90deg);
  color: var(--geo-on-accent, #fff);
  background-color: var(--geo-accent, #333);
  width: 13px;
  height: 13px;
  border: 3px solid var(--geo-accent, #333);
  border-radius: 13px;
}
</style>
