<script setup lang="ts">
import type { Field } from '../pool'

defineProps<{ field: Field; modelValue: string; disabled?: boolean; compact?: boolean }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <label :class="['entry-field', { compact }]">
    <span :class="{ 'sr-only': compact }">{{ field.label }}</span>
    <select v-if="field.kind === 'toto' || field.kind === 'position'" :value="modelValue" :disabled="disabled" @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)">
      <option value="">—</option>
      <template v-if="field.kind === 'toto'"><option value="1">1</option><option value="2">2</option><option value="3">3</option></template>
      <template v-else><option v-for="position in 4" :key="position" :value="position">{{ position }}</option></template>
    </select>
    <input v-else :value="modelValue" :type="field.kind === 'number' ? 'number' : field.kind === 'email' ? 'email' : field.kind === 'tel' ? 'tel' : 'text'" :min="field.min" :max="field.max" :step="field.kind === 'number' ? 1 : undefined" :maxlength="120" :list="field.kind === 'team' ? 'team-suggestions' : undefined" :placeholder="field.kind === 'team' ? 'Land of teamplek' : compact ? '–' : ''" :disabled="disabled" :inputmode="field.kind === 'number' ? 'numeric' : undefined" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" />
  </label>
</template>
