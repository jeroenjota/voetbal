<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeft, Pencil, Plus, Printer, Save, Trash2 } from '@lucide/vue'
import { api } from '../api'
import type { EntryPrediction, FormData, ParticipantSummary, PoolSummary } from '../../shared/types'
import { completeEntry, emptyEntry, euro, missingFields } from '../../shared/entry'
import PoolForm from '../form/PoolForm.vue'
import TaskStatus from './TaskStatus.vue'
import { useTask } from './useTask'

const props = defineProps<{ pool: PoolSummary }>()
const { busy, error, message, run } = useTask()

const participants = ref<ParticipantSummary[]>([])
const form = ref<FormData>()
const editing = ref<{ id: number | null; entry: EntryPrediction } | null>(null)
const original = ref('')
const search = ref('')
const validate = ref(false)

const filtered = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('nl')
  return participants.value.filter((item) => !term || `${item.name} ${item.email} ${item.telephone}`.toLocaleLowerCase('nl').includes(term))
})
const payedCount = computed(() => participants.value.filter((item) => item.payed).length)
const missing = computed(() => (editing.value && form.value ? missingFields(editing.value.entry, form.value) : []))
const changed = computed(() => !!editing.value && JSON.stringify(editing.value.entry) !== original.value)

async function load() {
  await run(async () => {
    ;[participants.value, form.value] = await Promise.all([api.participants(props.pool.id), api.form(props.pool.id)])
  })
}

function open(id: number | null, entry: EntryPrediction) {
  editing.value = { id, entry }
  original.value = JSON.stringify(entry)
  validate.value = false
  window.scrollTo({ top: 0 })
}

function startNew() {
  if (form.value) open(null, emptyEntry(form.value))
}

async function edit(item: ParticipantSummary) {
  const entry = await run(() => api.participant(props.pool.id, item.id))
  if (entry && form.value) open(item.id, completeEntry(entry, form.value))
}

function close() {
  if (changed.value && !window.confirm('Er zijn niet-opgeslagen wijzigingen. Toch sluiten?')) return
  editing.value = null
}

async function save(andNew = false) {
  if (!editing.value) return
  const current = editing.value
  validate.value = true
  if (!current.entry.name.trim()) {
    error.value = 'Vul minimaal de naam in.'
    return
  }
  if (missing.value.length && !window.confirm(`Er ontbreken nog ${missing.value.length} voorspellingen. Toch opslaan?`)) return
  const result = await run(() => (current.id ? api.saveParticipant(props.pool.id, current.id, current.entry) : api.createParticipant(props.pool.id, current.entry)),
    `Formulier van ${current.entry.name} opgeslagen.`)
  if (!result) return
  participants.value = await api.participants(props.pool.id)
  if (andNew) startNew()
  else open(result.id, current.entry)
}

async function remove(item: ParticipantSummary) {
  if (!window.confirm(`Formulier van ${item.name} definitief verwijderen?`)) return
  if (await run(async () => { await api.deleteParticipant(props.pool.id, item.id); return true }, `${item.name} verwijderd.`)) {
    participants.value = participants.value.filter((participant) => participant.id !== item.id)
    if (editing.value?.id === item.id) editing.value = null
  }
}

async function togglePayed(item: ParticipantSummary) {
  const entry = await run(() => api.participant(props.pool.id, item.id))
  if (!entry) return
  entry.payed = !item.payed
  if (await run(() => api.saveParticipant(props.pool.id, item.id, entry), entry.payed ? `${item.name} heeft betaald.` : `${item.name}: betaling teruggezet.`)) item.payed = entry.payed
}

function printUrl(id: number) {
  return `#/print?pool=${props.pool.id}&participant=${id}`
}

function created(value: string | null) {
  return value ? new Date(value.replace(' ', 'T')).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' }) : ''
}

onMounted(load)
</script>

<template>
  <section class="admin-section">
    <TaskStatus :error="error" :message="message" />

    <template v-if="editing && form">
      <div class="admin-editor-bar">
        <button class="secondary-button" @click="close"><ArrowLeft :size="15" />Terug naar lijst</button>
        <strong>{{ editing.id ? `Formulier van ${editing.entry.name || '…'}` : 'Nieuw formulier invoeren' }}</strong>
        <span :class="missing.length ? 'admin-warn-text' : 'admin-ok-text'">{{ missing.length ? `${missing.length} velden leeg` : 'Volledig ingevuld' }}</span>
        <label class="admin-check"><input v-model="validate" type="checkbox"> Lege velden markeren</label>
        <a v-if="editing.id" class="secondary-button" :href="printUrl(editing.id)" target="_blank"><Printer :size="15" />Afdrukken</a>
        <button v-if="!editing.id" class="secondary-button" :disabled="busy" @click="save(true)"><Plus :size="15" />Opslaan &amp; volgende</button>
        <button class="primary-button" :disabled="busy" @click="save()"><Save :size="15" />Opslaan</button>
      </div>
      <p class="admin-muted">Tip: met Tab spring je van vak naar vak, in dezelfde volgorde als op het papieren formulier.</p>
      <div class="admin-form-host">
        <PoolForm v-model="editing.entry" :form="form" mode="admin" :validate="validate" />
      </div>
    </template>

    <div v-else class="admin-card">
      <div class="admin-card-head">
        <h2>Deelnemers – {{ pool.name }}</h2>
        <div class="admin-actions">
          <input v-model="search" type="search" placeholder="Zoek op naam, e-mail…" aria-label="Zoek deelnemer">
          <button class="primary-button" :disabled="!form" @click="startNew"><Plus :size="15" />Formulier invoeren</button>
        </div>
      </div>
      <p class="admin-muted">
        {{ participants.length }} deelnemers · {{ payedCount }} betaald
        <template v-if="form"> · inleg {{ euro(form.pool.cost) }} · pot {{ euro(form.pool.cost * participants.length) }}</template>
      </p>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Naam</th><th>Telefoon</th><th>E-mail</th><th>Betaald</th><th>Bij</th><th>Bron</th><th>Ingevoerd</th><th>Leeg</th><th /></tr>
          </thead>
          <tbody>
            <tr v-for="item in filtered" :key="item.id">
              <td><button class="admin-link" @click="edit(item)">{{ item.name }}</button></td>
              <td>{{ item.telephone }}</td>
              <td>{{ item.email }}</td>
              <td><input type="checkbox" :checked="item.payed" :disabled="busy" :aria-label="`${item.name} betaald`" @change="togglePayed(item)"></td>
              <td>{{ item.payedTo }}</td>
              <td>{{ item.source === 'online' ? 'online' : 'papier' }}</td>
              <td>{{ created(item.createdAt) }}</td>
              <td :class="{ 'admin-warn-text': item.missing }">{{ item.missing || '' }}</td>
              <td class="admin-row-actions">
                <button class="icon-button" title="Bewerken" @click="edit(item)"><Pencil :size="15" /></button>
                <a class="icon-button" title="Afdrukken" :href="printUrl(item.id)" target="_blank"><Printer :size="15" /></a>
                <button class="icon-button danger" title="Verwijderen" :disabled="busy" @click="remove(item)"><Trash2 :size="15" /></button>
              </td>
            </tr>
            <tr v-if="!filtered.length"><td colspan="9" class="admin-muted">Geen deelnemers gevonden.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
