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
  background-color: var(--fame-white, #fff);
  display: flex;
  flex-direction: column;
  padding: var(--fame-spacing-8, 0.5rem);
}

.container.isOpen {
  background-color: var(--fame-main-content-background-color, #f2f4fe);
}

.container .header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-gap: var(--fame-spacing-8, 0.5rem);
  align-items: center;
  cursor: pointer;
  transition: all var(--anim, 0.2s);
}

.arrowIcon {
  color: var(--fame-dark-blue, #193884);
  transition: transform var(--anim, 0.2s);
  width: 18px;
}

.arrowIcon.open {
  transform: rotate(90deg);
  color: var(--fame-float-panel-background, #fff);
  background-color: var(--fame-float-panel-header-background, #193884);
  width: 13px;
  height: 13px;
  border: 3px solid var(--fame-float-panel-header-background, #193884);
  border-radius: 13px;
}
</style>
