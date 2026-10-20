<script setup lang="ts">
import { computed } from 'vue'
import { STAGES, type Stage } from '../../lib/crm'

const props = defineProps<{ stage: Stage }>()
const info = computed(() => STAGES.find((s) => s.value === props.stage))
</script>

<template>
  <span class="inline-block whitespace-nowrap border border-transparent px-2.5 py-1 text-xs font-medium" :class="info?.cls">{{ info?.label ?? stage }}</span>
</template>
