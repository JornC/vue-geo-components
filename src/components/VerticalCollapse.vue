<script setup lang="ts">
import { ref, watch } from "vue";

const props = withDefaults(defineProps<{ isOpen?: boolean }>(), { isOpen: false });

// Overflow has to stay hidden while the row height animates, or the content
// escapes the collapsing box; it is released once the transition has finished.
const overflowVisible = ref(props.isOpen);
let timeoutId: number | null = null;

watch(
  () => props.isOpen,
  () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (props.isOpen) {
      timeoutId = window.setTimeout(() => {
        overflowVisible.value = true;
      }, 100);
    } else {
      overflowVisible.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="grid" :class="{ open: isOpen, overflowVisible: overflowVisible }">
    <transition name="delayed-remove">
      <!-- Only hide the content, never remove it from the DOM, so its state survives a collapse. -->
      <div v-show="isOpen" class="grid-inner">
        <slot></slot>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.1s ease-out;
  overflow-y: hidden;
  overflow-x: auto;
}

.grid > *:empty {
  display: none;
}

.grid.open {
  grid-template-rows: 1fr;
}

.grid.overflowVisible > .grid-inner {
  overflow: visible !important;
}

.delayed-remove-enter-active,
.delayed-remove-leave-active {
  transition: opacity 0.1s;
}

.delayed-remove-enter,
.delayed-remove-leave-to {
  opacity: 0.99;
}
</style>
