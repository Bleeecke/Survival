# Terrain Direction Draft

## Ziel

Das Spiel soll eine 2D-Survival-Inselwelt mit klar lesbaren Höhen, Plateaus und Klippen haben.
Die Optik soll sich an **Don’t Starve Together** orientieren, aber das Terrain selbst muss echte Lesbarkeit besitzen.

## Leitprinzip

- **DST als Stilreferenz**
  - starke Silhouetten
  - klare Biome
  - handgemachte, leicht stilisierte Formen
  - wenig visuelle Unruhe

- **Nicht DST als Terrainmodell**
  - keine echten Höhen dort
  - bei uns brauchen wir trotzdem Plateaus, Abhänge und Berge

- **2D-Logik statt 3D-Anmutung**
  - keine pseudo-realistischen Felskanten
  - keine kaputten Tile-Artefakte
  - keine Rampen nur als technische Notlösung

## Gewünschte Formensprache

### 1. Küste

- Klarer Strandring
- Sanfter Übergang von Wasser zu Strand
- Nur wenige, bewusst gesetzte Brandungs- oder Küstenzonen

### 2. Ebenen

- Grasflächen sollen ruhig und offen wirken
- Kleine Bodenunruhe ist erlaubt:
  - Hügelchen
  - Mulden
  - leichte Rücken
- Aber keine kaputten Mini-Klippen

### 3. Plateaus

- Plateaus sollen groß und gut erkennbar sein
- Nicht nur ein paar Hoch-Tiles hinter dem Strand
- Plateau-Kanten sollen sauber, aber nicht hart-technisch wirken
- Übergänge müssen logisch lesbar bleiben

### 4. Berge

- Berge sollen als zusammenhängende Massifs erscheinen
- Nicht als verstreute Einzel-Tiles
- Mit:
  - Kernzone
  - Vorzone
  - Abfallzone
  - wenigen Zugangspunkten

### 5. Klippen

- Klippen sind Übergänge, nicht Hauptattraktion
- Sie sollen:
  - organisch wirken
  - nicht wie kaputte Artefakte aussehen
  - nicht jede Höhendifferenz überzeichnen

## Was aktuell falsch war

- Zu viele harte, technische Kanten
- Rampen wurden eher für Erreichbarkeit als für Lesbarkeit platziert
- Berge entstanden fast nur hinter dem Strand
- Im Inland fehlten echte Formen und Landmarken
- Das Gelände sah dadurch nach kaputtem Tile-Mapping aus

## Gewünschtes World-Pattern

Die Insel sollte eher so aufgebaut sein:

1. Küstenring
2. große offene Lowlands
3. ein oder zwei klare Hochflächen
4. einzelne Bergzüge oder Massifs
5. wenige, lesbare Wege zwischen den Zonen

Nicht so:

- Strand
- direkt dahinter kaputte Stufen
- danach fast nichts
- und dann plötzlich Berge

## Terrain-Regeln

### Höhenverteilung

- Tier 0: Wasser, Strand
- Tier 1: offene Ebenen / Grasland
- Tier 2: Plateaus / Hügelvorland
- Tier 3: Berge / Hochland

### Übergänge

- Tier-Unterschiede sollen selten und bewusst sein
- Nicht jede Kante braucht eine Rampenlogik
- Mehr Fläche, weniger Stufensalat

### Spawn-Lesbarkeit

- Start immer auf einer klaren Küstenzone
- Der erste Blick muss verständlich sein:
  - wo ist offen
  - wo ist hoch
  - wo komme ich hin

## Style Rules

- Flächige Biome dürfen leicht gemustert sein
- Höhen sollen durch Form, Schatten und Kontur lesbar sein
- Klippen dürfen niemals wie Glitches wirken
- Rampen nur dort, wo ein Spieler sie intuitiv erwartet
- Berge brauchen markante Silhouetten

## Empfehlung für die Umsetzung

### Phase 1

Terrain-Geometrie sauber neu bauen:
- Höhenfeld
- Massifs
- Plateaus
- sanfte Übergänge

### Phase 2

Biome darauf legen:
- Gras
- Wald
- Dschungel
- Fels
- Schnee / karge Zonen oben

### Phase 3

Visuelle Verfeinerung:
- Klippenstil
- Rampenstil
- Felsdetails
- Decos für Ebenen und Höhen

## Kurzform

**DST-Look, aber mit klarer 2D-Topografie.**

Nicht realistischer Bergbaukasten.
Nicht kaputte Tile-Klippen.
Sondern:
- klare Inselstruktur
- lesbare Höhen
- organische Plateaus
- kontrollierte Rampen
- Berge mit Charakter
