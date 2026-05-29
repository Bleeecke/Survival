# RimWorld-artiges Baumenü für das Survival-Spiel

Version: 1.0  
Zweck: Umstellung vom klassischen Crafting-Menü auf ein baubasiertes Platzierungs- und Auftragsmenü für stationäre Objekte.

---

# 1. Ziel des Systems

Das bisherige Crafting-Menü soll nicht komplett ersetzt, sondern sauber aufgeteilt werden.

Es gibt künftig zwei getrennte Systeme:

```text
Crafting-Menü = tragbare Gegenstände
Baumenü = stationäre Weltobjekte
```

Das Crafting-Menü bleibt für Dinge, die der Spieler im Inventar trägt oder direkt benutzt.

Das Baumenü wird für Dinge verwendet, die in der Welt platziert und gebaut werden.

Dadurch fühlt sich das Spiel weniger wie ein reines Rezept-Menü an und mehr wie ein echtes Survival-Lager, das Schritt für Schritt aufgebaut wird.

---

# 2. Grundprinzip

Ein klassisches Crafting-Menü funktioniert so:

```text
Rezept auswählen → Material prüfen → Item erscheint im Inventar
```

Das neue Baumenü funktioniert so:

```text
Objekt auswählen → Platz in der Welt wählen → Bauplan entsteht → Materialien liefern → Baufortschritt → fertiges Weltobjekt
```

Der Spieler baut also nicht einfach „1x Lagerbox“, sondern plant einen Ort, bringt Materialien dorthin und errichtet das Objekt.

---

# 3. UI-Grundstruktur

Das Baumenü liegt idealerweise am unteren Bildschirmrand oder als seitliche Leiste.

Empfohlene Hauptnavigation:

```text
Inventar | Crafting | Bauen | Status | Skills
```

Beim Klick auf „Bauen“ öffnet sich eine Kategorienleiste.

Empfohlene Kategorien:

```text
Überleben | Feuer | Schutz | Lager | Wasser | Nahrung | Werkstätten | Jagd | Medizin | Wege
```

---

# 4. Kategorien des Baumenüs

## 4.1 Überleben

Basisobjekte für die ersten Minuten und Stunden.

Beispiele:

- Lagerfeuer
- Regensammler
- Palmendach
- Schlafplatz
- Ablageplatz

Diese Kategorie sollte von Anfang an sichtbar sein.

---

## 4.2 Feuer

Alles rund um Wärme, Licht, Kochen und Haltbarmachung.

Beispiele:

- Lagerfeuer
- Feuerstelle
- windgeschütztes Feuer
- Fackelhalter
- Räucherstelle
- Kohlemeiler
- Schmelzofen

Freischaltung über:

- Feuermachen
- Kochen
- Holzbearbeitung
- entdecktes Harz
- entdeckte Holzkohle
- Knowledge Flags wie `understands_smoking` oder `understands_hot_fire`

---

## 4.3 Schutz

Unterkünfte, Wetterschutz und Schlafplätze.

Beispiele:

- Palmendach
- Windschutz
- einfacher Schlafplatz
- primitive Hütte
- Holzunterkunft
- Blockhütte
- Bett

Freischaltung über:

- Unterkunftsbau
- Holzbearbeitung
- Kordel & Seile
- Bretter verstanden
- Knowledge Flags wie `understands_basic_shelter`, `understands_structural_support`, `understands_planks`

---

## 4.4 Lager

Lagerung ist ein zentrales Survival-System und soll früh relevant werden.

Beispiele:

- Ablageplatz
- Lagerbox
- Holzstapel
- Steinhaufen
- Nahrungslager
- Werkzeughalter
- trockener Lagerplatz

Nutzen:

- mehr Ordnung
- weniger Verderb
- bessere Materialverfügbarkeit
- Schutz vor Regen
- schnellere Bauprozesse in der Nähe

---

## 4.5 Wasser

Alles rund um Wassergewinnung, Wasserlagerung und Wasseraufbereitung.

Beispiele:

- Regensammler
- Kokosschalen-Ständer
- Wasserstelle markieren
- Kochstelle für Wasser
- einfacher Wasserfilter
- großer Regensammler
- Wasservorratsbehälter

Freischaltung über:

- Kokosschale entdeckt
- Palmblatt entdeckt
- Holzkohle entdeckt
- Knowledge Flags wie `understands_water_collection`, `understands_water_purification`

---

## 4.6 Nahrung

Alles rund um Kochen, Lagern und Haltbarmachen.

Beispiele:

- Kochplatz
- Trockengestell
- Räucherstelle
- Fischablage
- Fleischhaken
- Pilzkorb

Freischaltung über:

- Kochen
- Jagen
- Feuermachen
- erstes Fleisch gefunden
- erster Fisch gefangen
- Knowledge Flags wie `understands_food_safety`, `understands_drying`, `understands_smoking`

---

## 4.7 Werkstätten

Arbeitsplätze für komplexere Verarbeitung.

Beispiele:

- Werkbank
- Steinbearbeitungsplatz
- Holzbearbeitungsplatz
- Gerbplatz
- Schmelzofen

Wichtig:

Die Werkbank soll nicht magisch alle Rezepte freischalten. Sie soll bessere Bearbeitung ermöglichen.

Beispiele für Werkbankeffekte:

- präzisere Herstellung
- geringere Fehlschlagchance
- bessere Werkzeugqualität
- Zugriff auf komplexe Bauobjekte

---

## 4.8 Jagd

Stationäre Jagd- und Tierobjekte.

Beispiele:

- einfache Falle
- Krabbenfalle
- Fischfalle
- Speerständer
- Köderplatz

Freischaltung über:

- Jagen
- Seile & Bindungen
- Tierbeobachtung
- Knowledge Flags wie `understands_trapping`, `understands_animal_tracks`

---

## 4.9 Medizin

Medizinische Lagerung und Verarbeitung.

Beispiele:

- Kräuterablage
- Medizinplatz
- Trockengestell für Kräuter
- Wundversorgungsplatz
- Salbenplatz

Freischaltung über:

- Kräuter entdeckt
- Heilpflanze entdeckt
- Medizin-Skill
- Knowledge Flags wie `understands_wound_care`, `understands_herbal_medicine`, `understands_infection`

---

## 4.10 Wege und Gelände

Gelände bearbeiten und Wege schaffen.

Beispiele:

- Gras freiräumen
- hohes Gras schneiden
- Dschungelpfad
- Steinweg
- Holzsteg

Nutzen:

- bessere Bewegung
- weniger Verletzungen
- weniger Schlangenrisiko
- bessere Sicht
- geordneter Lagerbereich

---

# 5. Sichtbarkeit und Sperrlogik

Jedes Bauobjekt besitzt einen von drei UI-Zuständen:

```text
1. Unsichtbar
2. Sichtbar, aber gesperrt
3. Sichtbar und baubar
```

## 5.1 Unsichtbar

Ein Objekt ist unsichtbar, wenn der Spieler das Prinzip noch nicht kennen kann.

Beispiel:

Der Spieler hat noch nie Harz gefunden und noch nie Fleisch geräuchert.

Dann ist die Räucherstelle unsichtbar.

---

## 5.2 Sichtbar, aber gesperrt

Ein Objekt ist sichtbar, wenn der Spieler grundsätzlich eine Idee davon haben könnte, aber noch nicht alle Voraussetzungen erfüllt.

Beispiel:

```text
Räucherstelle

Du verstehst das Prinzip noch nicht vollständig.

Bekannte Anforderungen:
- Feuer in der Nähe
- Holz
- Seil
- Palmblatt

Fehlt:
- Kochen Lv2
- Knowledge: Nahrung haltbar machen
```

---

## 5.3 Sichtbar und baubar

Ein Objekt ist baubar, wenn alle Voraussetzungen erfüllt sind:

- Materialien bekannt
- Skill ausreichend
- Knowledge vorhanden
- Werkzeug vorhanden oder beschaffbar
- Platzierungsregeln erfüllbar

---

# 6. Platzierungsmodus

Beim Klick auf ein Bauobjekt startet der PlacementMode.

Der Spieler sieht einen Ghost-Preview des Objekts unter dem Cursor.

## Farben

```text
Grün = platzierbar
Gelb = platzierbar, aber mit Nachteil
Rot = nicht platzierbar
```

---

## 6.1 Grün

Guter Standort.

Beispiel:

- trockener Boden
- keine Kollision
- gute Nähe zum Lager
- keine direkte Gefahr

---

## 6.2 Gelb

Platzierung ist möglich, aber nicht ideal.

Beispiele:

- Boden ist feucht
- Standort ist windanfällig
- Schlafplatz ist zu weit vom Feuer entfernt
- Lagerplatz ist ungeschützt
- hohes Gras in der Nähe erhöht Schlangenrisiko

---

## 6.3 Rot

Platzierung nicht möglich.

Beispiele:

- Wasser im Weg
- Baum im Weg
- Felsen im Weg
- zu steiler Untergrund
- Objekt überschneidet anderes Objekt
- Bauobjekt benötigt Feuer in der Nähe, aber kein Feuer vorhanden

---

# 7. Bauplatz-Bewertung

Das Spiel bewertet den Standort eines Bauobjekts. Diese Bewertung beeinflusst später Funktion, Haltbarkeit und Risiken.

---

## 7.1 Lagerfeuer

Guter Standort:

- trockener Boden
- windgeschützt
- nicht direkt unter Palmendach
- nahe beim Lager

Schlechter Standort:

- nasser Boden
- starker Wind
- zu nah an brennbarem Material
- offener Strand bei Sturm

Mögliche Effekte:

- Brenndauer steigt oder sinkt
- Regenrisiko steigt oder sinkt
- Rauchentwicklung verändert sich
- Brandrisiko möglich

---

## 7.2 Schlafplatz

Guter Standort:

- unter Dach
- nahe Feuer
- trocken
- nicht im hohen Gras
- nicht auf Tierpfad

Schlechter Standort:

- nass
- offen
- kalt
- hohes Gras
- in der Nähe gefährlicher Tiere

Mögliche Effekte:

- Schlafqualität
- Erholungsrate
- Krankheitsrisiko
- Gefahr durch Tiere

---

## 7.3 Lagerbox

Guter Standort:

- unter Dach
- trocken
- nahe Werkbank
- nahe Feuer, aber nicht zu nah

Schlechter Standort:

- im Regen
- auf feuchtem Boden
- weit vom Lager entfernt

Mögliche Effekte:

- Verderb von Nahrung
- Feuchtigkeit von Holz
- Haltbarkeit gelagerter Gegenstände

---

## 7.4 Regensammler

Guter Standort:

- freier Himmel
- nicht unter Dach
- nicht unter dichtem Blätterdach

Schlechter Standort:

- unter Unterkunft
- unter dichter Vegetation
- direkt neben Schmutzquelle

Mögliche Effekte:

- Sammelgeschwindigkeit
- Wasserqualität

---

# 8. Bauaufträge statt Instant-Crafting

Beim Platzieren entsteht nicht sofort ein fertiges Objekt.

Es entsteht ein BuildJob.

Ablauf:

```text
1. Objekt im Baumenü auswählen
2. Platz in der Welt wählen
3. Bauplan erscheint
4. Materialien werden reserviert oder angeliefert
5. Spieler baut daran
6. Baufortschritt steigt
7. Objekt wird fertig
```

---

# 9. BuildJob-Zustände

Jedes geplante Bauobjekt besitzt einen Zustand.

```text
planned
missing_materials
ready_to_build
missing_tool
missing_skill
building
paused
finished
damaged
destroyed
```

## Bedeutung

| Zustand | Bedeutung |
|---|---|
| planned | Bauplan wurde platziert |
| missing_materials | Materialien fehlen |
| ready_to_build | alles vorhanden, Bau kann starten |
| missing_tool | Werkzeug fehlt |
| missing_skill | Spieler versteht Bau noch nicht |
| building | Spieler baut aktiv |
| paused | Bau ist pausiert |
| finished | Objekt ist fertig |
| damaged | Objekt ist beschädigt |
| destroyed | Objekt wurde zerstört |

---

# 10. Materiallogik

Materialien werden nicht sofort beim Auswählen verbraucht.

Empfohlene Logik:

```text
Baumenü-Auswahl: keine Kosten
Platzieren: Bauplan entsteht
Material liefern/reservieren: Material wird dem BuildJob zugewiesen
Bauabschluss: Material bleibt verbraucht, Objekt entsteht
Abbruch: nicht verbaute Materialien werden zurückgegeben
```

Optional:

Bei teilweise begonnenem Bau wird nur ein Teil der Materialien zurückgegeben.

---

# 11. BuildDefinition-Datenstruktur

Jedes baubare Objekt wird datenbasiert definiert.

Beispiel:

```json
{
  "id": "palm_roof",
  "name": "Palmendach",
  "category": "shelter",
  "description": "Ein einfaches Dach aus Ästen, Palmblättern und Lianen. Schützt vor leichtem Regen und verbessert den Schlaf.",
  "requiredMaterials": [
    { "item": "stick", "amount": 8 },
    { "item": "palm_leaf", "amount": 6 },
    { "item": "liana", "amount": 3 }
  ],
  "requiredTools": [],
  "requiredSkills": [
    { "skill": "shelter_building", "level": 1 }
  ],
  "requiredKnowledge": [
    "understands_basic_shelter"
  ],
  "buildTime": 40,
  "placementRules": {
    "allowedTerrain": ["grass", "sand", "forest_floor"],
    "blockedTerrain": ["water", "deep_water", "rock_wall"],
    "requiresOpenSky": false,
    "requiresNearbyFire": false,
    "maxSlope": 0.35
  },
  "effects": {
    "rainProtection": 0.45,
    "sleepQuality": 0.15,
    "storageDrynessBonus": 0.1
  },
  "visibilityRules": {
    "discoveredMaterials": ["palm_leaf", "liana"],
    "minimumSkillHints": [
      { "skill": "shelter_building", "level": 1 }
    ]
  }
}
```

---

# 12. BuildJob-Datenstruktur

Wenn der Spieler ein Objekt platziert, wird aus der BuildDefinition ein konkreter BuildJob.

Beispiel:

```json
{
  "id": "buildjob_001",
  "buildDefinitionId": "palm_roof",
  "position": { "x": 42, "y": 18 },
  "rotation": 0,
  "state": "missing_materials",
  "suppliedMaterials": [
    { "item": "stick", "amount": 4 }
  ],
  "missingMaterials": [
    { "item": "stick", "amount": 4 },
    { "item": "palm_leaf", "amount": 6 },
    { "item": "liana", "amount": 3 }
  ],
  "progress": 0,
  "quality": null,
  "createdAt": 123456,
  "lastWorkedAt": null
}
```

---

# 13. WorldObject-Datenstruktur

Nach Fertigstellung entsteht ein WorldObject.

Beispiel:

```json
{
  "id": "worldobject_001",
  "definitionId": "palm_roof",
  "position": { "x": 42, "y": 18 },
  "rotation": 0,
  "durability": 100,
  "quality": "simple",
  "effects": {
    "rainProtection": 0.45,
    "sleepQuality": 0.15,
    "storageDrynessBonus": 0.1
  },
  "condition": "intact"
}
```

---

# 14. UI-Informationskarte

Wenn der Spieler über ein Bauobjekt fährt, erscheint eine Infokarte.

Beispiel sichtbar und baubar:

```text
Palmendach

Schützt vor leichtem Regen.
Verbessert Schlafqualität.
Reduziert Risiko für nasse Kleidung.

Benötigt:
8x Äste
6x Palmblatt
3x Liane

Werkzeug:
keins

Skill:
Unterkunftsbau Lv1

Bauzeit:
40 Sekunden

Platzierung:
nur auf festem Boden
nicht im Wasser
```

Beispiel sichtbar, aber gesperrt:

```text
Räucherstelle

Du verstehst das Prinzip noch nicht vollständig.

Bekannte Anforderungen:
- Feuer in der Nähe
- Holz
- Seil
- Palmblatt

Fehlt:
- Kochen Lv2
- Knowledge: Nahrung haltbar machen
```

---

# 15. Integration mit Knowledge-System

Das Baumenü darf nicht wie ein klassischer Technologiebaum wirken.

Nicht anzeigen:

```text
Tech fehlt
```

Besser anzeigen:

```text
Du hast noch nicht verstanden, wie Rauch Nahrung haltbar macht.
```

Oder:

```text
Du brauchst mehr Erfahrung mit Feuer und Fleischverarbeitung.
```

Oder:

```text
Du hast noch kein geeignetes Material für stabile Verbindungen entdeckt.
```

---

# 16. Crafting-Menü vs. Baumenü

## Crafting-Menü

Für tragbare Items:

- Messer
- Axt
- Speer
- Seil
- Fackel
- Heilmittel
- Essen
- Angelrute
- Verbände
- Werkzeuge

## Baumenü

Für stationäre Weltobjekte:

- Lagerfeuer
- Palmendach
- Werkbank
- Lagerbox
- Bett
- Regensammler
- Trockengestell
- Räucherstelle
- Schmelzofen
- Fallen
- Wege
- Medizinplatz

Diese Trennung ist wichtig, damit das Spielsystem sauber bleibt.

---

# 17. Konkrete BuildDefinitions für erste Version

## 17.1 Überleben

### Lagerfeuer

```json
{
  "id": "campfire",
  "name": "Lagerfeuer",
  "category": "survival",
  "requiredMaterials": [
    { "item": "stick", "amount": 5 },
    { "item": "pebble", "amount": 3 }
  ],
  "requiredTools": [],
  "requiredSkills": [],
  "requiredKnowledge": [],
  "buildTime": 15,
  "effects": {
    "heat": 1.0,
    "light": 1.0,
    "cooking": true
  }
}
```

### Regensammler

```json
{
  "id": "rain_collector",
  "name": "Regensammler",
  "category": "water",
  "requiredMaterials": [
    { "item": "coconut_bowl", "amount": 1 },
    { "item": "palm_leaf", "amount": 1 }
  ],
  "requiredTools": [],
  "requiredSkills": [],
  "requiredKnowledge": ["understands_water_collection"],
  "buildTime": 20,
  "effects": {
    "collectsRainwater": true,
    "waterStorage": 2
  }
}
```

### Palmendach

```json
{
  "id": "palm_roof",
  "name": "Palmendach",
  "category": "shelter",
  "requiredMaterials": [
    { "item": "stick", "amount": 8 },
    { "item": "palm_leaf", "amount": 6 },
    { "item": "liana", "amount": 3 }
  ],
  "requiredTools": [],
  "requiredSkills": [
    { "skill": "shelter_building", "level": 1 }
  ],
  "requiredKnowledge": ["understands_basic_shelter"],
  "buildTime": 40,
  "effects": {
    "rainProtection": 0.45,
    "sleepQuality": 0.15
  }
}
```

---

## 17.2 Lager

### Ablageplatz

```json
{
  "id": "storage_spot",
  "name": "Ablageplatz",
  "category": "storage",
  "requiredMaterials": [],
  "requiredTools": [],
  "requiredSkills": [],
  "requiredKnowledge": [],
  "buildTime": 2,
  "effects": {
    "storageSlots": 6,
    "rainProtection": 0
  }
}
```

### Lagerbox

```json
{
  "id": "storage_box",
  "name": "Lagerbox",
  "category": "storage",
  "requiredMaterials": [
    { "item": "wood", "amount": 8 },
    { "item": "rope", "amount": 2 }
  ],
  "requiredTools": ["any_axe"],
  "requiredSkills": [
    { "skill": "woodworking", "level": 2 }
  ],
  "requiredKnowledge": ["understands_storage"],
  "buildTime": 60,
  "effects": {
    "storageSlots": 20,
    "rainProtection": 0.2
  }
}
```

---

## 17.3 Werkstätten

### Werkbank

```json
{
  "id": "workbench",
  "name": "Werkbank",
  "category": "workstations",
  "requiredMaterials": [
    { "item": "wood", "amount": 15 },
    { "item": "stone", "amount": 10 }
  ],
  "requiredTools": ["any_axe"],
  "requiredSkills": [
    { "skill": "woodworking", "level": 2 }
  ],
  "requiredKnowledge": ["understands_basic_workstation"],
  "buildTime": 90,
  "effects": {
    "craftingQualityBonus": 0.1,
    "enablesAdvancedWoodworking": true
  }
}
```

### Trockengestell

```json
{
  "id": "drying_rack",
  "name": "Trockengestell",
  "category": "food",
  "requiredMaterials": [
    { "item": "stick", "amount": 6 },
    { "item": "rope", "amount": 2 }
  ],
  "requiredTools": [],
  "requiredSkills": [
    { "skill": "cooking", "level": 2 }
  ],
  "requiredKnowledge": ["understands_drying"],
  "buildTime": 50,
  "effects": {
    "enablesFoodDrying": true
  }
}
```

### Räucherstelle

```json
{
  "id": "smoking_rack",
  "name": "Räucherstelle",
  "category": "food",
  "requiredMaterials": [
    { "item": "wood", "amount": 8 },
    { "item": "rope", "amount": 4 },
    { "item": "palm_leaf", "amount": 2 }
  ],
  "requiredTools": [],
  "requiredSkills": [
    { "skill": "firemaking", "level": 3 },
    { "skill": "cooking", "level": 2 }
  ],
  "requiredKnowledge": ["understands_smoking"],
  "buildTime": 80,
  "effects": {
    "enablesSmoking": true,
    "foodPreservationBonus": 0.5
  }
}
```

---

## 17.4 Schutz

### Schlafplatz

```json
{
  "id": "sleeping_spot",
  "name": "Schlafplatz",
  "category": "shelter",
  "requiredMaterials": [
    { "item": "palm_leaf", "amount": 4 }
  ],
  "requiredTools": [],
  "requiredSkills": [],
  "requiredKnowledge": [],
  "buildTime": 10,
  "effects": {
    "sleepQuality": 0.05
  }
}
```

### Bett

```json
{
  "id": "bed",
  "name": "Bett",
  "category": "shelter",
  "requiredMaterials": [
    { "item": "plank", "amount": 8 },
    { "item": "palm_leaf", "amount": 10 }
  ],
  "requiredTools": ["workbench_near"],
  "requiredSkills": [
    { "skill": "woodworking", "level": 3 },
    { "skill": "shelter_building", "level": 3 }
  ],
  "requiredKnowledge": ["understands_planks"],
  "buildTime": 90,
  "effects": {
    "sleepQuality": 0.35,
    "recoveryBonus": 0.2
  }
}
```

---

## 17.5 Spätes Spiel

### Schmelzofen

```json
{
  "id": "smelting_furnace",
  "name": "Schmelzofen",
  "category": "workstations",
  "requiredMaterials": [
    { "item": "wood", "amount": 20 },
    { "item": "stone", "amount": 15 },
    { "item": "plank", "amount": 10 }
  ],
  "requiredTools": ["workbench_near"],
  "requiredSkills": [
    { "skill": "firemaking", "level": 4 },
    { "skill": "woodworking", "level": 4 }
  ],
  "requiredKnowledge": ["understands_hot_fire", "understands_ore"],
  "buildTime": 180,
  "effects": {
    "enablesSmelting": true
  }
}
```

---

# 18. Technische Umsetzung für Claude Code / Codex

## Aufgabe

Baue das bisherige Crafting-Menü zu einem RimWorld-artigen Baumenü um.

Das Ziel ist ein System, in dem stationäre Objekte nicht mehr direkt gecraftet werden, sondern als Bauplan in der Welt platziert und anschließend gebaut werden.

---

## Anforderungen

### 1. BuildMenu-Komponente

Erstelle eine BuildMenu-Komponente mit Kategorien:

- Überleben
- Feuer
- Schutz
- Lager
- Wasser
- Nahrung
- Werkstätten
- Jagd
- Medizin
- Wege

Die Kategorie öffnet eine Liste von BuildDefinitions.

---

### 2. BuildDefinitions

Jede BuildDefinition enthält:

- id
- name
- category
- description
- requiredMaterials
- requiredTools
- requiredSkills
- requiredKnowledge
- buildTime
- placementRules
- effects
- visibilityRules

Die BuildDefinitions müssen datenbasiert sein.

Nicht direkt in UI-Komponenten hardcoden.

Empfohlen:

```text
/data/build_definitions.json
```

oder bei TypeScript:

```text
/src/data/buildDefinitions.ts
```

---

### 3. PlacementMode

Beim Klick auf ein Bauobjekt startet der PlacementMode.

Funktionen:

- Ghost-Preview folgt dem Cursor
- Vorschau zeigt grün, gelb oder rot
- Rotation optional möglich
- Klick auf gültige Position erzeugt BuildJob
- Escape/Rechtsklick bricht Platzierung ab

---

### 4. Platzierungsprüfung

Erstelle eine Funktion:

```ts
canPlaceBuildObject(definition, position, worldState): PlacementResult
```

Rückgabe:

```ts
{
  canPlace: boolean,
  quality: "good" | "bad" | "invalid",
  reasons: string[],
  warnings: string[]
}
```

Beispiele:

- Wasser im Weg
- zu steiler Boden
- anderes Objekt blockiert
- kein freier Himmel
- Feuer benötigt, aber nicht in Nähe
- Boden nass
- hoher Grasbewuchs in der Nähe

---

### 5. BuildJob-System

Beim Platzieren wird ein BuildJob erzeugt.

BuildJob enthält:

- buildDefinitionId
- position
- rotation
- suppliedMaterials
- missingMaterials
- progress
- state
- quality

States:

- planned
- missing_materials
- ready_to_build
- missing_tool
- missing_skill
- building
- paused
- finished
- damaged
- destroyed

---

### 6. Materialzuweisung

Materialien werden nicht sofort beim Platzieren verbraucht.

Stattdessen:

- Bauplan wird platziert
- Spieler kann Materialien zuweisen
- fehlende Materialien werden angezeigt
- wenn alles vorhanden ist, wird Status `ready_to_build`

Optional für Version 1:

Wenn Materialien im Inventar vorhanden sind, können sie beim Platzieren automatisch reserviert werden.

---

### 7. Baufortschritt

Baufortschritt steigt nur, wenn:

- alle Materialien vorhanden sind
- benötigtes Werkzeug vorhanden ist
- Skillanforderung erfüllt ist
- Spieler aktiv am Bauobjekt arbeitet

Nach Abschluss:

```text
BuildJob → WorldObject
```

---

### 8. Integration mit Skill und Knowledge

Ein Objekt ist sichtbar oder baubar abhängig von:

- entdeckten Materialien
- Skillwerten
- Werkzeugen
- Knowledge Flags

Keine klassische Forschungslogik.

Stattdessen:

```text
Der Spieler versteht durch Erfahrung neue Bauprinzipien.
```

---

### 9. Altes Crafting-System behalten

Das bisherige Crafting-System wird nicht entfernt.

Es bleibt zuständig für tragbare Items:

- Messer
- Axt
- Speer
- Fackel
- Seil
- Medizin
- Nahrung
- Werkzeuge

Das neue Baumenü ist nur für stationäre Objekte.

---

### 10. UI-Anforderungen

Für jedes Bauobjekt anzeigen:

- Name
- Beschreibung
- benötigte Materialien
- fehlende Materialien
- benötigte Skills
- benötigte Werkzeuge
- bekannte Knowledge-Anforderung
- Bauzeit
- Platzierungsregeln
- Effekte

Wenn gesperrt, nicht technisch schreiben:

```text
Tech fehlt
```

Sondern immersiv:

```text
Du hast noch nicht verstanden, wie Rauch Nahrung haltbar macht.
```

---

# 19. Entwicklungsreihenfolge

## Phase 1

- BuildDefinitions-Datenstruktur erstellen
- erste BuildDefinitions anlegen
- BuildMenu mit Kategorien bauen

## Phase 2

- PlacementMode einbauen
- Ghost-Preview anzeigen
- einfache Platzierungsprüfung

## Phase 3

- BuildJob-System erstellen
- Baupläne in der Welt speichern
- Materialbedarf anzeigen

## Phase 4

- Materialzuweisung integrieren
- Baufortschritt ermöglichen
- fertige WorldObjects erzeugen

## Phase 5

- Skill- und Knowledge-Prüfung integrieren
- Sichtbarkeit und Sperrlogik einbauen

## Phase 6

- Standortqualität einbauen
- Wettereffekte auf Bauobjekte integrieren
- beschädigte Objekte und Reparatur vorbereiten

---

# 20. Wichtigste Designregel

Das Baumenü darf nicht das Gefühl erzeugen:

```text
Ich klicke ein Rezept und bekomme ein Objekt.
```

Es soll das Gefühl erzeugen:

```text
Ich plane mein Lager, beschaffe Material, suche einen guten Platz und baue Schritt für Schritt meine Überlebensbasis.
```

Das ist der Kern des Systems.
