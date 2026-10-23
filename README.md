# Aftrap — EK voetbalpool

Nederlandstalige, responsive frontend met Vue 3, TypeScript, Vite en **Tailwind CSS 4**. Tailwind is aangesloten via de officiële Vite-plugin en `@import "tailwindcss"`.

## Starten

Gebruik Node.js 22.12+ of 24+ en npm.

```sh
npm install
npm run dev
```

Open het adres dat Vite toont.

```sh
npm test        # Toernooiopzet, invulvalidatie, opslag en PDF-puntentelling
npm run build  # Typecontrole en productiebuild naar dist/
npm run preview
```

## In deze versie

- Eén vooraf in te vullen formulier op basis van `inschrijfform2021.pdf`.
- Naam, e-mail en telefoon; zes groepen van vier teams met apart voorspelde eindposities.
- 36 groepswedstrijden en 15 knock-outwedstrijden (8 + 4 + 2 + 1), elk met ruststand, eindstand en toto.
- Onafhankelijke teamkeuzes voor alle finalerondes, kampioen, tweede plaats, topscorer, topscorergoals en vijf toernooitotalen.
- Voorspellingen hoeven **niet** onderling te kloppen. Er worden geen standen, toto's of winnaars automatisch afgeleid. Dezelfde positie of hetzelfde team kan op meerdere plekken worden ingevuld.
- Concept opslaan in `localStorage`, lokaal afronden na volledigheidscontrole, en heropenen. Afronden is **geen inzending** naar een organisator.
- Responsive formulier, voortgang per onderdeel, filters per groep/ronde en expliciete opslagfouten. Niet-opgeslagen wijzigingen geven bij het verlaten van de pagina een browserwaarschuwing.

## Toernooi en placeholders

De eerste twee per groep plus de vier beste nummers drie vormen de zestien teams in de achtste finales. Vanaf daar gaan alleen winnaars door tot de finale; er is geen wedstrijd om de derde plaats. Zie ook [EK 2028 op Wikipedia](https://nl.wikipedia.org/wiki/Europees_kampioenschap_voetbal_2028).

**A1 t/m F4 zijn placeholders, geen officiële deelnemers.** De groepswedstrijdnummering is een round-robin-template per groep. De finalekoppelingen en W-verwijzingen zijn ontleend aan het formulier uit 2021, niet aan een officieel EK 2028-schema. Echte teamnamen, loting, wedstrijdnummering, datums en één gezamenlijke inleverdeadline moeten nog door een organisator worden ingesteld. Teamvoorspellingen zijn nu vrije tekst met suggesties; een backend moet die later aan echte team-ID's koppelen.

Er zijn geen fictieve uitslagen of deelnemerspunten meer. De ranglijst wacht op een backend en echte resultaten. Er is geen authenticatie, verzending, synchronisatie, betalingsverwerking of server-side deadlinecontrole. Bewaar op een gedeeld apparaat geen echte persoonsgegevens in dit prototype.

## Puntentelling uit de PDF

De functies in `src/pool.ts` ondersteunen:

| Onderdeel | Punten |
| --- | --- |
| Ruststand exact | 2 |
| Eindstand exact na 90 minuten plus blessuretijd | 4 |
| Toto (1 thuis, 2 uit, 3 gelijk) | 2 |
| Exact totaal doelpunten op een dag | 5 bonus |
| Juiste groepspositie per team | 5 |
| Achtste finale: team genoemd / juiste plek | 5 / 8 |
| Kwartfinale: team genoemd / juiste plek | 8 / 12 |
| Halve finale: team genoemd / juiste plek | 12 / 16 |
| Finale: team genoemd / juiste plek | 20 / 24 |
| Kampioen / tweede plaats | 50 / 36 |
| Topscorer / aantal goals | 30 / 12 |
| Gele kaarten (±4), rode kaarten (±2), penalty's in speeltijd (±1), gelijke spelen na 90 min (±3), toernooigoals (±5) | 16 per onderdeel |

Rust, eind en toto tellen op tot maximaal 8 punten per wedstrijd. Team- en uitslagvoorspellingen staan los van elkaar. Per finaleronde wordt de hoogste toepasselijke score gegeven, niet genoemd én juiste plek. Een werkelijk geplaatst team telt maximaal eenmaal per ronde: exacte plekken eerst, daarna overige genoemde teams. Teamnamen worden bij vergelijking getrimd en hoofdletterongevoelig vergeleken. Tolerantiegrenzen zijn inclusief.

`scoreEntry` berekent de onderdelen behalve de dagbonus; `dailyGoalsBonus` berekent die pas als alle voorspelde en werkelijke eindstanden van een aangeleverde speeldag compleet zijn. De aanroeper moet hiervoor de officiële wedstrijdnummers van die dag aanleveren. Beide functies verwachten gevalideerde invoer. De daadwerkelijke resultaatinvoer, verwerking per kalenderdag, gedeelde topscorers en centrale ranglijst zijn nog niet gekoppeld.

De spelregelpagina vermeldt ook de **voorbeeldprijzen uit 2021**, inclusief de afwijkende verdeling 50% / 15% / 30% / 5%. Dit zijn geen vastgestelde EK 2028-bedragen en er worden geen prijzen of betalingen uitgevoerd. Bij gelijke punten wordt volgens de PDF de betreffende prijs gedeeld, niet beslist op naam of aantal exacte uitslagen.

## Lokale opslag

Het nieuwe formulier gebruikt `aftrap:entry:v2`. Bestaande voorspellingen uit de vorige demo blijven onder hun oude sleutel ongewijzigd staan en worden niet automatisch geconverteerd, omdat die fictieve wedstrijden niet overeenkomen. De app meldt dit indien aanwezig. Corrupte nieuwe opslag blokkeert bewaren om onbedoeld overschrijven te voorkomen. Wis je browsergegevens, dan verdwijnt je lokale formulier.

## Bestaande database

`vbpool2-mariadb.sql` is ongewijzigd gelaten en wordt niet door de app ingelezen. Het exportbestand bevat persoonsgegevens en destructieve database-instructies. Het staat daarom in `.gitignore`, buiten `public/` en buiten de productiebuild. Importeer het niet zonder eerst de inhoud en doelomgeving te controleren. Publiceer alleen de gebouwde `dist/`-map, nooit de volledige projectmap of een Vite-ontwikkelserver op internet.

Een volgende stap is een aparte backend met authenticatie en autorisatie, een gezamenlijke server-side inleverdeadline vóór de toernooistart, echte inzendingen, uitslagverwerking en een zorgvuldig gemigreerde MariaDB-database.
