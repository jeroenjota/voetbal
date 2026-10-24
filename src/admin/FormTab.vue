<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ExternalLink, FileDown, Globe, Printer } from '@lucide/vue'
import { api } from '../api'
import type { FormData, PoolSummary } from '../../shared/types'
import { emptyEntry, longDate } from '../../shared/entry'
import PoolForm from '../form/PoolForm.vue'
import TaskStatus from './TaskStatus.vue'
import { useTask } from './useTask'

const props = defineProps<{ pool: PoolSummary }>()
const { error, message, run } = useTask()
const form = ref<FormData>()
const preview = ref(emptyEntryPlaceholder())

const printUrl = computed(() => `#/print?pool=${props.pool.id}`)
const onlineUrl = computed(() => new URL('#/formulier', window.location.href).href)
const issues = computed(() => {
  if (!form.value) return []
  const list: string[] = []
  if (!form.value.groups.length || form.value.groups.some((group) => group.teams.length === 0)) list.push('Niet alle groepen hebben teams.')
  if (!form.value.matches.length) list.push('Er is nog geen wedstrijdschema.')
  if (form.value.matches.some((match) => match.type === 1 && (!match.teamA || !match.teamB))) list.push('Sommige groepswedstrijden verwijzen naar een lege groepsplaats.')
  if (!form.value.players.length) list.push('Er zijn nog geen spelers (topscorerlijst is leeg).')
  if (!form.value.pool.formsTill) list.push('Er is geen inleverdatum ingesteld.')
  return list
})

function emptyEntryPlaceholder() {
  return emptyEntry({ groups: [], matches: [], points: [] })
}

onMounted(() => run(async () => {
  form.value = await api.form(props.pool.id)
  preview.value = emptyEntry(form.value)
}))
</script>

<template>
  <section class="admin-section">
    <TaskStatus :error="error" :message="message" />
    <div class="admin-card">
      <h2>Inschrijfformulier – {{ pool.name }}</h2>
      <p class="admin-muted">
        Het formulier wordt automatisch opgebouwd uit de groepen, teams, wedstrijden, spelers, prijzen en punten van deze pool.
        Inleveren uiterlijk: <b>{{ form?.pool.formsTill ? longDate(form.pool.formsTill) : 'niet ingesteld' }}</b>.
      </p>
      <ul v-if="issues.length" class="admin-issues">
        <li v-for="issue in issues" :key="issue">{{ issue }}</li>
      </ul>
      <div class="admin-link-cards">
        <a class="admin-link-card" :href="`${printUrl}&auto=1`" target="_blank">
          <FileDown :size="22" />
          <strong>PDF / afdrukken</strong>
          <span>Opent het lege formulier en de printdialoog. Kies ‘Opslaan als PDF’ voor een PDF-bestand (A4, marges ‘Geen’).</span>
        </a>
        <a class="admin-link-card" :href="printUrl" target="_blank">
          <Printer :size="22" />
          <strong>Voorbeeld leeg formulier</strong>
          <span>Bekijk het formulier eerst op het scherm.</span>
        </a>
        <a class="admin-link-card" href="#/formulier" target="_blank">
          <Globe :size="22" />
          <strong>Online formulier</strong>
          <span v-if="pool.active">Deelnemers vullen hier hetzelfde formulier online in: <code>{{ onlineUrl }}</code></span>
          <span v-else class="admin-warn-text">Deze pool is niet actief; online inschrijven gaat altijd naar de actieve pool. Maak hem actief via ‘Pool &amp; toernooi’.</span>
        </a>
      </div>
    </div>
    <div v-if="form" class="admin-card">
      <div class="admin-card-head">
        <h2>Voorbeeld</h2>
        <a class="secondary-button" :href="printUrl" target="_blank"><ExternalLink :size="15" />Openen</a>
      </div>
      <div class="admin-form-host">
        <PoolForm v-model="preview" :form="form" mode="print" />
      </div>
    </div>
  </section>
</template>
