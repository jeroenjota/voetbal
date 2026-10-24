<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, Link, Upload } from '@lucide/vue'
import { api, errorMessage } from '../api'
import type { PoolSummary, TournamentExport } from '../../shared/types'
import TaskStatus from './TaskStatus.vue'
import { useTask } from './useTask'

const props = defineProps<{ pool?: PoolSummary }>()
const emit = defineEmits<{ poolsChanged: [select?: number] }>()
const { busy, error, message, run } = useTask()

const data = ref<TournamentExport>()
const source = ref('')
const url = ref('')
const target = ref<'replace' | 'new'>(props.pool?.tournamentId ? 'replace' : 'new')

const summary = computed(() => data.value && [
  `${data.value.tournament.type} ${data.value.tournament.year}`,
  `${data.value.teams.length} teams`,
  `${new Set(data.value.groups.map((slot) => slot.letter)).size} groepen`,
  `${data.value.schedule.length} wedstrijden`,
  `${data.value.players.length} spelers`,
].join(' · '))

async function download() {
  const tournamentId = props.pool?.tournamentId
  if (!tournamentId) return
  const result = await run(() => api.exportTournament(tournamentId))
  if (!result) return
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `toernooi-${result.tournament.type}-${result.tournament.year}.json`.toLowerCase()
  link.click()
  URL.revokeObjectURL(link.href)
}

function accept(text: string, from: string) {
  try {
    const parsed = JSON.parse(text) as TournamentExport
    if (parsed?.format !== 'vbpool-tournament') throw new Error('Dit is geen toernooi-export (format "vbpool-tournament" ontbreekt).')
    data.value = parsed
    source.value = from
    error.value = ''
  } catch (cause) {
    data.value = undefined
    error.value = errorMessage(cause)
  }
}

async function readFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) accept(await file.text(), file.name)
}

async function fetchUrl() {
  const text = await run(async () => {
    const response = await fetch(url.value)
    if (!response.ok) throw new Error(`Ophalen mislukt (${response.status}).`)
    return response.text()
  })
  if (text !== undefined) accept(text, url.value)
}

async function importData() {
  if (!data.value) return
  const replace = target.value === 'replace' && props.pool?.tournamentId
  if (replace && !window.confirm('Groepen, wedstrijdschema en (indien aanwezig in het bestand) spelers van het huidige toernooi worden vervangen. Doorgaan?')) return
  const result = await run(() => api.importTournament(data.value!, replace ? props.pool!.tournamentId! : undefined),
    replace ? 'Toernooi bijgewerkt.' : 'Nieuw toernooi aangemaakt. Koppel het aan een pool via ‘Pool & toernooi’.')
  if (result) {
    data.value = undefined
    emit('poolsChanged')
  }
}
</script>

<template>
  <section class="admin-section">
    <TaskStatus :error="error" :message="message" />
    <div class="admin-card">
      <h2>Exporteren</h2>
      <p class="admin-muted">Download toernooi, groepen, wedstrijdschema en spelers als JSON, bijvoorbeeld als sjabloon voor een volgend toernooi.</p>
      <button class="primary-button" :disabled="busy || !pool?.tournamentId" @click="download"><Download :size="15" />Download {{ pool?.tournamentLabel ?? '' }}</button>
    </div>

    <div class="admin-card">
      <h2>Importeren</h2>
      <p class="admin-muted">
        Lees een toernooi in vanuit een JSON-bestand in hetzelfde formaat als de export. Zodra het officiële schema bekend is kan dit
        ook vanaf een website of API, mits die JSON in dit formaat levert (en ophalen vanuit de browser toestaat).
      </p>
      <div class="admin-grid">
        <label class="span-2">Bestand <input type="file" accept="application/json,.json" @change="readFile"></label>
        <label class="span-2">Of URL
          <span class="admin-inline">
            <input v-model="url" type="url" placeholder="https://…/toernooi.json">
            <button class="secondary-button" :disabled="busy || !url" @click="fetchUrl"><Link :size="15" />Ophalen</button>
          </span>
        </label>
      </div>
      <template v-if="data">
        <p><b>{{ source }}</b>: {{ summary }}</p>
        <fieldset class="admin-radio">
          <label><input v-model="target" type="radio" value="new"> Als nieuw toernooi</label>
          <label><input v-model="target" type="radio" value="replace" :disabled="!pool?.tournamentId"> Huidig toernooi vervangen ({{ pool?.tournamentLabel ?? '—' }})</label>
        </fieldset>
        <button class="primary-button" :disabled="busy" @click="importData"><Upload :size="15" />Importeren</button>
      </template>
    </div>
  </section>
</template>
