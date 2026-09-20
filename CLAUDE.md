# CLAUDE.md – Survival Game: Agenten-Wissensdatei

- **Pflanzen und Aufg?nge (2026-09-09):** Bambus, Pilzgruppen und Beerenb?sche verwenden jetzt `ResourceArt` und gemeinsam genutzte `SpriteFactory`-Texturen. Beerenb?sche besitzen drei begrenzte Erntezust?nde (reif/wenig/leer); leere B?sche bleiben bestehen. Aufg?nge erhalten unregelm??ige, beidseitig auslaufende Erdpfade mit felsigen Schultern statt kurzer Trapeze. Palmen und Spielregeln bleiben unver?ndert. `npm run art:review` erzeugt zus?tzlich `artifacts/graphics/plants-sheet.svg`; Pflanzen und vier Rampenrichtungen wurden offline gerendert und gesichtet. 39 Tests, Build und gezielter Modul-Lint bestanden; Live-Sichtung/FPS-Messung offen.

> Diese Datei ist die zentrale Informationsquelle für alle KI-Agenten, die an diesem Projekt arbeiten.
> Nachtrag Baumgrafiken: Pandanus und der separate `drawJungleCanopyTree`-Renderer sind jetzt ebenfalls angepasst. Lianenernte entfernt weiterhin nur die Lianen. Große Bäume/Banyans sind wieder markante Schattenspender (3,5-/3,2-fache normale Baumskalierung); `SpriteFactory.layout` verwendet dafür 384×448 statt 160×192 und einen passenden Ursprung. Kamerareserve für diese Baumarten: 11 Tiles. Bestehende Kühlung unverändert: tagsüber 7–20 Uhr, Radius 4 Tiles, Zieltemperatur minus 12 Spielwerte. Größen-, Texturgrenzen- und Lianenerntetests sowie Offline-Prüfansichten vorhanden; kein Live-Browser-Test.
> Baumgrafiken (2026-09-09): `TreeArt.ts` zeichnet Holz-, Urwald-, Banyan-, Kautschuk-, Kakao-, Brotfrucht- und exotische Fruchtbäume mit geschichteten Kronen, Ästen und Wurzeln. Gemeinsame Texturen über `ResourceArt`/`SpriteFactory`; Fruchtzustände im Cache getrennt. Harzbäume verwenden dieselbe Baumzeichnung im bestehenden Graphics-Pfad mit mengenabhängigem Harzschnitt/-fluss. Palmen unverändert. Offline-Prüfblatt: `artifacts/graphics/trees-sheet.png` (`npm run art:review`). Live-Sichtung bleibt offen.
> **Immer aktuell halten:** Wenn du eine Änderung machst, die hier noch nicht dokumentiert ist, ergänze sie.

---

## Design und aktueller Regelabgleich

- **Herstellung am Arbeitsplatz:** Der Handwerk-Bereich wurde aus dem Inventar entfernt. Klick auf einen fertig gebauten Arbeitsplatz in direkter Nähe öffnet `CraftingModal` als eigenes Fenster; bei Entfernung erscheint ein Hinweis. F-Interaktion bleibt erhalten. Im Herstellungsfenster keine Bewegung/Sammelaktionen im Hintergrund, laufende Crafting-Zeit bleibt aktiv. Der Arbeitsplatz selbst bleibt über das Baumenü ohne Werkzeug herstellbar. Build und Modal-Lint geprüft; keine neue Live-Browserprüfung.

- **Bau-Bedienung vereinfacht:** Gebäude direkt anklicken → „Ausbauen“; Hover/Fokus zeigt nächste bekannte Stufe und Material-/Werkzeug-/Skillbedarf, ohne Auswahl einer Zielstufe. Die Objektauswahlliste entfällt. Baustellen speichern Teilanlieferungen in `ConstructionSite.delivered`; Nachlieferungen nehmen nur Fehlmengen, Abbruch erstattet nur tatsächlich geliefertes Material. Alte vollständig belieferte Saves bleiben über `supplied` kompatibel.

- **Bausystem umgesetzt (2026-09-20):** Aktueller Stand oben in [BAUSYSTEM_PLAN.md](BAUSYSTEM_PLAN.md). Persistierte Baustellen und Reservierungen, aktive Arbeit unmittelbar daneben, Materialübergabe und Rückbau, sichtbare Bauphasen; Unterkunft-Upgrades sowie Abbauen/Tragen/Aufstellen kleiner Einrichtungen. `ConstructionSystem.ts` enthält die Regeln, `ConstructionPanel.tsx` die Oberfläche. Alte Tagesbaustellen migrieren; Baufortschritt gehört zur Welt, der aktive Crafting-Slot referenziert nur die Baustellen-ID. Direkter Palmendach-Neubau jetzt 10 Blätter/45 Basis-Sekunden; Upgrade benötigt 6 zusätzliche Blätter/40 Sekunden. Live-Prüfung offen, automatisierte Abläufe und Offline-Grafik geprüft.

- **Bauprozess-Entwurf (2026-09-20):** Der ursprüngliche Entwurf in [BAUSYSTEM_PLAN.md](BAUSYSTEM_PLAN.md) bleibt als Hintergrund erhalten; der Umsetzungsstand am Dokumentanfang ersetzt seine älteren Ist-Aussagen. Prüfung des neuen Systems: 52 Tests und Build erfolgreich, neue Module sowie Baukomponenten im gezielten Lint ohne Befund. Live-Browser war nicht verfügbar.

- **Inselgenerator V2 (2026-09-09):** [INSEL_GENERATOR.md](INSEL_GENERATOR.md) beschreibt zentrale Regler (`islandConfig.ts`), Ressourcengruppen (`islandResources.ts`), drei Profile und Seed-/Reglereingaben im Hauptmenü. Landanteil/Küste, Strandbreite, Geländeformen/Hochland, Vegetation und Aufgänge sind einstellbar. Start-Feuerstein/Kiesel werden tatsächlich garantiert, Erz-Testblock ist standardmäßig aus. Neue Saves speichern Generatorversion + Einstellungen; alte Saves verwenden `LegacyWorldGenerator`, Wiederherstellung über `restoreWorld.ts`. Generator-Versionierung bei weiteren Algorithmusänderungen beachten. `npm run islands:compare` erzeugt Karten/Metriken; Live-Menüprüfung noch offen.
  Prüfung: 39 Tests, Build und gezielter Lint bestanden. Neun Profil-/Seed-Vergleiche mit vollständiger Gelände-Erreichbarkeit; zusätzliche Extremfall- und Save-Kompatibilitätstests. Neue Regler gelten nur für neue Inseln.

- **Höhenübergänge (2026-09-09, Screenshot 214043):** `CliffArt.ts` ersetzt die alten drei richtungsabhängigen Kachelwände und rechteckigen Eckflicken. Verbundene Kanten in allen vier Richtungen, abgerundete Außen-/Innenecken, breitere Erd-/Felsböschungen und Erdpfade an echten Rampen. Diagonale Plateaukontakte bleiben getrennt. Gelände-/Bewegungsregeln und Palmen unverändert. `npm run art:cliffs` erzeugt zwei Offline-Prüfansichten; 29 Tests, Build und Modul-Lint bestanden. Live-Prüfung im Nutzer-Spielstand bleibt offen.

- [GRAFIK_PLAN.md](GRAFIK_PLAN.md): Grafiküberarbeitung vom 2026-09-09 implementiert: ruhige Bodenpalette und Nachbarschaftsübergänge (`TerrainArt`), sieben Ressourcenarten mit gemeinsam genutzten Texturen (`ResourceArt`, jetzt aktive `SpriteFactory`), vier frühe Lagerbauten/Baustellenfortschritt (`CampArt`), kontinuierlicher Laufzyklus und Tätigkeitsbewegung. Fünf gemeinsame Welt-/UI-Symbole, flache Ufer ohne falsche Felswand, Rampendarstellung passend zur bestehenden Bewegung. `npm run art:review` erzeugt Offline-Referenzen und SVG-Symbole. 26 Tests und Build bestanden; Live-Sichtung/FPS-Messung noch offen. Umsetzungsgrenzen und bestehende Lint-Meldungen stehen im Plan. Keine geänderten Survival-Regeln.

- **Crafting-Hinweise (2026-09-08):** Fehlende Werkzeuge/Stationen und Skillstufen werden konkret benannt. Rezeptkarten zeigen Beschreibung, Zutatenbestand und nächste Schritte entlang bereits bekannter Rezepte. Beispiel: Kokosnuss verlangt eine Axt, das Messer reicht nicht; Hinweise führen über bekannte Axt-/Zwischenproduktrezepte weiter. Unbekannte Herstellungstechniken werden nicht offengelegt. 18 Tests und Build bestanden.

- **Crafting-Korrektur (2026-09-08):** Feuersteinspalten konnte bei vollem Inventar trotz kompatiblem Ergebnisstapel warten, weil alle möglichen Qualitätsvarianten Platz benötigen sollten. Der Auftrag merkt jetzt den einmal bestimmten Ausgang und prüft nur dessen Platzbedarf. Zutatenanzeige zeigt Ist/Soll; Buttons benennen blockierende laufende Aufträge. 17 Crafting-Tests und Build bestanden. Ob dies der konkrete gemeldete Spielerfall war, ist ohne Rückmeldung zur angezeigten Sperre noch offen.

- **Neu umgesetzt (2026-09-08):** Zentraler Crafting-/Bauauftrag, Skill-abhängige Zeiten, Werkzeugqualität und beständiger Verschleiß, begrenzte Fehlversuche mit Lern-XP, tatsächliche Bauzeit und Nutzung naher Baumaterial-Vorräte. Konstruktion und Konservierung haben jetzt aktive Einstiege. Details, Teststand und noch offene Systeme: Abschnitt 1a in `SURVIVAL_DESIGN.md`. Dieser neue Stand ersetzt die älteren Aussagen „nur dokumentiert“ und die entsprechenden Ausgangsbefunde unten.
- Einstiegspunkte: `src/store/craftingStore.ts`, `src/services/game/BuildingSystem.ts`, `src/services/game/inventory.ts`, `src/data/craftingBalance.ts`, gemeinsame Oberfläche `src/components/game/CraftingPanel.tsx`. Testbefehl: `node --test tests/crafting.test.cjs`.

- [SURVIVAL_DESIGN.md](SURVIVAL_DESIGN.md): Gemeinsames Design-Dokument für Lernen, Skills, Qualität, Survival-Progression und Langzeitziele. Trennt Nutzerwünsche, Codebefunde, Vorschläge und offene Entscheidungen; enthält eine Beitragsvorlage für weitere Agenten.
- [TECHBAUM_IST.md](TECHBAUM_IST.md): Datenkatalog mit 64 Ressourcen-Definitionen, 32 Rezepten, 18 Bauten und 17 Wissens-Flags (2026-09-08).
- **Korrektur zur älteren Zusammenfassung unten:** Grübel-Daten sind vorhanden, aber derzeit nicht an den Schlafablauf angeschlossen. Die definierte Crafting-Erfolgswahrscheinlichkeit wird nicht ausgewertet. Farm- und Angel-Logik existieren, ihre Timer brauchen Prüfung. Die normale Bauplatzstrecke setzt Bauten sofort statt `buildTime` abzuarbeiten. Konstruktion hat eine zirkuläre Wissensvoraussetzung; Konservierung keinen gefundenen aktiven Tagebuchauslöser. Details und Quellen siehe Befunde B01–B10 im Design-Dokument. Diese Befunde gehen den älteren Statusangaben unten vor.
- Neue Design-Vorschläge sind nicht automatisch beschlossene Spielregeln. Bei Weiterarbeit den aktuellen Code erneut mit dem dokumentierten Stand abgleichen.
- **Abgestimmte Skillrichtung S01:** In `SURVIVAL_DESIGN.md` sind die acht Skills mit Lerntätigkeiten und geplanten Auswirkungen dokumentiert. Erfahrung durch Praxis, bessere Qualität/Geschwindigkeit, Wissen getrennt von Können; zuerst Handwerk, Bauen und Überleben ausbauen. Noch keine Umsetzung, konkrete Balance offen (2026-09-08).

## Projektüberblick

**Genre:** Tropisches Survival-Sandbox-Spiel (Singleplayer)  
**Vision:** Realistisches, schweres Survival-Erlebnis. Der Spieler strandet auf einer tropischen Insel und muss überleben. Permanenter Ressourcendruck, keine Maschinen/Elektrizität, Technologiegrenze bei primitiven Eisenwerkzeugen.  
**Inspirationen:** Project Zomboid, The Long Dark, Stranded Deep  
**Aktueller Stand:** Spielbare Früh-Alpha mit vollständigen Kern-Systemen

---

## Tech-Stack

| Technologie | Version | Zweck |
|---|---|---|
| React | 19 | UI-Layer (HUD, Inventar, Menüs) |
| Phaser | 4 | Game-Engine (Rendering, Input, World) |
| TypeScript | 6 | Sprache |
| Zustand | 5 | Global State (Stores) |
| Tailwind CSS | 4 | UI-Styling |
| Vite | 8 | Build-Tool |
| Tauri | 2 | Desktop-App (Windows-Installer) |
| Howler | 2 | Audio |

**Starten:**
```bash
npm run dev          # Browser-Dev-Server
npm run tauri:dev    # Desktop-App (Tauri)
npm run build        # Produktions-Build
npm run tauri:build  # Windows-Installer
```

---

## Projektstruktur

```
src/
├── App.tsx                    # Root: Phaser-Canvas + React-UI-Layer
├── components/                # React-UI-Komponenten (HUD, Inventar, etc.)
├── data/                      # Alle Spieldaten (Rezepte, Ressourcen, etc.)
│   ├── json/resources.json    # Ressourcen-Definitionen
│   ├── buildDefinitions.ts    # Baubare Strukturen
│   ├── diseases.ts            # Krankheiten & Drain-Werte
│   ├── foodDecay.ts           # Verderb-Zeiten für Nahrung
│   ├── ideas.ts               # Grübel-System: Ideen & Trigger
│   ├── knowledge.ts           # Knowledge-Flags & Rain-Grants
│   ├── recipes.ts             # Crafting-Rezepte (Tier 0–4)
│   ├── resources.ts           # Ressourcen-Typen
│   ├── skills.ts              # Skill-XP beim Sammeln
│   ├── tiles.ts               # Tile-Typen
│   ├── toolDurability.ts      # Werkzeug-Schaden & Haltbarkeit
│   ├── weights.ts             # Gewichtssystem (MAX_CARRY_KG)
│   └── worldConfig.ts         # WORLD_CONFIG, tileSize, DAY_DURATION_MS
├── services/
│   ├── game/                  # Spiellogik-Services
│   │   ├── CraftingSystem.ts  # Crafting-Logik
│   │   ├── FootstepAudio.ts   # Schrittgeräusche
│   │   └── GameLoop.ts        # Update-Loop
│   └── phaser/                # Phaser-Integrationsschicht
│       ├── GameManager.ts     # Haupt-Controller (Rendering, Input, Welt)
│       ├── WorldGenerator.ts  # Prozedurale Weltgenerierung
│       ├── ParticleManager.ts # Partikeleffekte
│       └── SpriteFactory.ts   # Sprite-Erstellung
├── store/                     # Zustand-Stores
│   ├── gameStore.ts           # Spielzustand (Zeit, Wetter, Phase)
│   ├── playerStore.ts         # Spieler (HP, Hunger, Skills, Inventar)
│   ├── worldStore.ts          # Welt (Tiles, Ressourcen, Strukturen)
│   ├── journalStore.ts        # Tagebuch-Einträge
│   └── tutorialStore.ts       # Tutorial-Flags
└── types/
    ├── world.ts               # Tile, WorldResource, Structure, etc.
    └── skills.ts              # SkillId, GATHER_SKILL_XP
```

---

## Architektur-Prinzipien

### Phaser + React Trennung
- **Phaser** rendert alles im Canvas (Welt, Spieler, Effekte)
- **React** rendert nur die UI-Overlay-Schicht (HUD, Inventar, Menüs)
- Kommunikation läuft über **Zustand-Stores** — kein direktes Phaser↔React-Coupling

### Depth-System (Rendering-Reihenfolge)
```
tiles=0
obj_shadow = tileY * 1000 + 1
obj        = tileY * 1000 + 2
player     = tileY * 1000 + 3
fog        = 500_000
overlay    = 600_000
floatingText = 700_000
```

### Tile-System
- Tile-Größe: `32px` (`WORLD_CONFIG.tileSize`)
- Elevation-System: `0=Wasser, 1=Strand/Gras, 2=Wald/Plateau, 3=Hügel, 4=Gipfel`
- Rampen (`isRamp`) verbinden Elevations-Stufen

---

## Kern-Systeme

### 1. Knowledge-System
Wissen wird durch Erleben freigeschaltet — **nicht durch Menüs**.
- Flags: `knows_basic_fire`, `knows_sharp_edges`, `knows_binding`, `knows_fire`, `knows_basic_shelter`, `knows_rain_collection`, `knows_medicine`, `knows_construction`, `knows_metal`, etc.
- Trigger: Ressourcen aufheben, Bauen, Regen-Events
- Definitionen in: `src/data/knowledge.ts`

### 2. Crafting-System
- 4 Tiers: Bare Hands → Erste Werkzeuge → Konstruktion → Werkbank → Schmelzofen
- Voraussetzungen: Knowledge-Flags + Skill-Level + Werkzeuge
- Diminishing Returns: XP sinkt bei Wiederholung (1/√n, min 10%)
- Logic: `src/services/game/CraftingSystem.ts`
- Rezepte: `src/data/recipes.ts`

### 3. Skill-System
8 Skills, Level 1–10, XP-Kosten: `level × 20`
- Überleben, Handwerk, Bauen, Naturkunde, Jagen, Kochen, Medizin, Körperbeherrschung
- Craftingzeit –5% pro Level (max –45%)
- Erfolgswahrscheinlichkeit: Basis 35%, +6%/Level (Feuerstein absplittern)

### 4. Grübel-System
- Trigger: Schlafen ≥6h + Lagerfeuer in der Nähe
- Ablauf: Focus wählen → Materialien am nächsten Tag triggern Erkenntnisse → Knowledge-Flag frei
- Focuses: Wasser, Nahrung, Werkzeuge, Unterkunft, Feuer, Gesundheit (locked), Jagd (locked), Lagerung (locked)
- Definitionen: `src/data/ideas.ts`

### 5. Biome & Weltgenerierung
Prozedurale Generierung in `src/services/phaser/WorldGenerator.ts`
- **Strand:** Muscheln, Krebs, Treibholz, Feuerstein, Palmen
- **Grasland/Wiese:** Faser, Kräuter, Beeren, Kiesel
- **Wald:** Holz, Äste, Liane, Pilze, Wildschweine
- **Dschungel:** Exotische Früchte, Lianen, Baumharz
- **Felsen/Hügel:** Stein, Granit, Obsidian, Eisenerz

### 6. Überlebensbedürfnisse (im playerStore)
- HP, Hunger, Durst, Energie, Wärme
- Krankheiten: Fieber, Parasiten, Wunden, Blutungen
- Kälteexposition → Fieber-Chance (`FEVER_FROM_COLD_CHANCE`)
- Blutung beim Wildschwein-Angriff (`BLEED_ON_BOAR_ATTACK`)
- Werte in: `src/data/diseases.ts`

### 7. Ressourcen
- Alle sammelbaren Ressourcen in `src/data/json/resources.json`
- Nachwachsen: Timers im `worldStore`
- Gewichtssystem: `src/data/weights.ts` (MAX_CARRY_KG)
- Werkzeug-Haltbarkeit: `src/data/toolDurability.ts`

### 8. Zeit & Wetter
- Tageszyklen: `DAY_DURATION_MS` aus `worldConfig.ts`
- Sichtweite: Tag=12 Tiles, Nacht=2 Tiles, Lagerfeuer=+5 Tiles
- Regentypen: `drizzle | shower | rain | downpour | storm | long_rain`
- Regen schaltet Knowledge-Flags frei (wenn Materialien bekannt)

### 9. Strukturen & Placement
- 2-Tile Mindestabstand um Lagerfeuer & Arbeitsplatz
- Strukturen mit Lagerung (`storage?: []`), Fuel (Lagerfeuer), Bauprogress
- Definitionen: `src/data/buildDefinitions.ts`

---

## Spielerprogression (roter Faden)

```
TAG 1 – Strand: Kiesel/Feuerstein/Faser aufheben → Lagerfeuer → Schlafplatz
NACHT 1 – Grübeln → bei Regen: knows_basic_shelter
TAG 2 – Feuerstein absplittern → Ast härten → Messer → Palmendach
TAG 3 – Axt/Speer → Kochen → Regensammler
WOCHE 1 – Holzunterkunft → Lagerbox → Werkbank → Konservierung
LANGFRISTIG – Blockhütte → Schmelzofen → Eisenwerkzeuge → Medizin/Jagd/Farming
```

---

## Offene Baustellen (Stand: 2026-09)

| Bereich | Status |
|---|---|
| Terrain-Elevation & Rampen | 🔄 In Arbeit (terrain_direction_draft.md) |
| Medizin-Skill aktiv (Boni) | ⏳ Nur als Wissens-Gate, keine Skill-Boni |
| Körperbeherrschung-Mechaniken | ⏳ Kein XP-Pfad, kein Spieleinfluss |
| Tiere stehlen vom Ablageplatz | ⏳ Beschreibung vorhanden, Mechanik fehlt |
| Sturm verstreut Gegenstände | ⏳ Beschreibung vorhanden, Mechanik fehlt |
| Angelrute-Mechanik | ⏳ Rezept vorhanden, Spiellogik unklar |
| Ackerbeet-Mechanik | ⏳ Baubar, kein Farming-Loop |
| Spielziel / Endgame | ❌ Fehlt komplett |
| Knochen / Tierhaut / Tierfett | ❌ Ressourcen ohne Rezepte |
| SpriteFactory & ParticleManager | 🆕 Neue Dateien (noch nicht voll integriert) |

---

## Design-Regeln (für Agenten)

1. **Keine Maschinen/Elektrizität** — Technologiegrenze ist primitives Eisen
2. **Kein freies Wissen** — Alles muss erlebt/entdeckt werden (Knowledge-Flags)
3. **Permanenter Druck** — Kein "sicherer" Zustand; immer neue Ressourcenprobleme
4. **Typen zuerst** — Neue Konzepte erst in `src/types/` definieren, dann implementieren
5. **Stores sind Single Source of Truth** — Spielzustand nur über Zustand-Stores
6. **Keine Kommentare ohne Grund** — Nur wenn das WARUM nicht aus dem Code klar wird

---

## Wichtige Dateien für häufige Aufgaben

| Aufgabe | Dateien |
|---|---|
| Neues Rezept hinzufügen | `src/data/recipes.ts` |
| Neue Ressource | `src/data/json/resources.json`, `src/data/resources.ts` |
| Neue Baustruktur | `src/data/buildDefinitions.ts` |
| Neue Knowledge-Flag | `src/data/knowledge.ts` |
| Neue Idee/Grübeln | `src/data/ideas.ts` |
| Neuer Skill-Effekt | `src/types/skills.ts`, `src/services/game/CraftingSystem.ts` |
| Rendering/Visuals | `src/services/phaser/GameManager.ts` |
| Weltgenerierung | `src/services/phaser/WorldGenerator.ts` |
| Spieler-Stats | `src/store/playerStore.ts` |
| Welt-Objekte | `src/store/worldStore.ts` |

---

## Changelog (wichtige Versionen)

### Performance-Korrekturen (2026-09-08)
- Ressourcen-Grafiken und Dschungel-Baumkronen außerhalb des Kamerabereichs werden vor dem Rendern unsichtbar geschaltet (8 Tiles Rand für Überhänge). Sichtbarkeit wird beim Kamerabewegen wiederhergestellt; Simulation und Weltzustand bleiben aktiv. Gezielter Sichtbarkeitstest und Vite-Build bestanden; FPS-Gewinn im Browser noch nicht gemessen.
- Hover setzt den Store nur bei geänderter Ressourcenreferenz; identische Frames lösen keine synchronen Persist-Schreibzugriffe mehr aus.
- Aufwach-Blur wird auf sichtbare 0,1-px-Schritte gerundet und nur bei Änderung gesetzt.
- Die Änderung der Tabwechsel-Laufzeitsteuerung wurde nach negativer Rückmeldung zurückgenommen.
- Phaser läuft mit `fps.smoothStep: false`: Der standardmäßige 120-Frame-Cooldown nach Start/Fokuswechsel begrenzte bei niedriger FPS die Simulationszeit auf 16,7 ms pro Frame. Die bestehende 100-ms-Begrenzung in `onUpdate` bleibt bestehen. Reproduziert mit Phasers installierter TimeStep-Klasse: Bei 30 FPS entsprechen vier reale Sekunden vorher zwei, danach vier Simulationssekunden. Eine Verbesserung der tatsächlichen Bildrate ist damit noch nicht bestätigt.
- GameManager räumt sein Pause-Abonnement beim Beenden auf und synchronisiert Weltobjekte nur bei Änderungen der jeweiligen Arrays.
- Prüfung: gezielter Store-Test und Vite-Build. Browser-Laufzeitmessung steht aus; vollständiger TypeScript-Build meldet bestehende Fehler bei Vector2-Typen und ungenutzten WorldGenerator-Parametern.

| Version | Beschreibung |
|---|---|
| v2.0 | Spieler-Redesign, neue Sprites & Bugfixes |
| v1.9 | Musik in Tauri/WebView2 – html5-Modus + autoUnlock |
| v1.8 | Tauri Desktop-App: Windows-Installer (NSIS + MSI) |
| v1.7 | Fix: Regen-Initialisierung beim Spielladen |
| v1.6 | Placement: 2-Tile Abstandspflicht um Lagerfeuer & Arbeitsplatz |
| v1.5 | Skill-System, Knowledge-System, Grübel-System vollständig |

---

*Letzte Aktualisierung: 2026-09-08 – Initialdokumentation für Agenten-Kollaboration*
