<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft, Check, FileDown, Printer, RotateCcw, Send } from '@lucide/vue'
import PoolForm from '../form/PoolForm.vue'
import { api, errorMessage } from '../api'
import { missingFields, onlineEntry, weekdayDate } from '../../shared/entry'
import type { EntryPrediction, FormData } from '../../shared/types'
import { readDraftState, writeDraft } from '../draft'

const form = ref<FormData>()
const entry = ref<EntryPrediction>()
const submittedId = ref<number>()
const submittedAt = ref<string>()
const loadError = ref('')
const error = ref('')
const notice = ref('')
const validate = ref(false)
const busy = ref(false)

const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const missing = computed(() => (form.value && entry.value ? missingFields(entry.value, form.value) : []))
const closedReason = computed(() => {
  const pool = form.value?.pool
  if (!pool) return ''
  if (pool.formsFrom && today < pool.formsFrom) return `Online inschrijven kan vanaf ${weekdayDate(pool.formsFrom)}.`
  if (pool.formsTill && today > pool.formsTill) return `De inleverdatum (${weekdayDate(pool.formsTill)}) is verstreken. Je kunt het formulier nog wel bekijken en afdrukken.`
  return ''
})

onMounted(async () => {
  try {
    const data = await api.activeForm()
    const state = readDraftState(data.pool.id)
    entry.value = onlineEntry(data, state?.entry)
    submittedId.value = state?.submittedId
    submittedAt.value = state?.submittedAt
    form.value = data
    document.title = `Inschrijfformulier – ${data.pool.name}`
  } catch (cause) {
    loadError.value = errorMessage(cause)
  }
})

function save() {
  if (!form.value || !entry.value) return
  try {
    writeDraft(form.value.pool.id, { entry: entry.value, submittedId: submittedId.value, submittedAt: submittedAt.value })
  } catch {
    error.value = 'Je concept kon niet in deze browser worden bewaard. Lever het formulier in of druk het af voordat je de pagina sluit.'
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(entry, () => {
  clearTimeout(timer)
  timer = setTimeout(save, 300)
  notice.value = ''
}, { deep: true })

async function submit() {
  if (!form.value || !entry.value) return
  error.value = ''
  if (missing.value.length) {
    validate.value = true
    error.value = `Nog niet alles is ingevuld (${missing.value.length}): ${missing.value.slice(0, 6).join(', ')}${missing.value.length > 6 ? ', …' : ''}. De rode vakjes ontbreken nog.`
    return
  }
  if (!window.confirm('Formulier definitief insturen? Daarna kun je het niet meer online wijzigen.')) return
  busy.value = true
  try {
    const { id } = await api.submitEntry(form.value.pool.id, entry.value)
    submittedId.value = id
    submittedAt.value = new Date().toISOString()
    save()
    notice.value = 'Je formulier is ingestuurd. Vergeet niet de inleg te betalen!'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}

function startOver() {
  if (!form.value) return
  const message = submittedId.value
    ? 'Een nieuw, leeg formulier beginnen (bijvoorbeeld voor iemand anders)? Je ingestuurde formulier blijft bij de organisatie bewaard.'
    : 'Alles wissen en opnieuw beginnen?'
  if (!window.confirm(message)) return
  submittedId.value = undefined
  submittedAt.value = undefined
  validate.value = false
  error.value = ''
  entry.value = onlineEntry(form.value)
}

function printForm() {
  window.print()
}
</script>

<template>
  <div class="form-page">
    <div class="form-toolbar no-print">
      <RouterLink to="/" class="secondary-button"><ArrowLeft :size="16" /> Overzicht</RouterLink>
      <span class="form-toolbar-title">
        <template v-if="submittedId"><Check :size="16" /> Ingestuurd</template>
        <template v-else-if="form">{{ missing.length ? `Nog ${missing.length} vakjes in te vullen` : 'Alles ingevuld' }}</template>
      </span>
      <RouterLink v-if="form" :to="{ path: '/print', query: { pool: form.pool.id } }" class="secondary-button" title="Leeg formulier om met de hand in te vullen"><FileDown :size="16" /> Leeg formulier</RouterLink>
      <button class="secondary-button" :disabled="!form" title="Dit (ingevulde) formulier afdrukken" @click="printForm"><Printer :size="16" /> Afdrukken</button>
      <button class="secondary-button" :disabled="!form" @click="startOver"><RotateCcw :size="16" /> {{ submittedId ? 'Nieuw formulier' : 'Wissen' }}</button>
      <button v-if="!submittedId" class="primary-button" :disabled="!form || busy || !!closedReason" @click="submit"><Send :size="16" /> Insturen</button>
    </div>
    <div class="form-messages no-print">
      <div v-if="loadError" class="error-notice" role="alert">{{ loadError }}</div>
      <div v-if="closedReason && !submittedId" class="template-notice">{{ closedReason }}</div>
      <div v-if="submittedId" class="success-notice" role="status"><Check :size="16" /> {{ notice || `Dit formulier is ingestuurd${submittedAt ? ` op ${new Date(submittedAt).toLocaleString('nl-NL')}` : ''}. Wijzigingen? Neem contact op met de organisatie.` }}</div>
      <div v-if="error" class="error-notice" role="alert">{{ error }}</div>
      <p v-if="form && !submittedId" class="form-hint">Vul het formulier hieronder in, precies zoals op papier. Je invoer wordt automatisch in deze browser bewaard; klik op <b>Insturen</b> als je klaar bent.</p>
    </div>
    <PoolForm v-if="form && entry" v-model="entry" :form="form" :mode="submittedId ? 'print' : 'online'" :validate="validate" />
  </div>
</template>
