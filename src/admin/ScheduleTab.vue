<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowDownUp, Plus, Save, Trash2 } from '@lucide/vue'
import { api } from '../api'
import { MATCH_TYPE_LABELS, MATCH_TYPES } from '../../shared/types'
import type { GroupSlot, PoolSummary, ScheduleMatch, Stadium, Team } from '../../shared/types'
import { shortDay } from '../../shared/entry'
import TaskStatus from './TaskStatus.vue'
import { emptyToNull, useTask } from './useTask'

const props = defineProps<{ pool: PoolSummary }>()
const { busy, error, message, run } = useTask()

const matches = ref<ScheduleMatch[]>([])
const stadiums = ref<Stadium[]>([])
const slots = ref<GroupSlot[]>([])
const teams = ref<Team[]>([])
const dirty = ref(false)
const stadiumForm = ref({ name: '', location: '' })

const tournamentId = computed(() => props.pool.tournamentId!)
const typeOptions = [MATCH_TYPES.group, MATCH_TYPES.eighth, MATCH_TYPES.quarter, MATCH_TYPES.semi, MATCH_TYPES.third, MATCH_TYPES.final]
const teamName = computed(() => new Map(teams.value.map((team) => [team.id, team.name])))
const slotTeam = computed(() => new Map(slots.value.map((slot) => [`${slot.letter}${slot.place}`, slot.teamId ? teamName.value.get(slot.teamId) ?? '' : ''])))
const duplicateNumbers = computed(() => {
  const seen = new Set<number>()
  const doubles = new Set<number>()
  for (const match of matches.value) (seen.has(match.number) ? doubles : seen).add(match.number)
  return doubles
})
const counts = computed(() => typeOptions
  .map((type) => ({ type, count: matches.value.filter((match) => match.type === type).length }))
  .filter((item) => item.count))

function codeHint(match: ScheduleMatch, code: string) {
  return match.type === MATCH_TYPES.group ? slotTeam.value.get(code.trim().toUpperCase()) || '?' : ''
}

async function load() {
  await run(async () => {
    const [schedule, allStadiums, groupSlots, allTeams] = await Promise.all([
      api.schedule(tournamentId.value), api.stadiums(), api.groups(tournamentId.value), api.teams(),
    ])
    matches.value = schedule
    stadiums.value = allStadiums
    slots.value = groupSlots
    teams.value = allTeams
    dirty.value = false
  })
}

function addMatch() {
  const last = matches.value.at(-1)
  const number = Math.max(0, ...matches.value.map((match) => match.number)) + 1
  matches.value.push({
    number, date: last?.date ?? null, time: last?.time ?? null, type: last?.type ?? MATCH_TYPES.group,
    codeA: '', codeB: '', stadiumId: null, order: Math.max(0, ...matches.value.map((match) => match.order)) + 1,
  })
  dirty.value = true
}

function removeMatch(index: number) {
  matches.value.splice(index, 1)
  dirty.value = true
}

function sortMatches() {
  matches.value.sort((a, b) => a.order - b.order || a.number - b.number)
}

/** Use the match number as playing order. */
function orderByNumber() {
  for (const match of matches.value) match.order = match.number
  sortMatches()
  dirty.value = true
}

async function save() {
  if (duplicateNumbers.value.size) {
    error.value = `Dubbele wedstrijdnummers: ${[...duplicateNumbers.value].join(', ')}`
    return
  }
  const data = matches.value.map((match) => ({
    ...match,
    date: emptyToNull(match.date),
    time: emptyToNull(match.time),
    codeA: match.codeA.trim().toUpperCase(),
    codeB: match.codeB.trim().toUpperCase(),
  }))
  if (await run(() => api.saveSchedule(tournamentId.value, data), 'Wedstrijdschema opgeslagen.')) {
    matches.value = data
    sortMatches()
    dirty.value = false
  }
}

async function addStadium() {
  const result = await run(() => api.createStadium({ name: stadiumForm.value.name.trim(), location: emptyToNull(stadiumForm.value.location) }), 'Stadion toegevoegd.')
  if (result) {
    stadiums.value = await api.stadiums()
    stadiumForm.value = { name: '', location: '' }
  }
}

onMounted(load)
</script>

<template>
  <section class="admin-section">
    <TaskStatus :error="error" :message="message" />
    <div class="admin-card">
      <div class="admin-card-head">
        <h2>Wedstrijdschema</h2>
        <div class="admin-actions">
          <span class="admin-muted">
            {{ matches.length }} wedstrijden<template v-for="item in counts" :key="item.type"> · {{ item.count }}× {{ MATCH_TYPE_LABELS[item.type]?.toLowerCase() }}</template>
          </span>
          <button class="secondary-button" :disabled="busy" title="Speelvolgorde gelijk maken aan de wedstrijdnummers" @click="orderByNumber"><ArrowDownUp :size="15" />Volgorde = nummer</button>
          <button class="primary-button" :disabled="busy" @click="save"><Save :size="15" />Schema opslaan{{ dirty ? ' *' : '' }}</button>
        </div>
      </div>
      <details class="admin-help">
        <summary>Uitleg teamcodes</summary>
        <ul>
          <li><b>A1</b>, <b>B3</b>: groepswedstrijd; team op plaats 1 van groep A (zie ‘Teams &amp; groepen’).</li>
          <li><b>1A</b> / <b>2B</b>: winnaar van groep A / nummer 2 van groep B.</li>
          <li><b>3DEF</b>: één van de beste nummers 3 uit groep D, E of F.</li>
          <li><b>W45</b>: winnaar van wedstrijd 45, <b>V49</b>: verliezer van wedstrijd 49 (kleine finale).</li>
          <li>‘Volgorde’ bepaalt de rij op pagina 2 van het formulier; het nummer wordt in de knock-outvakken gebruikt.</li>
        </ul>
      </details>
      <div class="admin-table-wrap">
        <table class="admin-table admin-schedule">
          <thead>
            <tr><th>Nr</th><th>Datum</th><th>Tijd</th><th>Ronde</th><th>Team A</th><th>Team B</th><th>Stadion</th><th>Volgorde</th><th /></tr>
          </thead>
          <tbody @input="dirty = true" @change="dirty = true">
            <tr v-for="(match, index) in matches" :key="index">
              <td><input v-model.number="match.number" type="number" min="1" max="200" class="narrow" :class="{ 'admin-invalid': duplicateNumbers.has(match.number) }" aria-label="Wedstrijdnummer"></td>
              <td><input v-model="match.date" type="date" aria-label="Datum"><small class="admin-muted">{{ shortDay(match.date) }}</small></td>
              <td><input v-model="match.time" type="time" aria-label="Aanvangstijd"></td>
              <td>
                <select v-model.number="match.type" aria-label="Ronde">
                  <option v-for="type in typeOptions" :key="type" :value="type">{{ MATCH_TYPE_LABELS[type] }}</option>
                </select>
              </td>
              <td><input v-model="match.codeA" class="code" maxlength="20" required aria-label="Code team A"><small class="admin-muted">{{ codeHint(match, match.codeA) }}</small></td>
              <td><input v-model="match.codeB" class="code" maxlength="20" required aria-label="Code team B"><small class="admin-muted">{{ codeHint(match, match.codeB) }}</small></td>
              <td>
                <select v-model.number="match.stadiumId" aria-label="Stadion">
                  <option :value="null">—</option>
                  <option v-for="stadium in stadiums" :key="stadium.id" :value="stadium.id">{{ stadium.name }}{{ stadium.location ? ` (${stadium.location})` : '' }}</option>
                </select>
              </td>
              <td><input v-model.number="match.order" type="number" min="0" max="1000" class="narrow" aria-label="Volgorde"></td>
              <td class="admin-row-actions"><button class="icon-button danger" title="Verwijderen" @click="removeMatch(index)"><Trash2 :size="15" /></button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="admin-actions">
        <button class="secondary-button" @click="addMatch"><Plus :size="15" />Wedstrijd toevoegen</button>
      </div>
    </div>

    <div class="admin-card">
      <h2>Stadion toevoegen</h2>
      <form class="admin-grid" @submit.prevent="addStadium">
        <label class="span-2">Naam <input v-model="stadiumForm.name" required maxlength="64"></label>
        <label>Plaats <input v-model="stadiumForm.location" maxlength="64"></label>
        <div class="admin-actions admin-align-end"><button class="primary-button" :disabled="busy"><Plus :size="15" />Toevoegen</button></div>
      </form>
    </div>
  </section>
</template>
