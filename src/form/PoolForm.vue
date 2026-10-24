<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  euro, knockoutRounds, longDate, numberLabel, numberTypes, pointsFor, shortDay, standingPlaces, weekdayDate,
} from '../../shared/entry'
import type { KnockoutRound } from '../../shared/entry'
import { MATCH_TYPES, POINTS } from '../../shared/types'
import type { EntryPrediction, FormData, FormMatch } from '../../shared/types'
import '@fontsource/carlito/400.css'
import '@fontsource/carlito/400-italic.css'
import '@fontsource/carlito/700.css'
import '@fontsource/carlito/700-italic.css'
import '@fontsource/comic-neue/400.css'
import './form.css'

/**
 * The entry form, laid out exactly like the VBPool2 paper form (A4, two pages).
 * print: read-only, for a blank or filled-in printout; online: participant fills it in; admin: also payment fields.
 */
const props = withDefaults(defineProps<{ form: FormData; mode: 'print' | 'online' | 'admin'; validate?: boolean }>(), { validate: false })
const entry = defineModel<EntryPrediction>({ required: true })

const readonly = computed(() => props.mode === 'print')
const pool = computed(() => props.form.pool)
const tournament = computed(() => props.form.tournament)
const title = computed(() => `${props.form.organisation} - ${pool.value.name}`.replace(/^ - /, ''))
const points = computed(() => props.form.points)
const pts = (typeId: number) => pointsFor(points.value, typeId)

const teamsPerGroup = computed(() => Math.max(1, ...props.form.groups.map((group) => group.teams.length)))
const groupPoints = computed(() => pts(POINTS.group))

const rounds = computed(() => knockoutRounds(props.form))
const eighth = computed(() => rounds.value.find((round) => round.type === MATCH_TYPES.eighth))
const quarter = computed(() => rounds.value.find((round) => round.type === MATCH_TYPES.quarter))
const semi = computed(() => rounds.value.find((round) => round.type === MATCH_TYPES.semi))
const third = computed(() => rounds.value.find((round) => round.type === MATCH_TYPES.third))
const final = computed(() => rounds.value.find((round) => round.type === MATCH_TYPES.final))
const bestThirds = computed(() => {
  const codes = (eighth.value?.matches ?? []).flatMap((match) => [match.codeA, match.codeB])
  return codes.filter((code) => /^3[A-P]{2,}$/.test(code)).length
})

const standings = computed(() => standingPlaces(points.value))
const topscorerPoints = computed(() => pts(POINTS.topscorer1))
const topscorerGoalPoints = computed(() => pts(POINTS.topscorer1Goals))
const numbers = computed(() => numberTypes(points.value))
const percentages = computed(() => pool.value.prizePercentages.map((value, index) => ({ place: index + 1, value }))
  .filter((prize) => prize.place === 1 || prize.value > 0))

const teams = computed(() => [...props.form.teams].sort((a, b) => a.name.localeCompare(b.name, 'nl')))
const playersByTeam = computed(() => {
  const map = new Map<string, { id: number; name: string }[]>()
  for (const player of props.form.players) {
    if (!map.has(player.teamName)) map.set(player.teamName, [])
    map.get(player.teamName)!.push(player)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'nl'))
})

const half = computed(() => Math.ceil(props.form.matches.length / 2))
const columns = computed(() => [props.form.matches.slice(0, half.value), props.form.matches.slice(half.value)])
const rowHeight = computed(() => `${Math.min(6.55, 212 / Math.max(1, half.value + 1)).toFixed(2)}mm`)

function roundPoints(round: KnockoutRound | undefined, long: boolean): string {
  if (!round || round.teamPoints === null) return ''
  if (round.positionPoints === null) return long ? `(${round.teamPoints} pnt per genoemd team)` : `(${round.teamPoints}pnt)`
  return long
    ? `(${round.teamPoints} pnt per genoemd team / ${round.positionPoints} pnt voor team op de juiste plaats)`
    : `(${round.teamPoints} / ${round.positionPoints}pnt)`
}

function showDate(column: FormMatch[], index: number): boolean {
  return index === 0 || column[index]!.date !== column[index - 1]!.date
}

function matchLabel(match: FormMatch): string {
  if (match.teamA && match.teamB) return `${match.codeA}:${match.teamA.name} - ${match.codeB}:${match.teamB.name}`
  return `${match.codeA} - ${match.codeB}`
}

function duplicate(letter: string, index: number): boolean {
  const values = entry.value.groups[letter] ?? []
  const value = values[index]
  return value != null && values.filter((other) => other === value).length > 1
}

/** Parse a typed number; strips everything but digits and keeps the input in sync with the model. */
function parse(event: Event, max: number): number | null {
  const input = event.target as HTMLInputElement
  const digits = input.value.replace(/\D/g, '')
  const value = digits === '' ? null : Math.min(Number(digits), max)
  input.value = value === null ? '' : String(value)
  return value
}

function parseRange(event: Event, min: number, max: number): number | null {
  const input = event.target as HTMLInputElement
  const digit = input.value.replace(/\D/g, '').slice(-1)
  const value = digit === '' || Number(digit) < min || Number(digit) > max ? null : Number(digit)
  input.value = value === null ? '' : String(value)
  return value
}

function setGroup(letter: string, index: number, event: Event) {
  entry.value.groups[letter]![index] = parseRange(event, 1, teamsPerGroup.value)
}
function setFinal(match: FormMatch, side: 0 | 1, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  entry.value.finals[String(match.number)]![side] = value ? Number(value) : null
}
function setScore(match: FormMatch, key: 'htA' | 'htB' | 'ftA' | 'ftB', event: Event) {
  entry.value.matches[String(match.number)]![key] = parse(event, 99)
}
function setToto(match: FormMatch, event: Event) {
  entry.value.matches[String(match.number)]!.toto = parseRange(event, 1, 3)
}
function setStanding(index: number, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  entry.value.standings[index] = value ? Number(value) : null
}
function setTopscorer(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  entry.value.topscorer.playerId = value ? Number(value) : null
}
function setNumber(typeId: number, event: Event) {
  entry.value.numbers[String(typeId)] = parse(event, 9999)
}
const scoreKey = (part: 'ht' | 'ft', side: 'A' | 'B') => `${part}${side}` as const
// Shrink the A4 sheets on narrow screens (phones); printing always uses the real size.
const root = ref<HTMLElement>()
const scale = ref(1)
let observer: ResizeObserver | undefined
onMounted(() => {
  const parent = root.value?.parentElement
  if (!parent || typeof ResizeObserver === 'undefined') return
  observer = new ResizeObserver(([item]) => {
    const available = (item?.contentRect.width ?? 0) - 16
    scale.value = available > 0 ? Math.min(1, available / (210 * 96 / 25.4)) : 1
  })
  observer.observe(parent)
})
onBeforeUnmount(() => observer?.disconnect())

const show = (value: number | null | undefined) => value ?? ''
</script>

<template>
  <div ref="root" :class="['pf', `pf-${mode}`, { 'pf-validate': validate }]" :style="scale < 1 ? { zoom: scale } : undefined">
    <!-- ================= page 1 ================= -->
    <section class="pf-sheet" aria-label="Inschrijfformulier, pagina 1"><div class="pf-page">
      <h1 class="pf-title">{{ title }}</h1>
      <div class="pf-bar pf-main-bar">Inschrijfformulier<span class="pf-gap"></span>inleg: {{ euro(pool.cost) }}</div>

      <div class="pf-person">
        <div class="pf-person-row">
          <label class="pf-person-label" for="pf-name">Naam:</label>
          <input id="pf-name" v-model="entry.name" class="pf-line pf-line-name" autocomplete="name" maxlength="130" :disabled="readonly" required />
          <label class="pf-person-label" for="pf-phone">Telefoon:</label>
          <input id="pf-phone" v-model="entry.telephone" class="pf-line pf-line-rest" type="tel" autocomplete="tel" maxlength="20" :disabled="readonly" required />
        </div>
        <div class="pf-person-row">
          <label class="pf-person-label" for="pf-email">Email:</label>
          <input id="pf-email" v-model="entry.email" class="pf-line pf-line-email" type="email" autocomplete="email" maxlength="255" :disabled="readonly" required />
          <label class="pf-person-label" for="pf-payed">Betaald</label>
          <span class="pf-check"><input id="pf-payed" v-model="entry.payed" type="checkbox" :disabled="mode !== 'admin'" /></span>
          <label class="pf-person-label pf-bij" for="pf-payed-to">bij:</label>
          <input id="pf-payed-to" v-model="entry.payedTo" class="pf-line pf-line-rest" maxlength="50" :disabled="mode !== 'admin'" />
        </div>
      </div>

      <h2 class="pf-heading">Instructies</h2>
      <p class="pf-text">
        Hier onder ({{ mode === 'print' ? 'en op de achterkant' : 'en verderop' }}) kun je voorspellingen invoeren voor de {{ tournament.description }}
        <template v-if="tournament.startDate"> van {{ longDate(tournament.startDate) }} tot {{ longDate(tournament.endDate) }}</template><br />
        Voor elke juiste voorspelling krijg je punten, bij de verschillende onderdelen staat hoeveel.<br />
        De voorspellingen hoeven niet te kloppen, je kunt bijvoorbeeld een team dat bij jou in de groepsfase laatste wordt toch de<br />
        halve finale laten spelen, of een team dat niet in de finale staat toch kampioen maken.
        <template v-if="bestThirds"><br />De beste {{ bestThirds }} derde plaatsen kwalificeren zich ook voor de 8e finales.</template>
      </p>

      <h2 class="pf-heading">Prijzen</h2>
      <p class="pf-text">
        -&nbsp; <b>Per dag</b> zijn de volgende geldprijzen te verdienen:<br />
        <span class="pf-i1">-&nbsp; Degene die op <i>één dag de meeste punten</i> heeft verzameld,&nbsp; krijgt daarvoor <b>{{ euro(pool.prizeHighDayScore) }}</b></span><br />
        <span class="pf-i1">-&nbsp; Degene die na een dag in de <i>totaalstand bovenaan</i> staat,&nbsp; krijgt daarvoor <b>{{ euro(pool.prizeHighDayPosition) }}</b></span><br />
        <span class="pf-i1">-&nbsp; Degene die na een dag in de <i>totaalstand onderaan</i> staat,&nbsp; krijgt daarvoor als troost <b>{{ euro(pool.prizeLowDayPosition) }}</b></span><br />
        <span class="pf-i1">-&nbsp; De punten voor de finalerondes tellen mee voor de dagprijs op de dag dat de teams bekend zijn</span><br />
        <span class="pf-i2">De punten voor de eindstand, topscorers en aantallen tellen op de dag van de finale mee voor de dagprijs</span><br />
        -&nbsp; <b>Aan het eind van het toernooi</b> zijn de volgende geldprijzen te verdienen:<br />
        <template v-if="pool.prizeLowFinalPosition > 0">
          <span class="pf-i1">-&nbsp; De <i class="pf-red">rode lantaarn</i> ontvangt als troostprijs {{ euro(pool.prizeLowFinalPosition) }}</span><br />
        </template>
        <span class="pf-i1">-&nbsp; De <i>hoogste</i> deelnemers in de totaalstand krijgen de volgende prijzen:</span><br />
        <span class="pf-i2"><template v-for="(prize, index) in percentages" :key="prize.place">{{ index ? ', ' : '' }}{{ prize.place }}e pl: <b>{{ prize.value }}%</b></template> van de totale inleg (minus de dagprijzen en de rode lantaarn)</span><br />
        -&nbsp; <i>Bij een gelijk aantal punten wordt de betreffende prijs verdeeld</i>
      </p>

      <div class="pf-section pf-groups">
        <div class="pf-bar pf-section-bar">Groepsstanden <small>Vul in: 1 t/m {{ teamsPerGroup }}<template v-if="groupPoints !== null"> ({{ groupPoints }} pnt per correcte invoer)</template></small></div>
        <div class="pf-group-grid" :style="{ gridTemplateColumns: `repeat(${form.groups.length}, 1fr)` }">
          <div v-for="group in form.groups" :key="group.letter" class="pf-group">
            <strong>Groep {{ group.letter }}</strong>
            <label v-for="(team, index) in group.teams" :key="team.place" class="pf-group-row">
              <span>{{ team.name }}</span>
              <input
                :class="['pf-box', { 'pf-dup': duplicate(group.letter, index) }]" inputmode="numeric" maxlength="1" required :pattern="`[1-${teamsPerGroup}]`"
                :aria-label="`Groep ${group.letter}, positie van ${team.name}`" :disabled="readonly"
                :value="show(entry.groups[group.letter]?.[index])" @input="setGroup(group.letter, index, $event)"
              />
            </label>
          </div>
        </div>
      </div>

      <div v-for="round in [eighth, quarter].filter((item) => item !== undefined)" :key="round.type" class="pf-section">
        <div class="pf-bar pf-section-bar">{{ round.title }} <small>{{ roundPoints(round, true) }}</small></div>
        <div class="pf-ko-grid">
          <div v-for="match in round.matches" :key="match.number" class="pf-ko">
            <span class="pf-ko-nr">{{ match.number }}:</span>
            <div class="pf-ko-box">
              <label v-for="side in ([0, 1] as const)" :key="side" class="pf-ko-row">
                <span>{{ side ? match.codeB : match.codeA }}:</span>
                <select :disabled="readonly" required :aria-label="`${round.short} ${match.number}, ${side ? match.codeB : match.codeA}`" :value="show(entry.finals[match.number]?.[side])" @change="setFinal(match, side, $event)">
                  <option value=""></option>
                  <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div class="pf-ko-final-row">
        <template v-for="(round, slot) in [semi, third, final]" :key="slot">
          <div v-if="round" :class="['pf-section', `pf-span-${round.matches.length}`]">
            <div class="pf-bar pf-section-bar">{{ round.title }} <small>{{ roundPoints(round, false) }}</small></div>
            <div class="pf-ko-grid" :style="{ gridTemplateColumns: `repeat(${round.matches.length}, 1fr)` }">
              <div v-for="match in round.matches" :key="match.number" class="pf-ko">
                <span class="pf-ko-nr">{{ match.number }}:</span>
                <div class="pf-ko-box">
                  <label v-for="side in ([0, 1] as const)" :key="side" class="pf-ko-row">
                    <span>{{ side ? match.codeB : match.codeA }}:</span>
                    <select :disabled="readonly" required :aria-label="`${round.short} ${match.number}, ${side ? match.codeB : match.codeA}`" :value="show(entry.finals[match.number]?.[side])" @change="setFinal(match, side, $event)">
                      <option value=""></option>
                      <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="slot === 1" class="pf-section pf-span-1" aria-hidden="true">
            <div class="pf-bar pf-section-bar">&nbsp;</div>
            <div class="pf-hatch"></div>
          </div>
        </template>
      </div>

      <div class="pf-bottom">
        <div class="pf-panel pf-panel-standing">
          <div class="pf-bar pf-panel-bar">Eindstand</div>
          <label v-for="place in standings" :key="place.typeId" class="pf-cell pf-standing">
            <span>{{ place.label }}:</span>
            <select :disabled="readonly" required :aria-label="`Eindstand ${place.label} plaats`" :value="show(entry.standings[place.index])" @change="setStanding(place.index, $event)">
              <option value=""></option>
              <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
            </select>
            <span v-if="place.points !== null">({{ place.points }}p)</span>
          </label>
        </div>
        <div class="pf-panel pf-panel-topscorer">
          <div class="pf-bar pf-panel-bar">Topscorer &amp; aantal goals</div>
          <div class="pf-topscorer">
            <label v-if="topscorerPoints !== null" class="pf-cell pf-topscorer-name">
              <select :disabled="readonly" required aria-label="Topscorer" :value="show(entry.topscorer.playerId)" @change="setTopscorer">
                <option value=""></option>
                <optgroup v-for="[team, players] in playersByTeam" :key="team" :label="team">
                  <option v-for="player in players" :key="player.id" :value="player.id">{{ player.name }}</option>
                </optgroup>
              </select>
              <span>({{ topscorerPoints }}p)</span>
            </label>
            <label v-if="topscorerGoalPoints !== null" class="pf-cell pf-topscorer-goals">
              <input inputmode="numeric" maxlength="2" required aria-label="Aantal goals van de topscorer" :disabled="readonly" :value="show(entry.topscorer.goals)" @input="entry.topscorer.goals = parse($event, 99)" />
              <span>({{ topscorerGoalPoints }}p)</span>
            </label>
          </div>
        </div>
        <div class="pf-panel pf-panel-numbers">
          <div class="pf-bar pf-panel-bar">Aantallen</div>
          <label v-for="point in numbers" :key="point.typeId" class="pf-number">
            <span class="pf-cell">{{ numberLabel(point) }}(±{{ point.margin }}, {{ point.points }}p):</span>
            <input class="pf-cell" inputmode="numeric" maxlength="4" required :aria-label="point.description" :disabled="readonly" :value="show(entry.numbers[point.typeId])" @input="setNumber(point.typeId, $event)" />
          </label>
        </div>
      </div>

      <footer class="pf-footer">Voetbalpool © Jota Services 2004-{{ tournament.year }}</footer>
    </div></section>

    <!-- ================= page 2 ================= -->
    <section class="pf-sheet" aria-label="Inschrijfformulier, pagina 2: wedstrijdvoorspellingen"><div class="pf-page">
      <h1 class="pf-title">{{ title }}</h1>
      <div class="pf-bar pf-main-bar">Wedstrijdvoorspellingen</div>

      <h2 class="pf-heading">Uitleg</h2>
      <p class="pf-text pf-text-12">
        Vul hieronder voor alle wedstrijden jouw uitslagen in. <b>Ook daar waar de teams nog niet bekend zijn.</b><br />
        (Ook al heb je een ander team op die plaats dan kan je uitslag nog steeds goed zijn)<br />
        De uitslag hoeft onderling niet te kloppen. Je krijgt punten voor elk vak dat achteraf juist blijkt te zijn ingevuld.<br />
        Bij 'toto' vul je een 1 in voor winst linker team, een 2 voor winst rechter team en een 3 voor een gelijkspel
      </p>
      <p class="pf-center"><b>Alle uitslagen, ook de toto, gelden na 90 minuten voetbal!</b></p>
      <p class="pf-center pf-small">(plus de eventuele blessuretijd)</p>

      <h2 class="pf-heading">Punten</h2>
      <p class="pf-text">
        <template v-if="pts(POINTS.ht) !== null">Ruststand goed:&nbsp; <b>{{ pts(POINTS.ht) }} pnt</b>, </template>
        <template v-if="pts(POINTS.ft) !== null">Eindstand goed:&nbsp; <b>{{ pts(POINTS.ft) }} pnt</b>, </template>
        <template v-if="pts(POINTS.toto) !== null">Toto goed:&nbsp; <b>{{ pts(POINTS.toto) }} pnt</b>. </template>
        <template v-if="pts(POINTS.dayGoals) !== null"><b>BONUS</b>: aantal doelpunten op één dag klopt:&nbsp; <b>{{ pts(POINTS.dayGoals) }}&nbsp; pnt</b></template>
      </p>

      <div class="pf-matches" :style="{ '--pf-row': rowHeight }">
        <table v-for="(column, columnIndex) in columns" :key="columnIndex" class="pf-match-table">
          <colgroup><col class="c-date" /><col class="c-time" /><col class="c-nr" /><col class="c-match" /><col class="c-score" /><col class="c-score" /><col class="c-toto" /></colgroup>
          <thead><tr><th>Datum</th><th>tijd</th><th>nr</th><th class="pf-left">Wedstrijd</th><th>rust</th><th>eind</th><th>toto</th></tr></thead>
          <tbody>
            <tr v-for="(match, index) in column" :key="match.number">
              <td>{{ showDate(column, index) ? shortDay(match.date) : '' }}</td>
              <td class="pf-time">{{ match.time ?? '' }}</td>
              <td class="pf-nr">{{ match.number }}</td>
              <td :class="['pf-match-name', { 'pf-small-name': match.teamA && match.teamB }]">{{ matchLabel(match) }}</td>
              <td v-for="part in (['ht', 'ft'] as const)" :key="part" class="pf-score-cell">
                <span class="pf-score">
                  <input inputmode="numeric" maxlength="2" required :aria-label="`Wedstrijd ${match.number}, ${part === 'ht' ? 'rust' : 'eind'}stand ${match.codeA}`" :disabled="readonly" :value="show(entry.matches[match.number]?.[scoreKey(part, 'A')])" @input="setScore(match, scoreKey(part, 'A'), $event)" />
                  <span>-</span>
                  <input inputmode="numeric" maxlength="2" required :aria-label="`Wedstrijd ${match.number}, ${part === 'ht' ? 'rust' : 'eind'}stand ${match.codeB}`" :disabled="readonly" :value="show(entry.matches[match.number]?.[scoreKey(part, 'B')])" @input="setScore(match, scoreKey(part, 'B'), $event)" />
                </span>
              </td>
              <td class="pf-score-cell">
                <span class="pf-score pf-toto">
                  <input inputmode="numeric" maxlength="1" required pattern="[1-3]" :aria-label="`Wedstrijd ${match.number}, toto`" :disabled="readonly" :value="show(entry.matches[match.number]?.toto)" @input="setToto(match, $event)" />
                </span>
              </td>
            </tr>
            <tr v-for="filler in half - column.length" :key="`filler-${filler}`"><td v-for="cell in 7" :key="cell">&nbsp;</td></tr>
          </tbody>
        </table>
      </div>

      <div v-if="pool.formsTill" class="pf-bar pf-deadline">UITERLIJK INLEVEREN OP {{ weekdayDate(pool.formsTill).toUpperCase() }}</div>
    </div></section>
  </div>
</template>
