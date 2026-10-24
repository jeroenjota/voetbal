<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Save } from '@lucide/vue'
import { api } from '../api'
import { NUMBER_CATEGORY, POINT_CATEGORIES } from '../../shared/types'
import type { PointSetting, PoolSummary } from '../../shared/types'
import TaskStatus from './TaskStatus.vue'
import { useTask } from './useTask'

const props = defineProps<{ pool: PoolSummary }>()
const { busy, error, message, run } = useTask()
const points = ref<PointSetting[]>([])

const grouped = computed(() => {
  const ids = [...new Set(points.value.map((point) => point.category))].sort((a, b) => a - b)
  return ids.map((category) => ({
    category,
    label: category === NUMBER_CATEGORY ? `${POINT_CATEGORIES[category]} (marge = toegestane afwijking)` : POINT_CATEGORIES[category] ?? `Categorie ${category}`,
    items: points.value.filter((point) => point.category === category).sort((a, b) => a.listOrder - b.listOrder),
  }))
})

async function load() {
  await run(async () => { points.value = await api.points(props.pool.id) })
}

async function save() {
  await run(() => api.savePoints(props.pool.id, points.value), 'Puntentoekening opgeslagen.')
}

onMounted(load)
</script>

<template>
  <section class="admin-section">
    <TaskStatus :error="error" :message="message" />
    <div class="admin-card">
      <div class="admin-card-head">
        <h2>Puntentoekening – {{ pool.name }}</h2>
        <button class="primary-button" :disabled="busy" @click="save"><Save :size="15" />Opslaan</button>
      </div>
      <p class="admin-muted">Uitgeschakelde onderdelen verdwijnen van het formulier. De punten worden op pagina 2 van het formulier vermeld.</p>
      <div class="admin-points">
        <fieldset v-for="group in grouped" :key="group.category" class="admin-group">
          <legend>{{ group.label }}</legend>
          <table class="admin-table">
            <thead><tr><th>Actief</th><th>Onderdeel</th><th>Punten</th><th v-if="group.category === NUMBER_CATEGORY">Marge</th></tr></thead>
            <tbody>
              <tr v-for="point in group.items" :key="point.typeId" :class="{ 'admin-disabled': !point.enabled }">
                <td><input v-model="point.enabled" type="checkbox" :aria-label="`${point.description} actief`"></td>
                <td>{{ point.description }}</td>
                <td><input v-model.number="point.points" type="number" min="0" max="1000" class="narrow" :aria-label="`Punten ${point.description}`"></td>
                <td v-if="group.category === NUMBER_CATEGORY"><input v-model.number="point.margin" type="number" min="0" max="100" class="narrow" :aria-label="`Marge ${point.description}`"></td>
              </tr>
            </tbody>
          </table>
        </fieldset>
      </div>
    </div>
  </section>
</template>
