# Aftrap — voetbalpool

Pool-app voor een EK/WK-voorspellingspool. Deelnemers vullen hetzelfde formulier in, online of op papier. De organisator beheert toernooi, teams, spelers, wedstrijdschema, punten en deelnemersformulieren in de beheermodule.

- **Frontend**: Vue 3, TypeScript, Vite en Tailwind CSS 4 (`src/`).
- **API**: Express, zod en mariadb (`server/`).
- **Database**: de bestaande VBPool2 MariaDB-database (`voetbalpool`). De tabellen worden gedeeld met het VB6-programma; de app voegt alleen een tabel en drie kolommen toe.
- **Gedeelde code**: types en formulierlogica die frontend en API allebei gebruiken (`shared/`).

## Starten

Gebruik Node.js 22.12+ of 24+, npm en een draaiende MariaDB met de VBPool2-database.

```sh
npm install
cp server/.env.example server/.env   # vul DB_USER en DB_PASSWORD in
npm run migrate                       # eenmalig; idempotent, veilig om te herhalen
npm run dev                           # Vite (web) + API op 127.0.0.1:3001
```

Vite stuurt `/api` door naar de API.

```sh
npm test               # vitest: formulierlogica, conceptopslag en de inzend-API (met gemockte database)
npm run build          # typecontrole frontend + server, productiebuild naar dist/
npm start              # alleen de API
```

**Maak een back-up voordat je migreert:**

```sh
mysqldump voetbalpool > backup.sql
```

De migratie (`server/migrations/001_…sql`) doet het volgende:

- voegt `tblAppSettings` toe, waarin onder andere de actieve pool staat;
- voegt aan `tblCompetitorPools` de kolommen `payedTo` ("bij"), `entrySource` en `createdAt` toe.

## Pagina's

| Route | Doel |
| --- | --- |
| `#/` | Overzicht en spelregels van de actieve pool (punten en prijzen uit de database) |
| `#/formulier` | Online invullen. Het concept wordt per pool in deze browser bewaard (`vbpool:entry:pool:<id>`). Inzenden kan alleen binnen de inschrijfperiode en met een volledig formulier. |
| `#/print?pool=<id>&participant=<id>&auto=1` | Afdrukbaar A4-formulier. Zonder `participant` krijg je een blanco formulier; `auto=1` opent direct de printdialoog. |
| `#/beheer/<tab>` | Beheermodule |

Het formulier (`src/form/PoolForm.vue`) volgt de opmaak van `inschrijfform2021.pdf`. Hetzelfde component wordt gebruikt voor afdrukken, online invullen en invoer in beheer. Groepen, wedstrijden, finalerondes, aantallen en punten komen uit de database. Uitgeschakelde puntsoorten verdwijnen van het formulier.

**PDF maken:** open *Beheer → Formulier → PDF* of `#/print`, kies "Opslaan als PDF" en stel het volgende in:

- papier A4
- marges "Geen" en schaal 100% (de 95%-verkleining zit al in het formulier)
- achtergrondafbeeldingen aan

## Beheer

| Tab | Inhoud |
| --- | --- |
| Pool | Poolinstellingen (naam, inschrijfperiode, inleg, dag- en eindprijzen), actieve pool kiezen, toernooi aanmaken/wijzigen |
| Teams | Teams aanmaken/wijzigen en de groepsindeling |
| Spelers | Selecties per team, zoeken, toevoegen, wijzigen en verwijderen. Trainers en scheidsrechters staan niet in de topscorerlijst. |
| Schema | Wedstrijden met datum, tijd, ronde, codes en stadion |
| Punten | Puntsoorten aan/uit, punten en marges (voor aantallen) |
| Deelnemers | Overzicht met betaald-status, papieren formulieren invoeren (tabvolgorde volgt het papier), afdrukken en verwijderen |
| Formulier | Controle op ontbrekende gegevens, links naar de PDF en het online formulier, voorbeeld |
| Import | Toernooi exporteren of importeren als JSON, uit een bestand of een URL |

**Wedstrijdcodes:**

| Code | Betekenis |
| --- | --- |
| `A1` | Groep A, plaats 1 in de loting |
| `1A` / `2A` | Winnaar / nummer twee van groep A |
| `3DEF` | Een van de beste nummers drie uit groep D, E of F |
| `W45` / `V49` | Winnaar / verliezer van wedstrijd 45 / 49 |

**Importformaat:** maak een export van een bestaand toernooi om het formaat te zien. Zo kunnen gegevens later uit een website of API worden overgenomen:

```json
{ "format": "vbpool-tournament", "version": 1, "tournament": {}, "teams": [], "groups": [], "schedule": [], "players": [] }
```

Teams, stadions en spelers worden op naam gekoppeld. Importeren via een URL vraagt een bron die CORS toestaat.

Zolang de echte gegevens voor het volgende toernooi er nog niet zijn, dient EURO 2021 uit de database als voorbeeld.

## Beperkingen

- **Geen authenticatie op beheer.** De API luistert standaard alleen op `127.0.0.1`. Zet hem niet open op internet zonder eerst inloggen toe te voegen.
- Het 48-landenformat van het WK 2026 (zestiende finales) wordt nog niet ondersteund door de wedstrijdtypen.
- Uitslagen invoeren en de puntentelling/ranglijst blijven voorlopig in VBPool2.
- Het formulier staat op 95% gecentreerd op A4, net als het origineel werd afgedrukt; dat geeft rondom ruim 5 mm witte marge.
- `vbpool2-mariadb.sql` bevat persoonsgegevens en staat in `.gitignore`. Publiceer alleen `dist/` en de API, nooit de projectmap.
