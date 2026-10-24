<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, Save, Star } from '@lucide/vue'
import { api } from '../api'
import type { Country, PoolSettings, PoolSummary, Tournament } from '../../shared/types'
import TaskStatus from './TaskStatus.vue'
import { emptyToNull, useTask } from './useTask'

const props = defineProps<{ pool?: PoolSummary; pools: PoolSummary[] }>()
const emit = defineEmits<{ poolsChanged: [select?: number] }>()

const { busy, error, message, run } = useTask()
const tournaments = ref<(Tournament & { id: number })[]>([])
const countries = ref<Country[]>([])
const poolForm = ref<PoolSettings>(newPool())
const tournamentForm = ref<Tournament>(newTournament())
const tournamentId = ref<number | null>(null)

const percentTotal = computed(() => poolForm.value.prizePercentages.reduce((sum, value) => sum + (Number(value) || 0), 0))
const percentLabels = ['1e prijs', '2e prijs', '3e prijs', '4e prijs']

function newPool(): PoolSettings {
  return {
    tournamentId: null, name: '', formsFrom: null, formsTill: null, cost: 10,
    prizeHighDayScore: 0, prizeHighDayPosition: 0, prizeLowDayPosition: 0, prizeLowFinalPosition: 0,
    prizePercentages: [50, 30, 15, 5],
  }
}

function newTournament(): Tournament {
  return { year: new Date().getFullYear(), type: 'EK', locationId: null, teamCount: 24, groupCount: 6, startDate: null, endDate: null, thirdPlace: false }
}

async function load() {
  await run(async () => {
    ;[tournaments.value, countries.value] = await Promise.all([api.tournaments(), api.countries()])
    if (props.pool) {
      const { id: _id, ...settings } = await api.pool(props.pool.id)
      poolForm.value = settings
    } else {
      poolForm.value = newPool()
      poolForm.value.tournamentId = tournaments.value.at(-1)?.id ?? null
    }
    selectTournament(poolForm.value.tournamentId)
  })
}

function selectTournament(id: number | null) {
  tournamentId.value = id
  const found = tournaments.value.find((item) => item.id === id)
  if (found) {
    const { id: _id, ...plain } = found
    tournamentForm.value = { ...plain }
  } else {
    tournamentForm.value = newTournament()
  }
}

function startNewPool() {
  poolForm.value = { ...newPool(), tournamentId: poolForm.value.tournamentId }
  creatingPool.value = true
}

const creatingPool = ref(!props.pool)

async function savePool() {
  const settings: PoolSettings = {
    ...poolForm.value,
    name: poolForm.value.name.trim(),
    formsFrom: emptyToNull(poolForm.value.formsFrom),
    formsTill: emptyToNull(poolForm.value.formsTill),
    prizePercentages: poolForm.value.prizePercentages.map(Number) as PoolSettings['prizePercentages'],
  }
  const result = await run(async () => (creatingPool.value || !props.pool
    ? api.createPool(settings)
    : api.savePool(props.pool.id, settings)), 'Pool opgeslagen.')
  if (result) {
    creatingPool.value = false
    emit('poolsChanged', result.id)
  }
}

async function setActive() {
  if (!props.pool) return
  if (await run(() => api.setActivePool(props.pool!.id), `“${props.pool.name}” is nu de actieve pool (online formulier en site).`)) emit('poolsChanged', props.pool.id)
}

async function saveTournament() {
  const data: Tournament = {
    ...tournamentForm.value,
    type: tournamentForm.value.type.trim(),
    startDate: emptyToNull(tournamentForm.value.startDate),
    endDate: emptyToNull(tournamentForm.value.endDate),
  }
  const created = !tournamentId.value
  const result = await run(async () => (tournamentId.value ? api.saveTournament(tournamentId.value, data) : api.createTournament(data)),
    created ? 'Toernooi aangemaakt. Kies het bij een pool en sla die op om het te gebruiken.' : 'Toernooi opgeslagen.')
  if (!result) return
  tournaments.value = await api.tournaments()
  tournamentId.value = result.id
  if (created && (creatingPool.value || !poolForm.value.tournamentId)) poolForm.value.tournamentId = result.id
  emit('poolsChanged')
}

function startNewTournament() {
  selectTournament(null)
}

onMounted(load)
</script>

<template>
  <section class="admin-section">
    <TaskStatus :error="error" :message="message" />

    <div class="admin-card">
      <div class="admin-card-head">
        <h2>{{ creatingPool ? 'Nieuwe pool' : 'Pool' }}</h2>
        <div class="admin-actions">
          <button v-if="pool && !creatingPool && !pool.active" class="secondary-button" :disabled="busy" @click="setActive"><Star :size="15" />Maak actief</button>
          <span v-else-if="pool?.active && !creatingPool" class="admin-badge">Actieve pool</span>
          <button v-if="!creatingPool" class="secondary-button" :disabled="busy" @click="startNewPool"><Plus :size="15" />Nieuwe pool</button>
          <button v-else-if="pool" class="secondary-button" :disabled="busy" @click="creatingPool = false; load()">Annuleren</button>
        </div>
      </div>
      <form class="admin-grid" @submit.prevent="savePool">
        <label class="span-2">Naam <input v-model="poolForm.name" required maxlength="50" placeholder="bijv. Cafe De Gouden Leeuw"></label>
        <label class="span-2">Toernooi
          <select v-model.number="poolForm.tournamentId" required>
            <option :value="null" disabled>Kies een toernooi</option>
            <option v-for="item in tournaments" :key="item.id" :value="item.id">{{ item.type }} {{ item.year }}</option>
          </select>
        </label>
        <label>Inschrijven vanaf <input v-model="poolForm.formsFrom" type="date"></label>
        <label>Inleveren uiterlijk <input v-model="poolForm.formsTill" type="date"></label>
        <label>Inleg (€) <input v-model.number="poolForm.cost" type="number" min="0" step="0.5" required></label>
        <span />
        <label>Hoogste dagscore (€) <input v-model.number="poolForm.prizeHighDayScore" type="number" min="0" step="0.5"></label>
        <label>Hoogste dagpositie (€) <input v-model.number="poolForm.prizeHighDayPosition" type="number" min="0" step="0.5"></label>
        <label>Laagste dagpositie (€) <input v-model.number="poolForm.prizeLowDayPosition" type="number" min="0" step="0.1"></label>
        <label>Rode lantaarn (€) <input v-model.number="poolForm.prizeLowFinalPosition" type="number" min="0" step="0.5"></label>
        <label v-for="(label, index) in percentLabels" :key="label">{{ label }} (% van de pot)
          <input v-model.number="poolForm.prizePercentages[index]" type="number" min="0" max="100" required>
        </label>
        <p class="span-4 admin-muted" :class="{ 'admin-warn-text': percentTotal !== 100 }">Totaal prijzen: {{ percentTotal }}%{{ percentTotal !== 100 ? ' (meestal 100%)' : '' }}. Bedragen van 0 worden niet op het formulier getoond.</p>
        <div class="span-4 admin-actions">
          <button class="primary-button" :disabled="busy"><Save :size="15" />{{ creatingPool ? 'Pool aanmaken' : 'Pool opslaan' }}</button>
        </div>
      </form>
    </div>

    <div class="admin-card">
      <div class="admin-card-head">
        <h2>Toernooi</h2>
        <div class="admin-actions">
          <select :value="tournamentId ?? ''" aria-label="Toernooi bewerken" @change="selectTournament(Number(($event.target as HTMLSelectElement).value) || null)">
            <option value="">— nieuw toernooi —</option>
            <option v-for="item in tournaments" :key="item.id" :value="item.id">{{ item.type }} {{ item.year }}</option>
          </select>
          <button class="secondary-button" :disabled="busy" @click="startNewTournament"><Plus :size="15" />Nieuw toernooi</button>
        </div>
      </div>
      <form class="admin-grid" @submit.prevent="saveTournament">
        <label>Soort <input v-model="tournamentForm.type" required maxlength="2" list="tournament-types" placeholder="EK / WK"></label>
        <datalist id="tournament-types"><option value="EK" /><option value="WK" /></datalist>
        <label>Jaar <input v-model.number="tournamentForm.year" type="number" min="1900" max="2200" required></label>
        <label class="span-2">Gastland
          <select v-model.number="tournamentForm.locationId">
            <option :value="null">—</option>
            <option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name }}</option>
          </select>
        </label>
        <label>Aantal teams <input v-model.number="tournamentForm.teamCount" type="number" min="2" max="64" required></label>
        <label>Aantal groepen <input v-model.number="tournamentForm.groupCount" type="number" min="1" max="16" required></label>
        <label>Eerste wedstrijd <input v-model="tournamentForm.startDate" type="date"></label>
        <label>Finale <input v-model="tournamentForm.endDate" type="date"></label>
        <label class="admin-check span-4"><input v-model="tournamentForm.thirdPlace" type="checkbox"> Er wordt een wedstrijd om de 3e plaats gespeeld</label>
        <div class="span-4 admin-actions">
          <button class="primary-button" :disabled="busy"><Save :size="15" />{{ tournamentId ? 'Toernooi opslaan' : 'Toernooi aanmaken' }}</button>
        </div>
      </form>
      <p class="admin-muted">Teams, groepen, spelers en het wedstrijdschema van het toernooi van de gekozen pool beheer je in de volgende tabbladen. Een nieuw toernooi koppel je hierboven aan een (nieuwe) pool.</p>
    </div>
  </section>
</template>
