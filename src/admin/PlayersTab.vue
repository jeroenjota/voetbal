<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Pencil, Plus, Save, Trash2, X } from '@lucide/vue'
import { api } from '../api'
import type { Player, PlayerFunction, PoolSummary, Team } from '../../shared/types'
import { joinName } from '../../shared/entry'
import TaskStatus from './TaskStatus.vue'
import { emptyToNull, useTask } from './useTask'

type Person = Omit<Player, 'id' | 'tournamentPlayerId' | 'teamId'>

const props = defineProps<{ pool: PoolSummary }>()
const { busy, error, message, run } = useTask()

const players = ref<Player[]>([])
const teams = ref<Team[]>([])
const functions = ref<PlayerFunction[]>([])
const tournamentTeamIds = ref<number[]>([])
const teamId = ref<number | null>(null)
const editingId = ref<number | null>(null)
const draft = ref<Person>(blank())
const search = ref('')

const tournamentId = computed(() => props.pool.tournamentId!)
const tournamentTeams = computed(() => teams.value
  .filter((team) => tournamentTeamIds.value.includes(team.id))
  .sort((a, b) => a.name.localeCompare(b.name, 'nl')))
const functionName = computed(() => new Map(functions.value.map((item) => [item.id, item.name])))
const teamPlayers = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('nl')
  return players.value
    .filter((player) => (term ? fullName(player).toLocaleLowerCase('nl').includes(term) : player.teamId === teamId.value))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'nl') || a.firstName.localeCompare(b.firstName, 'nl'))
})
const countByTeam = computed(() => {
  const counts = new Map<number, number>()
  for (const player of players.value) counts.set(player.teamId, (counts.get(player.teamId) ?? 0) + 1)
  return counts
})

function blank(): Person {
  return { firstName: '', middleName: null, lastName: '', nickName: null, functionId: null }
}

function fullName(player: Person) {
  return joinName(player.firstName, player.middleName, player.lastName)
}

function clean(person: Person): Person {
  return {
    firstName: person.firstName.trim(), middleName: emptyToNull(person.middleName), lastName: person.lastName.trim(),
    nickName: emptyToNull(person.nickName), functionId: person.functionId,
  }
}

async function load() {
  await run(async () => {
    const [allPlayers, allTeams, allFunctions, slots] = await Promise.all([
      api.players(tournamentId.value), api.teams(), api.functions(), api.groups(tournamentId.value),
    ])
    players.value = allPlayers
    teams.value = allTeams
    functions.value = allFunctions
    tournamentTeamIds.value = [...new Set(slots.map((slot) => slot.teamId).filter((id): id is number => !!id))]
    if (!teamId.value || !tournamentTeamIds.value.includes(teamId.value)) teamId.value = tournamentTeams.value[0]?.id ?? null
  })
}

async function add() {
  if (!teamId.value) return
  const team = teamId.value
  if (await run(() => api.addPlayer(tournamentId.value, team, clean(draft.value)), `${fullName(draft.value)} toegevoegd.`)) {
    draft.value = { ...blank(), functionId: draft.value.functionId }
    players.value = await api.players(tournamentId.value)
  }
}

function edit(player: Player) {
  editingId.value = player.tournamentPlayerId
  const { firstName, middleName, lastName, nickName, functionId } = player
  editForm.value = { firstName, middleName, lastName, nickName, functionId }
}

const editForm = ref<Person>(blank())

async function saveEdit(player: Player) {
  if (await run(() => api.updatePerson(player.id, clean(editForm.value)), 'Speler opgeslagen.')) {
    editingId.value = null
    players.value = await api.players(tournamentId.value)
  }
}

async function remove(player: Player) {
  if (!window.confirm(`${fullName(player)} uit de selectie verwijderen?`)) return
  if (await run(async () => { await api.removePlayer(tournamentId.value, player.tournamentPlayerId); return true }, `${fullName(player)} verwijderd.`)) {
    players.value = players.value.filter((item) => item.tournamentPlayerId !== player.tournamentPlayerId)
  }
}

onMounted(load)
</script>

<template>
  <section class="admin-section">
    <TaskStatus :error="error" :message="message" />
    <div class="admin-card">
      <div class="admin-card-head">
        <h2>Spelers</h2>
        <div class="admin-actions">
          <input v-model="search" type="search" placeholder="Zoek in alle teams…" aria-label="Zoek speler">
          <span class="admin-muted">{{ players.length }} spelers in totaal</span>
        </div>
      </div>
      <p v-if="!tournamentTeams.length" class="admin-muted">Er zijn nog geen teams ingedeeld. Doe dat eerst bij ‘Teams &amp; groepen’.</p>
      <div v-else class="admin-split">
        <nav class="admin-team-list" aria-label="Teams">
          <button v-for="team in tournamentTeams" :key="team.id" :class="{ active: !search && team.id === teamId }" @click="teamId = team.id; search = ''">
            <span>{{ team.name }}</span><small>{{ countByTeam.get(team.id) ?? 0 }}</small>
          </button>
        </nav>
        <div>
          <table class="admin-table">
            <thead>
              <tr><th>Voornaam</th><th>Tussenv.</th><th>Achternaam</th><th>Roepnaam</th><th>Functie</th><th v-if="search">Team</th><th /></tr>
            </thead>
            <tbody>
              <template v-for="player in teamPlayers" :key="player.tournamentPlayerId">
                <tr v-if="editingId === player.tournamentPlayerId">
                  <td><input v-model="editForm.firstName" maxlength="32" aria-label="Voornaam"></td>
                  <td><input v-model="editForm.middleName" maxlength="20" class="narrow" aria-label="Tussenvoegsel"></td>
                  <td><input v-model="editForm.lastName" maxlength="32" required aria-label="Achternaam"></td>
                  <td><input v-model="editForm.nickName" maxlength="50" aria-label="Roepnaam"></td>
                  <td>
                    <select v-model.number="editForm.functionId" aria-label="Functie">
                      <option :value="null">—</option>
                      <option v-for="item in functions" :key="item.id" :value="item.id">{{ item.name }}</option>
                    </select>
                  </td>
                  <td v-if="search">{{ teams.find((team) => team.id === player.teamId)?.name }}</td>
                  <td class="admin-row-actions">
                    <button class="icon-button" title="Opslaan" :disabled="busy || !editForm.lastName.trim()" @click="saveEdit(player)"><Save :size="15" /></button>
                    <button class="icon-button" title="Annuleren" @click="editingId = null"><X :size="15" /></button>
                  </td>
                </tr>
                <tr v-else>
                  <td>{{ player.firstName }}</td>
                  <td>{{ player.middleName }}</td>
                  <td>{{ player.lastName }}</td>
                  <td>{{ player.nickName }}</td>
                  <td>{{ player.functionId ? functionName.get(player.functionId) : '' }}</td>
                  <td v-if="search">{{ teams.find((team) => team.id === player.teamId)?.name }}</td>
                  <td class="admin-row-actions">
                    <button class="icon-button" title="Bewerken" @click="edit(player)"><Pencil :size="15" /></button>
                    <button class="icon-button danger" title="Verwijderen" :disabled="busy" @click="remove(player)"><Trash2 :size="15" /></button>
                  </td>
                </tr>
              </template>
              <tr v-if="!teamPlayers.length"><td colspan="7" class="admin-muted">Geen spelers gevonden.</td></tr>
            </tbody>
            <tfoot v-if="!search">
              <tr>
                <td><input v-model="draft.firstName" maxlength="32" placeholder="Voornaam" aria-label="Nieuwe speler voornaam"></td>
                <td><input v-model="draft.middleName" maxlength="20" class="narrow" placeholder="van" aria-label="Nieuwe speler tussenvoegsel"></td>
                <td><input v-model="draft.lastName" maxlength="32" placeholder="Achternaam" aria-label="Nieuwe speler achternaam" @keydown.enter="draft.lastName.trim() && add()"></td>
                <td><input v-model="draft.nickName" maxlength="50" placeholder="Roepnaam" aria-label="Nieuwe speler roepnaam"></td>
                <td>
                  <select v-model.number="draft.functionId" aria-label="Nieuwe speler functie">
                    <option :value="null">—</option>
                    <option v-for="item in functions" :key="item.id" :value="item.id">{{ item.name }}</option>
                  </select>
                </td>
                <td class="admin-row-actions">
                  <button class="primary-button" :disabled="busy || !draft.lastName.trim()" @click="add"><Plus :size="15" />Toevoegen</button>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p class="admin-muted">Trainers en scheidsrechters komen niet in de topscorerlijst van het formulier; alle andere spelers wel. Wijzigingen in naam gelden voor de persoon in alle toernooien.</p>
    </div>
  </section>
</template>
