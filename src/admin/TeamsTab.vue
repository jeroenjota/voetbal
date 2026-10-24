<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, Save } from '@lucide/vue'
import { api } from '../api'
import type { Country, GroupSlot, PoolSummary, Team, Tournament } from '../../shared/types'
import TaskStatus from './TaskStatus.vue'
import { emptyToNull, useTask } from './useTask'

const props = defineProps<{ pool: PoolSummary }>()
const { busy, error, message, run } = useTask()

const tournament = ref<Tournament & { id: number }>()
const teams = ref<Team[]>([])
const countries = ref<Country[]>([])
const slots = ref<GroupSlot[]>([])
const teamForm = ref<Omit<Team, 'id'> & { id: number | null }>({ id: null, name: '', shortName: null, countryId: null })

const tournamentId = computed(() => props.pool.tournamentId!)
const sortedTeams = computed(() => [...teams.value].sort((a, b) => a.name.localeCompare(b.name, 'nl')))
const groups = computed(() => {
  const letters = [...new Set(slots.value.map((slot) => slot.letter))].sort()
  return letters.map((letter) => ({ letter, slots: slots.value.filter((slot) => slot.letter === letter).sort((a, b) => a.place - b.place) }))
})
const duplicates = computed(() => {
  const counts = new Map<number, number>()
  for (const slot of slots.value) if (slot.teamId) counts.set(slot.teamId, (counts.get(slot.teamId) ?? 0) + 1)
  return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id))
})
const filled = computed(() => slots.value.filter((slot) => slot.teamId).length)

function letter(index: number) {
  return String.fromCharCode(65 + index)
}

/** Ensure the grid matches the tournament's group and team counts, keeping existing assignments. */
function layoutSlots(existing: GroupSlot[]) {
  const groupCount = Math.max(1, tournament.value?.groupCount ?? 1)
  const perGroup = Math.min(4, Math.max(1, Math.ceil((tournament.value?.teamCount ?? 4) / groupCount)))
  const result: GroupSlot[] = []
  for (let group = 0; group < groupCount; group++) {
    for (let place = 1; place <= perGroup; place++) {
      result.push({ letter: letter(group), place, teamId: existing.find((slot) => slot.letter === letter(group) && slot.place === place)?.teamId ?? null })
    }
  }
  const extra = existing.filter((slot) => !result.some((item) => item.letter === slot.letter && item.place === slot.place) && slot.teamId)
  return [...result, ...extra]
}

async function load() {
  await run(async () => {
    const [found, allTeams, allCountries, current] = await Promise.all([
      api.tournament(tournamentId.value), api.teams(), api.countries(), api.groups(tournamentId.value),
    ])
    tournament.value = found
    teams.value = allTeams
    countries.value = allCountries
    slots.value = layoutSlots(current)
  })
}

async function saveGroups() {
  if (duplicates.value.size) {
    error.value = 'Een team staat in meer dan één groep/plaats.'
    return
  }
  await run(() => api.saveGroups(tournamentId.value, slots.value), 'Groepsindeling opgeslagen.')
}

function editTeam(id: number | null) {
  const team = teams.value.find((item) => item.id === id)
  teamForm.value = team ? { ...team } : { id: null, name: '', shortName: null, countryId: null }
}

async function saveTeam() {
  const data = { name: teamForm.value.name.trim(), shortName: emptyToNull(teamForm.value.shortName), countryId: teamForm.value.countryId }
  const id = teamForm.value.id
  const result = await run(() => (id ? api.saveTeam(id, data) : api.createTeam(data)), id ? 'Team opgeslagen.' : 'Team toegevoegd.')
  if (!result) return
  teams.value = await api.teams()
  editTeam(null)
}

onMounted(load)
</script>

<template>
  <section class="admin-section">
    <TaskStatus :error="error" :message="message" />
    <div class="admin-card">
      <div class="admin-card-head">
        <h2>Groepsindeling {{ tournament ? `${tournament.type} ${tournament.year}` : '' }}</h2>
        <div class="admin-actions">
          <span class="admin-muted">{{ filled }} van {{ slots.length }} plaatsen gevuld</span>
          <button class="primary-button" :disabled="busy" @click="saveGroups"><Save :size="15" />Groepen opslaan</button>
        </div>
      </div>
      <p class="admin-muted">De volgorde binnen een groep (plaats 1–4) bepaalt de codes in het wedstrijdschema (A1, A2, …) en de volgorde op het formulier. Aantal groepen en teams stel je in bij ‘Pool &amp; toernooi’.</p>
      <div class="admin-groups">
        <fieldset v-for="group in groups" :key="group.letter" class="admin-group">
          <legend>Groep {{ group.letter }}</legend>
          <label v-for="slot in group.slots" :key="slot.place">
            <span>{{ group.letter }}{{ slot.place }}</span>
            <select v-model.number="slot.teamId" :class="{ 'admin-invalid': slot.teamId && duplicates.has(slot.teamId) }">
              <option :value="null">—</option>
              <option v-for="team in sortedTeams" :key="team.id" :value="team.id">{{ team.name }}</option>
            </select>
          </label>
        </fieldset>
      </div>
    </div>

    <div class="admin-card">
      <div class="admin-card-head">
        <h2>{{ teamForm.id ? 'Team bewerken' : 'Nieuw team' }}</h2>
        <div class="admin-actions">
          <select :value="teamForm.id ?? ''" aria-label="Team kiezen om te bewerken" @change="editTeam(Number(($event.target as HTMLSelectElement).value) || null)">
            <option value="">— nieuw team —</option>
            <option v-for="team in sortedTeams" :key="team.id" :value="team.id">{{ team.name }}</option>
          </select>
        </div>
      </div>
      <form class="admin-grid" @submit.prevent="saveTeam">
        <label class="span-2">Naam <input v-model="teamForm.name" required maxlength="50"></label>
        <label>Afkorting <input v-model="teamForm.shortName" maxlength="3" placeholder="NED"></label>
        <label>Land
          <select v-model.number="teamForm.countryId">
            <option :value="null">—</option>
            <option v-for="country in countries" :key="country.id" :value="country.id">{{ country.name }}</option>
          </select>
        </label>
        <div class="span-4 admin-actions">
          <button class="primary-button" :disabled="busy"><component :is="teamForm.id ? Save : Plus" :size="15" />{{ teamForm.id ? 'Team opslaan' : 'Team toevoegen' }}</button>
          <button v-if="teamForm.id" type="button" class="secondary-button" @click="editTeam(null)">Annuleren</button>
        </div>
      </form>
      <p class="admin-muted">Teams worden gedeeld door alle toernooien; een naamswijziging geldt dus ook voor oude toernooien.</p>
    </div>
  </section>
</template>
