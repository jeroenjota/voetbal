<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Printer } from '@lucide/vue'
import PoolForm from '../form/PoolForm.vue'
import { api, errorMessage } from '../api'
import { completeEntry, emptyEntry } from '../../shared/entry'
import type { EntryPrediction, FormData } from '../../shared/types'
import { readDraft } from '../draft'

/** /print?pool=1 (blank), /print?pool=1&participant=44 (filled in by admin), /print?draft=1 (own online draft). */
const route = useRoute()
const form = ref<FormData>()
const entry = ref<EntryPrediction>()
const error = ref('')

const numberQuery = (name: string) => {
  const value = Number(route.query[name])
  return Number.isInteger(value) && value > 0 ? value : undefined
}

onMounted(async () => {
  try {
    const poolId = numberQuery('pool')
    const participantId = numberQuery('participant')
    const data = poolId ? await api.form(poolId) : await api.activeForm()
    if (participantId) entry.value = completeEntry(await api.participant(data.pool.id, participantId), data)
    else if (route.query.draft) entry.value = completeEntry(readDraft(data.pool.id) ?? {}, data)
    else entry.value = emptyEntry(data)
    form.value = data
    document.title = `Inschrijfformulier – ${data.pool.name}`
    if (route.query.auto) setTimeout(() => window.print(), 400)
  } catch (cause) {
    error.value = errorMessage(cause)
  }
})

function printForm() {
  window.print()
}

function back() {
  if (window.history.length > 1) window.history.back()
  else window.location.hash = '#/'
}
</script>

<template>
  <div class="form-page">
    <div class="form-toolbar no-print">
      <button class="secondary-button" @click="back"><ArrowLeft :size="16" /> Terug</button>
      <span class="form-toolbar-title">Afdrukvoorbeeld (A4, 2 pagina's)</span>
      <button class="primary-button" :disabled="!form" @click="printForm"><Printer :size="16" /> Afdrukken / opslaan als PDF</button>
    </div>
    <p class="form-hint no-print">Tip: kies in het afdrukvenster ‘Opslaan als PDF’ en zet ‘Achtergrondafbeeldingen’ aan; marges staan automatisch op ‘geen’.</p>
    <div v-if="error" class="error-notice no-print" role="alert">{{ error }}</div>
    <PoolForm v-if="form && entry" v-model="entry" :form="form" mode="print" />
  </div>
</template>
