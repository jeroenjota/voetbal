<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ClipboardList, Save, ShieldCheck } from '@lucide/vue'
import PredictionField from './PredictionField.vue'
import {
  completedFields, fields, fixtures, groups, knockoutFixtures, rounds, teamSlots, totals,
} from '../pool'
import type { Answers, Field, SectionId } from '../pool'

const props = defineProps<{ answers: Answers; finished: boolean; dirty: boolean }>()
const emit = defineEmits<{ change: [id: string, value: string]; save: []; finish: []; reopen: [] }>()
const active = ref<SectionId>('participant')
const matchFilter = ref('all')
const sections: { id: SectionId; label: string }[] = [
  { id: 'participant', label: 'Deelnemer' },
  { id: 'groups', label: 'Groepsstanden' },
  { id: 'knockout', label: 'Finalerondes' },
  { id: 'matches', label: '51 wedstrijden' },
  { id: 'extras', label: 'Eindstand & extra’s' },
]
const fieldById = new Map(fields.map((field) => [field.id, field]))
function field(id: string): Field {
  const value = fieldById.get(id)
  if (!value) throw new Error(`Onbekend veld: ${id}`)
  return value
}
const visibleMatches = computed(() => fixtures.filter((match) => matchFilter.value === 'all'
  || match.group === matchFilter.value || match.round === matchFilter.value))
const filled = computed(() => completedFields(props.answers))
const missing = computed(() => fields.filter((item) => !props.answers[item.id]?.trim()))
const suggestions = computed(() => [...new Set([
  ...teamSlots, ...Object.entries(props.answers).filter(([id]) => id.startsWith('team.') || id === 'champion' || id === 'runnerUp').map(([, value]) => value.trim()),
])].filter(Boolean))
</script>

<template>
  <section class="entry-panel">
    <div class="entry-intro">
      <span class="stat-icon"><ClipboardList :size="21" /></span>
      <div><h2>Eén formulier. Het hele toernooi.</h2><p>Vul alles vóór het toernooi in. Elk vak wordt apart beoordeeld: tegenstrijdige voorspellingen zijn toegestaan.</p></div>
    </div>
    <div class="template-notice"><strong>EK 2028 · schemavoorbeeld</strong> — 6 groepen van 4 teams, 36 groepswedstrijden en 15 knock-outwedstrijden. A1 t/m F4 zijn teamplekken, geen bekende deelnemers. Nummering en koppelingen zijn een invultemplate op basis van het formulier uit 2021, niet het officiële EK 2028-schema. Wedstrijddatums en de gezamenlijke inleverdeadline moeten nog worden ingesteld.</div>
    <div v-if="finished" class="success-notice"><ShieldCheck :size="20" /><div><strong>Lokaal afgerond, niet ingezonden.</strong><br />Je formulier is op dit apparaat bewaard. Er is nog geen server of organisator die het ontvangt.</div></div>
    <div class="entry-tabs" role="group" aria-label="Onderdelen invulformulier">
      <button v-for="section in sections" :key="section.id" :class="{ selected: active === section.id }" :aria-pressed="active === section.id" @click="active = section.id">{{ section.label }}<small>{{ completedFields(answers, section.id) }}/{{ fields.filter((item) => item.section === section.id).length }}</small></button>
    </div>
    <datalist id="team-suggestions"><option v-for="team in suggestions" :key="team" :value="team"></option></datalist>

    <form @submit.prevent="emit('save')">
      <fieldset :disabled="finished" class="entry-body">
        <legend class="sr-only">{{ sections.find((section) => section.id === active)?.label }}</legend>
        <div v-if="active === 'participant'">
          <h3>Jouw gegevens</h3><p class="entry-description">Deze gegevens blijven alleen in deze browser. Inleg en betaling zijn nog niet gekoppeld; er wordt niets afgeschreven.</p>
          <div class="entry-fields"><PredictionField v-for="item in fields.filter((item) => item.section === 'participant')" :key="item.id" :field="item" :model-value="answers[item.id] ?? ''" @update:model-value="emit('change', item.id, $event)" /></div>
          <p class="privacy-note"><ShieldCheck :size="16" /> Gebruik bij een gedeeld apparaat geen echte contactgegevens zolang er geen accountbeveiliging is.</p>
        </div>

        <div v-if="active === 'groups'">
          <h3>Groepsstanden</h3><p class="entry-description">Vul per team een eindpositie van 1 t/m 4 in. Elke juiste positie: 5 punten. Deze standen worden niet uit je uitslagen berekend.</p>
          <div class="group-entry-grid"><section v-for="group in groups" :key="group" class="group-entry"><h4>Groep {{ group }}</h4><div v-for="slot in teamSlots.filter((slot) => slot.startsWith(group))" :key="slot" class="group-position"><span>{{ slot }} <small>team nog onbekend</small></span><PredictionField :field="field(`group.${slot}`)" :model-value="answers[`group.${slot}`] ?? ''" compact @update:model-value="emit('change', `group.${slot}`, $event)" /></div></section></div>
          <p class="entry-description">De eerste twee per groep en de vier beste nummers drie gaan door: 16 teams naar de achtste finales. Je mag in je voorspelling daarvan afwijken.</p>
        </div>

        <div v-if="active === 'knockout'">
          <h3>Teams in de finalerondes</h3><p class="entry-description">Kies per plek een land of teamplek (bijvoorbeeld A1). Alle rondes zijn onafhankelijk: je mag zelfs een team dat je als laatste in de groep zet, als finalist kiezen. 3A/D/E/F betekent een nummer drie uit één van die groepen; W41 betekent winnaar wedstrijd 41.</p>
          <section v-for="round in rounds" :key="round.name" class="round-entry"><div class="round-heading"><h4>{{ round.name }}</h4><span>{{ round.mentioned }} pt genoemd / {{ round.exact }} pt juiste plek</span></div>
            <div class="knockout-entry-grid"><article v-for="match in knockoutFixtures.filter((match) => match.round === round.name)" :key="match.id" class="knockout-entry"><h5>Wedstrijd {{ match.id }} <span>{{ match.home }} – {{ match.away }}</span></h5><PredictionField v-for="side in (['home', 'away'] as const)" :key="side" :field="field(`team.${match.id}.${side}`)" :model-value="answers[`team.${match.id}.${side}`] ?? ''" @update:model-value="emit('change', `team.${match.id}.${side}`, $event)" /></article></div>
          </section>
        </div>

        <div v-if="active === 'matches'">
          <h3>Alle 51 wedstrijdvoorspellingen</h3><p class="entry-description">Rust: 2 pt · Eind: 4 pt · Toto: 2 pt. Toto 1 = thuiswinst, 2 = uitwinst, 3 = gelijkspel. Alles na 90 minuten plus blessuretijd, dus zonder verlenging of strafschoppen. Rust, eind en toto mogen onderling afwijken. Ook onbekende teams houden hun vaste wedstrijdnummer.</p>
          <label class="match-filter">Toon wedstrijden <select v-model="matchFilter"><option value="all">Alle 51 wedstrijden</option><option v-for="group in groups" :key="group" :value="group">Groep {{ group }} (6)</option><option v-for="round in rounds" :key="round.name" :value="round.name">{{ round.name }} ({{ round.pairs.length }})</option></select></label>
          <div class="prediction-table-wrap"><table class="prediction-table"><thead><tr><th scope="col">Nr.</th><th scope="col">Wedstrijd / vaste plekken</th><th scope="col">Rust</th><th scope="col">Eind (90 min)</th><th scope="col">Toto</th></tr></thead><tbody>
            <tr v-for="match in visibleMatches" :key="match.id"><td>{{ match.id }}</td><td><strong>{{ match.home }} – {{ match.away }}</strong><small>{{ match.group ? `Groep ${match.group}` : match.round }}</small><small v-if="match.round && (answers[`team.${match.id}.home`] || answers[`team.${match.id}.away`])">Jouw teams: {{ answers[`team.${match.id}.home`] || '?' }} – {{ answers[`team.${match.id}.away`] || '?' }}</small></td>
              <td v-for="period in ['ht', 'ft']" :key="period"><div class="entry-score"><PredictionField v-for="side in ['home', 'away']" :key="side" :field="field(`match.${match.id}.${period}.${side}`)" :model-value="answers[`match.${match.id}.${period}.${side}`] ?? ''" compact @update:model-value="emit('change', `match.${match.id}.${period}.${side}`, $event)" /></div></td>
              <td><PredictionField :field="field(`match.${match.id}.toto`)" :model-value="answers[`match.${match.id}.toto`] ?? ''" compact @update:model-value="emit('change', `match.${match.id}.toto`, $event)" /></td>
            </tr>
          </tbody></table></div>
          <p class="entry-description">Dagbonus: 5 punten als je totale voorspelde aantal doelpunten op een speeldag klopt. Dit wordt pas berekend wanneer het echte speelschema en alle uitslagen van die dag beschikbaar zijn.</p>
        </div>

        <div v-if="active === 'extras'">
          <h3>Eindstand, topscorer & aantallen</h3><p class="entry-description">Ook deze voorspellingen staan los van de andere onderdelen.</p>
          <section class="extra-section"><h4>Eindstand <span>Kampioen: 50 pt · Tweede plaats: 36 pt</span></h4><div class="entry-fields"><PredictionField v-for="id in ['champion', 'runnerUp']" :key="id" :field="field(id)" :model-value="answers[id] ?? ''" @update:model-value="emit('change', id, $event)" /></div></section>
          <section class="extra-section"><h4>Topscorer <span>Naam: 30 pt · Aantal goals: 12 pt</span></h4><div class="entry-fields"><PredictionField v-for="id in ['topscorer', 'topscorerGoals']" :key="id" :field="field(id)" :model-value="answers[id] ?? ''" @update:model-value="emit('change', id, $event)" /></div></section>
          <section class="extra-section"><h4>Toernooitotalen <span>16 punten per juiste voorspelling binnen de marge</span></h4><div class="entry-fields"><div v-for="total in totals" :key="total.id"><PredictionField :field="field(`total.${total.id}`)" :model-value="answers[`total.${total.id}`] ?? ''" @update:model-value="emit('change', `total.${total.id}`, $event)" /><small class="tolerance">Toegestane afwijking: ±{{ total.tolerance }} (inclusief grens)</small></div></div></section>
        </div>
      </fieldset>
      <div class="entry-actions"><div><strong>{{ filled }} / {{ fields.length }} velden ingevuld</strong><small>{{ dirty ? 'Niet-opgeslagen wijzigingen' : finished ? 'Lokaal afgerond' : 'Concept · alleen op dit apparaat' }}</small></div><div class="entry-action-buttons"><button v-if="finished" type="button" class="secondary-button" @click="emit('reopen')">Concept heropenen</button><template v-else><button type="submit" class="secondary-button"><Save :size="15" /> Concept opslaan</button><button type="button" class="primary-button" @click="emit('finish')"><Check :size="15" /> Lokaal afronden</button></template></div></div>
    </form>
    <p v-if="!finished && missing.length" class="missing-summary">Nog {{ missing.length }} velden nodig voor afronden. Eerstvolgend: {{ missing.slice(0, 3).map((item) => item.label).join(', ') }}.</p>
  </section>
</template>
