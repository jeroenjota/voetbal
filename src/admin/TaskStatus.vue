<script setup lang="ts">
defineProps<{ error: string; message: string }>()
</script>

<template>
  <div v-if="error" class="error-notice" role="alert">{{ error }}</div>
  <div v-else-if="message" class="success-notice" role="status">{{ message }}</div>
</template>
