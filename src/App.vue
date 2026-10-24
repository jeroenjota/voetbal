<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  ArrowUpRight, CircleHelp, ClipboardList, Flag, Goal, House, Menu, Printer, Settings, ShieldCheck, Target, Trophy, Users, X,
} from '@lucide/vue'
import { api, errorMessage } from './api'
import { readDraftState } from './draft'
import { completeEntry, emptyEntry, euro, knockoutRounds, missingFields, weekdayDate } from '../shared/entry'
import { MATCH_TYPES, NUMBER_CATEGORY, POINT_CATEGORIES } from '../shared/types'
import type { FormData } from '../shared/types'

type Page = 'overview' | 'rules'
const navigation = [
  { id: 'overview', label: 'Overzicht', icon: House },
  { id: 'rules', label: 'Spelregels & punten', icon: CircleHelp },
] satisfies { id: Page; label: string; icon: typeof House }[]

const page = ref<Page>('overview')
const mobileMenu = ref(false)
const form = ref<FormData>()
const error = ref('')

const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
const draft = computed(() => (form.value ? readDraftState(form.value.pool.id) : null))
const progress = computed(() => {
  if (!form.value) return { total: 0, done: 0, percent: 0 }
  const total = missingFields(emptyEntry(form.value), form.value).length
  const left = draft.value ? missingFields(completeEntry(draft.value.entry, form.value), form.value).length : total
  return { total, done: total - left, percent: total ? Math.round((total - left) / total * 100) : 0 }
})
const status = computed(() => {
  if (draft.value?.submittedId) return { label: 'Ingestuurd', text: 'Je formulier is ontvangen' }
  if (draft.value) return { label: 'Concept', text: 'Opgeslagen in deze browser' }
  return { label: 'Nog niet begonnen', text: 'Online of op papier' }
})
const deadline = computed(() => {
  const till = form.value?.pool.formsTill
  if (!till) return { label: 'Nog niet bekend', text: 'De organisator stelt deze nog in' }
  return { label: weekdayDate(till), text: today > till ? 'Inschrijving gesloten' : 'Uiterlijk inleveren' }
})
const facts = computed(() => {
  if (!form.value) return ''
  const groupMatches = form.value.matches.filter((match) => match.type === MATCH_TYPES.group).length
  const knockout = form.value.matches.length - groupMatches
  return `${form.value.groups.length} groepen · ${form.value.teams.length} teams · ${groupMatches} groepswedstrijden · ${knockout} knock-outwedstrijden`
})
const rounds = computed(() => (form.value ? knockoutRounds(form.value) : []))
const pointGroups = computed(() => {
  const points = (form.value?.points ?? []).filter((point) => point.enabled)
  return [...new Set(points.map((point) => point.category))].sort((a, b) => a - b).map((category) => ({
    category,
    label: POINT_CATEGORIES[category] ?? `Overig`,
    items: points.filter((point) => point.category === category).sort((a, b) => a.listOrder - b.listOrder),
  }))
})
const prizes = computed(() => {
  const pool = form.value?.pool
  if (!pool) return []
  const list: string[] = []
  if (pool.prizeHighDayScore) list.push(`Meeste punten op één dag: ${euro(pool.prizeHighDayScore)}`)
  if (pool.prizeHighDayPosition) list.push(`Bovenaan in de totaalstand na een speeldag: ${euro(pool.prizeHighDayPosition)}`)
  if (pool.prizeLowDayPosition) list.push(`Onderaan in de totaalstand na een speeldag: ${euro(pool.prizeLowDayPosition)}`)
  if (pool.prizeLowFinalPosition) list.push(`Rode lantaarn aan het einde: ${euro(pool.prizeLowFinalPosition)}`)
  const percentages = pool.prizePercentages.map((value, index) => (value ? `${index + 1}e ${value}%` : '')).filter(Boolean)
  if (percentages.length) list.push(`Eindklassement (van de resterende pot): ${percentages.join(', ')}`)
  return list
})

function navigate(next: Page) {
  page.value = next
  mobileMenu.value = false
}

onMounted(async () => {
  try {
    form.value = await api.activeForm()
    document.title = form.value.pool.name
  } catch (cause) {
    error.value = `De poolgegevens konden niet worden geladen: ${errorMessage(cause)}`
  }
})
</script>

<template>
  <div class="app-shell">
    <aside :class="['sidebar', { 'is-open': mobileMenu }]">
      <a href="#/" class="brand" aria-label="Aftrap, naar overzicht" @click.prevent="navigate('overview')"><span class="brand-symbol"><Goal :size="25" /></span>aftrap<span class="brand-dot">.</span></a>
      <button class="mobile-close icon-button" aria-label="Menu sluiten" @click="mobileMenu = false"><X :size="22" /></button>
      <div class="pool-switch"><span class="pool-icon"><Trophy :size="20" /></span><div><strong>{{ form?.pool.name ?? 'Voetbalpool' }}</strong><span>{{ form?.tournament.description ?? '…' }} · Vooraf voorspellen</span></div><ShieldCheck :size="16" class="ml-auto text-lime-200" /></div>
      <p class="nav-label">JOUW POOL</p>
      <nav aria-label="Hoofdnavigatie">
        <button v-for="item in navigation" :key="item.id" :class="['nav-item', { active: page === item.id }]" :aria-current="page === item.id ? 'page' : undefined" @click="navigate(item.id)"><component :is="item.icon" :size="19" :stroke-width="1.7" />{{ item.label }}</button>
        <RouterLink to="/formulier" class="nav-item"><ClipboardList :size="19" :stroke-width="1.7" />Online invullen<span v-if="progress.total" class="nav-count">{{ progress.percent }}%</span></RouterLink>
        <RouterLink to="/print" class="nav-item"><Printer :size="19" :stroke-width="1.7" />Formulier afdrukken</RouterLink>
        <RouterLink to="/beheer" class="nav-item"><Settings :size="19" :stroke-width="1.7" />Beheer</RouterLink>
      </nav>
      <div class="sidebar-bottom"><div class="together-card"><strong>Voorspel het hele toernooi.</strong><p>Alles vóór de eerste aftrap.<br />Online of met de hand op papier.</p><button @click="navigate('rules')">Bekijk de puntentelling <ArrowUpRight :size="14" /></button></div></div>
    </aside>
    <button v-if="mobileMenu" class="menu-overlay" aria-label="Menu sluiten" @click="mobileMenu = false"></button>
    <div class="main-shell">
      <header class="topbar"><div class="flex items-center gap-3"><button class="mobile-toggle icon-button" aria-label="Menu openen" :aria-expanded="mobileMenu" @click="mobileMenu = true"><Menu :size="22" /></button><span class="breadcrumb">{{ form?.pool.name ?? 'Voetbalpool' }}</span></div><span v-if="form?.organisation" class="demo-badge"><span></span>{{ form.organisation }}</span></header>
      <main id="main-content">
        <div class="page-heading"><div><p class="eyebrow mb-2">VOORSPEL VOORAF. BELEEF HET SAMEN.</p><h1>{{ page === 'overview' ? `Het hele ${form?.tournament.type ?? 'toernooi'} op jouw formulier.` : 'Spelregels & punten' }}</h1><p class="page-description">{{ facts }}</p></div><span v-if="form" class="season-label"><Flag :size="15" /> {{ form.tournament.description }}</span></div>
        <div v-if="error" class="error-notice" role="alert">{{ error }}</div>

        <template v-if="page === 'overview'">
          <section class="hero"><div class="hero-content"><span class="hero-kicker"><span></span> ÉÉN KEER INVULLEN. EEN HEEL TOERNOOI SPANNING.</span><h2>Van de groepsfase<br /><span>tot de kampioen.</span></h2><p>Voorspel vooraf ruststanden, eindstanden en toto’s.<br />Kies je finalisten, topscorer en de verrassingen van het toernooi.</p><RouterLink to="/formulier" class="lime-button">{{ draft ? 'Verder met mijn formulier' : 'Online invullen' }}<ArrowUpRight :size="17" /></RouterLink><div class="hero-footnote"><Printer :size="14" /> Liever op papier? <RouterLink to="/print" class="text-link">Druk het formulier af</RouterLink></div></div><div class="hero-art" aria-hidden="true"><div class="pitch"><div class="pitch-circle"></div><div class="pitch-line"></div><div class="pitch-box"></div></div><div class="trophy-orbit"></div><div class="trophy-disc"><Trophy :size="106" :stroke-width="1.15" /></div><span class="art-star star-one">+</span><span class="art-star star-two">+</span><span class="art-label">JOUW VOORSPELLING. JOUW TOERNOOI.</span></div></section>
          <section class="stats-grid" aria-label="Voortgang formulier">
            <article class="stat-card"><div class="stat-top"><span>Jouw formulier</span><Target :size="18" /></div><div class="stat-value">{{ progress.percent }}<span class="stat-context">procent ingevuld</span></div><div class="progress-track" role="progressbar" :aria-valuenow="progress.done" :aria-valuemax="progress.total" :aria-valuemin="0" aria-label="Ingevulde velden"><span :style="{ width: `${progress.percent}%` }"></span></div></article>
            <article class="stat-card"><div class="stat-top"><span>Status</span><ShieldCheck :size="18" /></div><div class="status-value">{{ status.label }}</div><p>{{ status.text }}</p></article>
            <article class="stat-card"><div class="stat-top"><span>Inleverdeadline</span><Flag :size="18" /></div><div class="status-value">{{ deadline.label }}</div><p>{{ deadline.text }}</p></article>
            <article class="stat-card"><div class="stat-top"><span>Inleg</span><Users :size="18" /></div><div class="status-value">{{ form ? euro(form.pool.cost) : '…' }}</div><p>per formulier</p></article>
          </section>
          <section class="rules-card"><h2>Jouw pool, zoals op papier.</h2><p>Het online formulier is precies hetzelfde als de papieren versie. Vul het in op je computer of telefoon en stuur het in, of druk het af en lever het met de hand ingevuld in bij de organisatie.</p><p class="mt-3">Je voorspellingen hoeven niet onderling te kloppen. Je mag een ander team als kampioen kiezen dan je finalisten. Ook een uitslag van een knock-outwedstrijd telt los van de teams die je daar hebt ingevuld.</p><button class="text-link mt-4" @click="navigate('rules')">Alle regels en punten <ArrowUpRight :size="15" /></button></section>
        </template>

        <section v-if="page === 'rules'" class="rules-layout">
          <div class="rules-card"><span class="stat-icon"><Target :size="22" /></span><h2>Elk vak telt apart.</h2><p>Alles wordt vóór het toernooi ingevuld, inclusief de wedstrijden waarvan de teams nog onbekend zijn. Voorspellingen hoeven onderling niet consistent te zijn. Uitslagen gelden na 90 minuten plus blessuretijd, dus zonder verlenging en strafschoppen.</p>
            <template v-for="group in pointGroups" :key="group.category">
              <h3>{{ group.label }}</h3>
              <div v-for="point in group.items" :key="point.typeId" class="point-rule"><strong>{{ point.points }} <small>punten</small></strong><div><h3>{{ point.description }}</h3><p v-if="group.category === NUMBER_CATEGORY && point.margin">Goed bij een afwijking van maximaal ±{{ point.margin }}.</p></div></div>
            </template>
            <p v-if="rounds.length" class="rule-footnote">Finalerondes: punten voor een genoemd team óf (meer) voor het team op de juiste plek, niet allebei. Een team telt maximaal één keer per ronde mee.</p>
          </div>
          <div class="rules-card"><span class="stat-icon"><ShieldCheck :size="22" /></span><h2>Prijzen</h2>
            <p>Inleg {{ form ? euro(form.pool.cost) : '…' }} per formulier.</p>
            <p v-for="prize in prizes" :key="prize">{{ prize }}</p>
            <p>Finalerondepunten tellen op de dag waarop de teams bekend zijn. Eindstand, topscorer en aantallen tellen op de finaledag. Bij gelijke punten wordt de betreffende prijs gedeeld.</p>
            <h3>Inleveren</h3><p>{{ form?.pool.formsTill ? `Uiterlijk ${weekdayDate(form.pool.formsTill)}.` : 'De inleverdatum volgt nog.' }}</p>
          </div>
        </section>
        <footer class="page-footer"><span class="footer-brand">aftrap.</span><span>Voor de spanning. Voor de gezelligheid. Voor de eer.</span><span class="footer-demo">{{ form?.tournament.description }}</span></footer>
      </main>
    </div>
  </div>
</template>
