<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft, CalendarDays, FileDown, FileText, Medal, Settings, Shirt, Upload, Users,
} from '@lucide/vue'
import { api, errorMessage } from '../api'
import type { PoolSummary } from '../../shared/types'
import PoolTab from './PoolTab.vue'
import TeamsTab from './TeamsTab.vue'
import PlayersTab from './PlayersTab.vue'
import ScheduleTab from './ScheduleTab.vue'
import PointsTab from './PointsTab.vue'
import ParticipantsTab from './ParticipantsTab.vue'
import FormTab from './FormTab.vue'
import ImportTab from './ImportTab.vue'
import './admin.css'

const tabs = [
  { id: 'pool', label: 'Pool & toernooi', icon: Settings, component: PoolTab, needsTournament: false },
  { id: 'teams', label: 'Teams & groepen', icon: Shirt, component: TeamsTab, needsTournament: true },
  { id: 'spelers', label: 'Spelers', icon: Users, component: PlayersTab, needsTournament: true },
  { id: 'schema', label: 'Wedstrijdschema', icon: CalendarDays, component: ScheduleTab, needsTournament: true },
  { id: 'punten', label: 'Puntentoekening', icon: Medal, component: PointsTab, needsTournament: false },
  { id: 'deelnemers', label: 'Deelnemers', icon: FileText, component: ParticipantsTab, needsTournament: true },
  { id: 'formulier', label: 'Formulier / PDF', icon: FileDown, component: FormTab, needsTournament: true },
  { id: 'import', label: 'Import / export', icon: Upload, component: ImportTab, needsTournament: false },
] as const

const route = useRoute()
const router = useRouter()
const pools = ref<PoolSummary[]>([])
const poolId = ref<number>()
const loaded = ref(false)
const error = ref('')

const tab = computed(() => tabs.find((item) => item.id === route.params.tab) ?? tabs[0])
const pool = computed(() => pools.value.find((item) => item.id === poolId.value))
const ready = computed(() => ['pool', 'import'].includes(tab.value.id) || (pool.value && (!tab.value.needsTournament || pool.value.tournamentId)))
const tabProps = computed(() => (tab.value.id === 'pool' ? { pool: pool.value, pools: pools.value } : { pool: pool.value }))

async function loadPools(select?: number) {
  try {
    pools.value = await api.pools()
    const stored = Number(window.localStorage.getItem('vbpool:admin:pool'))
    const wanted = select ?? poolId.value ?? stored
    poolId.value = pools.value.find((item) => item.id === wanted)?.id ?? pools.value.find((item) => item.active)?.id ?? pools.value.at(-1)?.id
    error.value = ''
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    loaded.value = true
  }
}

watch(poolId, (id) => { if (id) window.localStorage.setItem('vbpool:admin:pool', String(id)) })
onMounted(() => {
  document.title = 'Beheer – voetbalpool'
  loadPools()
})
</script>

<template>
  <div class="admin">
    <header class="admin-header">
      <RouterLink to="/" class="admin-back"><ArrowLeft :size="16" /> Site</RouterLink>
      <h1>Beheer voetbalpool</h1>
      <label v-if="pools.length" class="admin-pool-select">
        <span>Pool</span>
        <select v-model.number="poolId">
          <option v-for="item in pools" :key="item.id" :value="item.id">{{ item.name }} ({{ item.tournamentLabel }}){{ item.active ? ' – actief' : '' }}</option>
        </select>
      </label>
    </header>
    <nav class="admin-tabs" aria-label="Beheeronderdelen">
      <button v-for="item in tabs" :key="item.id" :class="{ active: tab.id === item.id }" :aria-current="tab.id === item.id ? 'page' : undefined" @click="router.push(`/beheer/${item.id}`)">
        <component :is="item.icon" :size="16" />{{ item.label }}
      </button>
    </nav>
    <main class="admin-main">
      <div v-if="error" class="error-notice" role="alert">{{ error }}</div>
      <p class="admin-warning">Let op: het beheer heeft (nog) geen inlog. Laat de server daarom alleen lokaal luisteren (HOST=127.0.0.1).</p>
      <component
        :is="tab.component" v-if="ready" :key="`${tab.id}-${pool?.id ?? 'nieuw'}-${pool?.tournamentId ?? ''}`"
        v-bind="tabProps"
        @pools-changed="loadPools"
      />
      <p v-else-if="loaded && !error && !pool" class="admin-muted">Er is nog geen pool. Maak er eerst een aan via ‘Pool &amp; toernooi’.</p>
      <p v-else-if="loaded && !error" class="admin-muted">Koppel eerst een toernooi aan deze pool via ‘Pool &amp; toernooi’.</p>
    </main>
  </div>
</template>
