<script setup lang="ts">
import CheckIcon from "./icons/CheckIcon.vue";
import MinusIcon from "./icons/MinusIcon.vue";

withDefaults(defineProps<{ enabled?: boolean }>(), { enabled: false });
</script>

<template>
  <check-icon v-if="enabled" />
  <minus-icon v-else />
</template>
