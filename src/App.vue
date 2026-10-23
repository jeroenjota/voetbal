<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  ArrowUpRight, Check, ChevronRight, CircleHelp, ClipboardList, Flag,
  Goal, House, Menu, ShieldCheck, Target, Trophy, X,
} from '@lucide/vue'
import EntryForm from './components/EntryForm.vue'
import {
  completedFields, completeMatches, fields, LEGACY_STORAGE_KEY, readEntry, rounds, STORAGE_KEY, totals, validateAnswers,
} from './pool'
import type { Answers, Entry } from './pool'

type Page = 'overview' | 'predictions' | 'standings' | 'rules'
const navigation = [
  { id: 'overview', label: 'Overzicht', icon: House },
  { id: 'predictions', label: 'Mijn formulier', icon: ClipboardList },
  { id: 'standings', label: 'Ranglijst', icon: Trophy },
  { id: 'rules', label: 'Spelregels', icon: CircleHelp },
] satisfies { id: Page; label: string; icon: typeof House }[]
const page = ref<Page>('overview')
const mobileMenu = ref(false)
const notice = ref('')
const error = ref('')
const legacyNotice = ref(false)
const saved = ref<Entry>({ version: 2, answers: {}, finished: false })
const answers = ref<Answers>({})
const loadFailed = ref(false)
try {
  saved.value = readEntry(window.localStorage)
  answers.value = { ...saved.value.answers }
  legacyNotice.value = window.localStorage.getItem(LEGACY_STORAGE_KEY) !== null
} catch (cause) {
  console.error('Formulier laden mislukt:', cause)
  loadFailed.value = true
  error.value = 'Het opgeslagen formulier kon niet worden geladen. Opslaan is geblokkeerd om bestaande gegevens niet te overschrijven. Controleer de browseropslag en laad de pagina opnieuw.'
}
const dirty = computed(() => JSON.stringify(answers.value) !== JSON.stringify(saved.value.answers))
const completed = computed(() => completedFields(answers.value))
const matchCount = computed(() => completeMatches(answers.value))
const progress = computed(() => Math.round(completed.value / fields.length * 100))
const title = computed(() => navigation.find((item) => item.id === page.value)?.label)

function navigate(next: Page) {
  page.value = next
  mobileMenu.value = false
}

function change(id: string, value: string) {
  if (saved.value.finished) return
  answers.value = { ...answers.value, [id]: value }
  notice.value = ''
}

function persist(finished: boolean) {
  if (loadFailed.value) return
  const invalid = validateAnswers(answers.value)
  if (invalid.length) {
    error.value = `Controleer deze invoer: ${invalid.slice(0, 5).join(', ')}. Gebruik geldige gehele aantallen en een geldig e-mailadres.`
    notice.value = ''
    return
  }
  if (finished && completed.value !== fields.length) {
    error.value = `Je formulier is nog niet compleet: ${fields.length - completed.value} velden ontbreken. Je kunt wel tussentijds een concept opslaan.`
    notice.value = ''
    return
  }
  const entry: Entry = { version: 2, answers: { ...answers.value }, finished }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry))
    saved.value = entry
    error.value = ''
    notice.value = finished ? 'Je volledige formulier is lokaal afgerond. Het is niet naar een organisator verzonden.' : 'Concept opgeslagen in deze browser.'
  } catch (cause) {
    console.error('Formulier opslaan mislukt:', cause)
    notice.value = ''
    error.value = 'Opslaan is mislukt. Je wijzigingen staan nog in het formulier, maar zijn niet bewaard. Controleer de browseropslag en probeer opnieuw.'
  }
}

window.addEventListener('beforeunload', (event) => {
  if (dirty.value) event.preventDefault()
})
</script>

<template>
  <div class="app-shell">
    <aside :class="['sidebar', { 'is-open': mobileMenu }]">
      <a href="#overzicht" class="brand" @click.prevent="navigate('overview')" aria-label="Aftrap, naar overzicht"><span class="brand-symbol"><Goal :size="25" /></span>aftrap<span class="brand-dot">.</span></a>
      <button class="mobile-close icon-button" aria-label="Menu sluiten" @click="mobileMenu = false"><X :size="22" /></button>
      <div class="pool-switch"><span class="pool-icon"><Trophy :size="20" /></span><div><strong>De grote EK-pool</strong><span>EK 2028 · Vooraf voorspellen</span></div><ShieldCheck :size="16" class="ml-auto text-lime-200" /></div>
      <p class="nav-label">JOUW POOL</p>
      <nav aria-label="Hoofdnavigatie"><button v-for="item in navigation" :key="item.id" :class="['nav-item', { active: page === item.id }]" :aria-current="page === item.id ? 'page' : undefined" @click="navigate(item.id)"><component :is="item.icon" :size="19" :stroke-width="1.7" />{{ item.label }}<span v-if="item.id === 'predictions'" class="nav-count">{{ matchCount }}/51</span></button></nav>
      <div class="sidebar-bottom"><div class="together-card"><strong>Voorspel het hele EK.</strong><p>Alles vóór de eerste aftrap.<br />Elk vak een eigen voorspelling.</p><button @click="navigate('rules')">Bekijk de puntentelling <ArrowUpRight :size="14" /></button></div><div class="sidebar-profile"><span class="avatar green">JI</span><div><strong>{{ answers.name || 'Jouw formulier' }}</strong><span>{{ saved.finished ? 'Lokaal afgerond' : 'Concept' }}</span></div></div></div>
    </aside>
    <button v-if="mobileMenu" class="menu-overlay" aria-label="Menu sluiten" @click="mobileMenu = false"></button>
    <div class="main-shell">
      <header class="topbar"><div class="flex items-center gap-3"><button class="mobile-toggle icon-button" aria-label="Menu openen" :aria-expanded="mobileMenu" @click="mobileMenu = true"><Menu :size="22" /></button><span class="breadcrumb">De grote EK-pool <ChevronRight :size="14" /><strong>{{ title }}</strong></span></div><span class="demo-badge"><span></span> Lokaal prototype</span></header>
      <main id="main-content">
        <div class="page-heading"><div><p class="eyebrow mb-2">VOORSPEL VOORAF. BELEEF HET SAMEN.</p><h1>{{ page === 'overview' ? 'Het hele EK op jouw formulier.' : title }}</h1><p class="page-description">6 groepen · 24 teams · 36 groepswedstrijden · 15 knock-outwedstrijden</p></div><span class="season-label"><Flag :size="15" /> EK 2028</span></div>
        <div v-if="error" class="error-notice" role="alert">{{ error }}</div>
        <div v-if="notice" class="success-notice" role="status"><Check :size="16" />{{ notice }}</div>
        <div v-if="legacyNotice" class="template-notice">Er zijn nog voorspellingen uit de oude demo in deze browser. Die blijven ongewijzigd bewaard, maar worden niet overgenomen: de fictieve wedstrijden en puntentelling hoorden niet bij dit nieuwe formulier.</div>

        <template v-if="page === 'overview'">
          <section class="hero"><div class="hero-content"><span class="hero-kicker"><span></span> ÉÉN KEER INVULLEN. EEN HEEL TOERNOOI SPANNING.</span><h2>Van de groepsfase<br /><span>tot de kampioen.</span></h2><p>Voorspel vooraf ruststanden, eindstanden en toto’s.<br />Kies je finalisten, topscorer en de verrassingen van het EK.</p><button class="lime-button" @click="navigate('predictions')">{{ completed ? 'Verder met mijn formulier' : 'Begin met invullen' }}<ArrowUpRight :size="17" /></button><div class="hero-footnote"><ShieldCheck :size="14" /> Onafhankelijke voorspellingen · lokaal opgeslagen</div></div><div class="hero-art" aria-hidden="true"><div class="pitch"><div class="pitch-circle"></div><div class="pitch-line"></div><div class="pitch-box"></div></div><div class="trophy-orbit"></div><div class="trophy-disc"><Trophy :size="106" :stroke-width="1.15" /></div><span class="art-star star-one">+</span><span class="art-star star-two">+</span><span class="art-label">JOUW VOORSPELLING. JOUW EK.</span></div></section>
          <section class="stats-grid" aria-label="Voortgang formulier">
            <article class="stat-card"><div class="stat-top"><span>Wedstrijdvoorspellingen</span><ClipboardList :size="18" /></div><div class="stat-value">{{ matchCount }}<span class="stat-context">/ 51 compleet</span></div><p>Rust, eind en toto ingevuld</p></article>
            <article class="stat-card"><div class="stat-top"><span>Het hele formulier</span><Target :size="18" /></div><div class="stat-value">{{ progress }}<span class="stat-context">procent ingevuld</span></div><div class="progress-track" role="progressbar" :aria-valuenow="completed" :aria-valuemax="fields.length" :aria-valuemin="0" aria-label="Ingevulde velden"><span :style="{ width: `${progress}%` }"></span></div></article>
            <article class="stat-card"><div class="stat-top"><span>Status</span><ShieldCheck :size="18" /></div><div class="status-value">{{ saved.finished ? 'Afgerond' : 'Concept' }}</div><p>{{ dirty ? 'Niet-opgeslagen wijzigingen' : 'Alleen op dit apparaat' }}</p></article>
            <article class="stat-card"><div class="stat-top"><span>Inleverdeadline</span><Flag :size="18" /></div><div class="status-value">Nog instellen</div><p>Eén deadline vóór de toernooistart</p></article>
          </section>
          <section class="rules-card"><h2>Jouw pool, zoals op papier.</h2><p>De eerste twee teams van elke groep en de vier beste nummers drie bereiken de achtste finales. Daarna gaan alleen de winnaars door: 8 achtste finales, 4 kwartfinales, 2 halve finales en 1 finale.</p><p class="mt-3">Je voorspellingen hoeven niet onderling te kloppen. Je mag een ander team als kampioen kiezen dan je finalisten. Ook een uitslag van een knock-outwedstrijd telt los van de teams die je daar hebt ingevuld.</p><button class="text-link mt-4" @click="navigate('rules')">Alle regels en punten <ArrowUpRight :size="15" /></button></section>
        </template>

        <EntryForm v-if="page === 'predictions'" :answers="answers" :finished="saved.finished" :dirty="dirty" @change="change" @save="persist(false)" @finish="persist(true)" @reopen="persist(false)" />

        <section v-if="page === 'standings'" class="rules-card"><span class="stat-icon"><Trophy :size="22" /></span><h2>De ranglijst volgt na de aftrap.</h2><p>Er zijn nog geen echte deelnemers of resultaten gekoppeld. Daarom tonen we geen fictieve punten. De puntentelling voor alle onderdelen is voorbereid op de regels uit het inschrijfformulier; een centrale ranglijst, dagprijzen en betalingen vereisen een backend.</p></section>

        <section v-if="page === 'rules'" class="rules-layout">
          <div class="rules-card"><span class="stat-icon"><Target :size="22" /></span><h2>Elk vak telt apart.</h2><p>Alles wordt vóór het toernooi ingevuld, inclusief de wedstrijden waarvan de teams nog onbekend zijn. Voorspellingen hoeven onderling niet consistent te zijn.</p>
            <div class="point-rule"><strong>2 <small>punten</small></strong><div><h3>Ruststand goed</h3><p>De exacte ruststand klopt.</p></div></div>
            <div class="point-rule"><strong>4 <small>punten</small></strong><div><h3>Eindstand goed</h3><p>De exacte stand na 90 minuten plus blessuretijd klopt.</p></div></div>
            <div class="point-rule"><strong>2 <small>punten</small></strong><div><h3>Toto goed</h3><p>1 = winst thuis, 2 = winst uit, 3 = gelijkspel. Apart ingevuld en apart beoordeeld.</p></div></div>
            <div class="point-rule"><strong>5 <small>bonus</small></strong><div><h3>Dagtotalen doelpunten</h3><p>Het totale voorspelde aantal doelpunten op een speeldag klopt.</p></div></div>
            <p class="rule-footnote">Punten tellen op: maximaal 8 per wedstrijd, plus de dagbonus. Geen verlenging of strafschoppen, ook niet in de knock-outfase. Een gelijkspel na 90 minuten is daar dus mogelijk.</p>
            <h3>Groepsstanden</h3><p>5 punten voor elke juist ingevulde eindpositie, onafhankelijk van je wedstrijdvoorspellingen.</p>
            <h3>Finalerondes</h3><p v-for="round in rounds" :key="round.name">{{ round.name }}: {{ round.mentioned }} punten voor een genoemd team, of {{ round.exact }} punten voor het team op de juiste plek (niet beide). Een team telt maximaal één keer per ronde mee.</p>
            <h3>Eindstand en topscorer</h3><p>Kampioen: 50 pt. Tweede plaats: 36 pt. Naam topscorer: 30 pt. Aantal goals topscorer: 12 pt. Elk onderdeel telt onafhankelijk.</p>
            <h3>Toernooitotalen</h3><p v-for="total in totals" :key="total.id">{{ total.label }}: 16 punten bij een afwijking van maximaal ±{{ total.tolerance }}.</p>
          </div>
          <div class="rules-card"><span class="stat-icon"><ShieldCheck :size="22" /></span><h2>Goed om te weten</h2><h3>De opzet van het EK</h3><p>Zes groepen van vier teams spelen elk zes wedstrijden. De eerste twee en vier beste nummers drie gaan door. Daarna volgen 15 knock-outwedstrijden, zonder wedstrijd om de derde plaats.</p><h3>Geen officiële EK 2028-loting</h3><p>De teams A1 t/m F4 en het schema zijn placeholders. De finalekoppelingen volgen het voorbeeld uit 2021 en moeten nog worden vervangen door het officiële EK 2028-schema. Er zijn geen fictieve uitslagen meer.</p><h3>Eén gezamenlijke inleverdeadline</h3><p>Je vult alle onderdelen vooraf in, niet per wedstrijddag. De organisator moet de deadline nog instellen. In dit lokale prototype is er geen servercontrole: lokaal afronden is geen echte inzending en kan weer worden geopend.</p><h3>Bewaren en privacy</h3><p>Concepten en afgeronde formulieren staan alleen in deze browser. Geen account, verzending of synchronisatie. Wis je browsergegevens, dan verdwijnt het formulier.</p><h3>Prijzen uit het voorbeeld (2021)</h3><p>Inleg € 10. Dagwinnaar € 2,50; leider totaalstand € 1; laatste in totaalstand € 0,10. Rode lantaarn aan het einde: € 10. Resterende pot: 1e 50%, 2e 15%, 3e 30%, 4e 5%. Bij gelijke punten wordt de betreffende prijs gedeeld.</p><p>Finalerondepunten tellen op de dag waarop de teams bekend zijn. Eindstand, topscorer en aantallen tellen op de finaledag. Dit zijn de bedragen en regels uit de PDF, geen ingestelde EK 2028-betalingen. Dagprijzen en uitbetalingen zijn niet geïmplementeerd.</p><h3>Bronnen</h3><p>Het lokale inschrijfformulier uit 2021 en <a class="source-link" href="https://nl.wikipedia.org/wiki/Europees_kampioenschap_voetbal_2028" target="_blank" rel="noopener noreferrer">Wikipedia: EK voetbal 2028</a>.</p></div>
        </section>
        <footer class="page-footer"><span class="footer-brand">aftrap.</span><span>Voor de spanning. Voor de gezelligheid. Voor de eer.</span><span class="footer-demo">EK 2028 <span>·</span> Lokaal prototype</span></footer>
      </main>
    </div>
  </div>
</template>
