# Survival-System Masterdesign
# Tropical Survival Sandbox

Version 1.0

---

# Vision des Spiels

Das Spiel soll ein realistisches, schweres und immersives Survival-Erlebnis erzeugen.

Der Spieler strandet allein in einer tropischen Wildnis und muss:
- Ressourcen finden
- Feuer machen
- Nahrung sichern
- Unterkünfte bauen
- Krankheiten behandeln
- Werkzeuge herstellen
- Wetter überleben
- Tiere jagen
- Verletzungen versorgen

Das Spiel soll dauerhaft Druck erzeugen.

Nicht:
„Ich habe jetzt alles.“

Sondern:
„Ich muss vorbereitet sein.“

Die Welt bleibt gefährlich.

---

# Inspirationsquellen

- Project Zomboid
- The Long Dark
- Stranded Deep

Wichtige Designziele:
- schwere Survivalmechaniken
- glaubwürdige Verarbeitung
- langsame Progression
- emergente Probleme
- starke Atmosphäre
- Isolation
- permanentes Ressourcenmanagement

---

# Technologiegrenze

Die Technologie endet ungefähr bei:

- primitiven Eisenwerkzeugen
- einfachen Öfen
- Holzunterkünften
- Lagerhaltung
- Feuer- und Naturtechnologie

KEINE:
- Elektrizität
- Maschinen
- moderne Waffen
- Fabriken

Das Spiel bleibt bewusst „roh“.

---

# Weltstruktur

Die Welt besteht aus mehreren Biomen.

Jedes Biom besitzt:
- eigene Ressourcen
- eigene Tiere
- eigene Gefahren
- unterschiedliche Sichtweite
- unterschiedliche Wettereffekte

---

# Biome

---

## 1. Strand

### Atmosphäre
- offenes Gelände
- starke Sonne
- Wind
- leicht zu navigieren

### Ressourcen
- Muscheln
- Krebs
- Treibholz
- Kokosnüsse
- Palmblätter
- Steine
- Salzwasser

### Gefahren
- Dehydration
- Sonnenhitze
- wenig Schutz
- Stürme

### Tiere
- Krabben
- Schildkröten
- Möwen (später)

---

## 2. Grasland

### Atmosphäre
- halb offen
- gute Sicht
- erste Sammelzone

### Ressourcen
- Fasern
- Kräuter
- kleine Äste
- essbare Pflanzen

### Gefahren
- wenig Deckung
- Hitze
- giftige Pflanzen

### Tiere
- kleine Echsen
- Insekten
- Wildschweine

---

## 3. Hohes Gras

### Atmosphäre
- schlechte Sicht
- dichter Bewuchs
- unsicher

### Ressourcen
- Fasern
- Heilpflanzen
- versteckte Ressourcen

### Gefahren
- Schlangen
- Verletzungen
- schlechter Überblick

---

## 4. Leichter Wald

### Atmosphäre
- erste echte Holzquelle
- ruhiger
- geschützter

### Ressourcen
- Holz
- Harz
- Äste
- Pilze
- Kräuter

### Gefahren
- Dunkelheit
- Orientierung
- Tiere

### Tiere
- Wildschweine
- Vögel
- Spinnen

---

## 5. Dichter Wald

### Atmosphäre
- dunkel
- feucht
- bedrückend

### Ressourcen
- Hartholz
- große Bäume
- seltene Pflanzen
- Pilze

### Gefahren
- Krankheiten
- Nässe
- Orientierungslosigkeit
- Verletzungen

---

## 6. Dschungel

### Atmosphäre
- extrem dicht
- laut
- feucht
- gefährlich

### Ressourcen
- Lianen
- exotische Früchte
- Heilpflanzen
- seltenes Holz
- große Tiere

### Gefahren
- Schlangen
- Fieber
- Parasiten
- Verletzungen
- Sichtprobleme

### Tiere
- Wildschweine
- Schlangen
- Affen (später)
- große Insekten

---

# Kernspielschleife

Spieler:
- erkundet
- sammelt
- verarbeitet
- baut
- überlebt
- plant voraus

Neue Probleme entstehen ständig:
- Hunger
- Wetter
- Krankheit
- Werkzeugverschleiß
- Verletzungen
- Verderb
- Dunkelheit

---

# Ressourcen-System

---

# Rohstoffe

## Holzarten

| Ressource | Eigenschaften |
|---|---|
| Kleine Äste | leicht entzündbar |
| Buschholz | schnelles Feuer |
| Palmholz | leicht |
| Hartholz | langlebig |
| Treibholz | feucht |
| Baumstamm | schwere Ressource |

---

## Pflanzen

| Ressource | Nutzung |
|---|---|
| Fasern | Seile |
| Lianen | starke Bindungen |
| Kräuter | Medizin |
| Pilze | Nahrung |
| Palmblätter | Dächer |
| exotische Früchte | Nahrung |
| Heilpflanzen | Medikamente |

---

## Steinarten

| Ressource | Nutzung |
|---|---|
| Kiesel | primitive Werkzeuge |
| Feuerstein | scharf |
| Granit | stabile Bauwerke |
| Obsidian | extrem scharf |

---

## Tierressourcen

| Ressource | Quelle |
|---|---|
| Fleisch | Tiere |
| Knochen | größere Tiere |
| Haut | Wildschweine |
| Fett | spätere Rezepte |
| Schildkrötenpanzer | Behälter |
| Muscheln | Werkzeuge/Deko |

---

# Ressourcen-Zustände

Alle Ressourcen besitzen Zustände.

---

## Holz

Zustände:
- frisch
- feucht
- trocken
- morsch

Einfluss:
- Brennwert
- Gewicht
- Bauqualität

---

## Nahrung

Zustände:
- frisch
- alt
- verdorben
- geräuchert
- getrocknet

---

# Feuer-System

Feuer ist lebenswichtig.

---

## Feuer-Eigenschaften

| Eigenschaft | Effekt |
|---|---|
| Temperatur | Crafting |
| Brenndauer | Überleben |
| Rauch | Sichtbarkeit |
| Licht | Sicherheit |
| Stabilität | Wetterabhängig |

---

## Wetter-Einfluss

| Wetter | Effekt |
|---|---|
| Regen | Feuer kann ausgehen |
| Wind | Feuer instabil |
| Sturm | Feuer gefährlich |
| Trockenheit | leicht entzündbar |

---

## Brennstoffe

| Material | Effekt |
|---|---|
| Äste | schnelles Feuer |
| trockenes Holz | stabiles Feuer |
| feuchtes Holz | viel Rauch |
| Palmblätter | kurzes Aufflammen |
| Holzkohle | lange Brenndauer |

---

# Inventar-System

Inventar = Mittelstufe Realismus

---

## Regeln

- Gewichtssystem
- begrenzte Slots
- große Werkzeuge belegen mehr Platz
- stapelbare Ressourcen
- schwere Gegenstände verlangsamen Bewegung

---

## Behälter

| Objekt | Funktion |
|---|---|
| Kokosschale | Wasser |
| Tasche | mehr Slots |
| Kiste | Lagerung |
| Regal | Base-Lager |

---

# Werkzeug-System

Werkzeuge besitzen:
- Haltbarkeit
- Qualität
- Effizienz

---

## Werkzeuge

### Primitive Werkzeuge

- Steinmesser
- Steinaxt
- Steinspitzhacke
- Speer

### Fortgeschrittene Werkzeuge

- verbesserte Axt
- Eisenwerkzeuge

---

## Qualitätsstufen

| Qualität | Effekt |
|---|---|
| improvisiert | geringe Haltbarkeit |
| einfach | Standard |
| stabil | effizienter |
| hochwertig | langlebig |
| meisterhaft | selten |

---

# Skill-System

---

## Skills

| Skill | Beschreibung |
|---|---|
| Feuermachen | Feuer |
| Holzbearbeitung | Holz |
| Feuersteinklopfen | Stein |
| Kochen | Nahrung |
| Jagen | Tiere |
| Sammeln | Pflanzen |
| Medizin | Heilung |
| Schmieden | Metall |
| Bauen | Unterkünfte |

---

## Skill-Design

Skills verändern:
- Effizienz
- Qualität
- Haltbarkeit
- Craftzeiten
- Freischaltungen

Nicht nur Prozentwerte.

---

# Krankheitssystem

---

## Krankheiten

| Krankheit | Ursache |
|---|---|
| Erkältung | Regen/Kälte |
| Fieber | Infektion |
| Parasiten | schlechtes Essen |
| Vergiftung | Pflanzen |
| Erschöpfung | Schlafmangel |

---

## Behandlung

| Behandlung | Wirkung |
|---|---|
| Kräuter | leichte Heilung |
| Ruhe | Regeneration |
| Feuerwärme | Erkältung |
| gekochtes Wasser | Parasiten vermeiden |

---

# Verletzungssystem

---

## Verletzungen

| Verletzung | Ursache |
|---|---|
| Schnittwunden | Werkzeuge |
| Bisse | Tiere |
| Verstauchung | Stürze |
| Blutung | Kämpfe |
| Vergiftung | Schlangen |

---

# Tier-System

Tiere dienen:
- Nahrung
- Gefahr
- Ressourcen

---

## Aktuelle Tiere

| Tier | Ressourcen |
|---|---|
| Krabbe | Fleisch |
| Schildkröte | Fleisch + Panzer |
| Wildschwein | Fleisch + Haut + Knochen |

---

## Spätere Tiere

| Tier | Besonderheit |
|---|---|
| Schlange | Gift |
| Affe | Diebstahl |
| große Spinnen | Gefahr |
| Raubkatzen | Endgame-Gefahr |

---

# Unterkunftssystem

Unterkünfte bieten:
- Schutz
- Komfort
- Lagerung
- Schlafqualität

---

## Unterkunftsstufen

### Palmendach
- minimaler Schutz

### Primitive Hütte
- Regenresistenz

### Holzunterkunft
- bessere Erholung

### Verstärkte Unterkunft
- Schutz vor Sturm

---

# Verarbeitungsketten

---

## Holz

Baum
→ Stamm
→ gespaltenes Holz
→ trockenes Holz
→ Bretter

---

## Nahrung

Tier
→ Fleisch
→ Kochen/Räuchern
→ Lagerung

---

## Metall

Erz
→ Ofen
→ Eisenbarren
→ Werkzeug

---

# Progressionsziel

Das Spiel soll:
- langsam
- schwer
- atmosphärisch

sein.

Nach 10 Stunden:
- primitive Basis
- erste stabile Werkzeuge
- erste sichere Nahrung

Aber:
keine völlige Sicherheit.

---

# Emergent Gameplay

Das Spiel soll Situationen erzeugen wie:

- Feuer geht im Regen aus
- Werkzeug bricht mitten im Wald
- Nahrung verdirbt
- Spieler verirrt sich im Dschungel
- Krankheit während eines Sturms
- Schlange im hohen Gras
- Schlafmangel führt zu Fehlern

Das sind die eigentlichen Geschichten des Spiels.

---

# Technische Empfehlung

Systeme modular aufbauen:

- ItemSystem
- WeatherSystem
- FireSystem
- SkillSystem
- DiseaseSystem
- AIAnimalSystem
- DecaySystem
- InventorySystem
- CraftingSystem
- BuildingSystem

Alle Systeme datenbasiert.

Rezepte, Ressourcen und Tiere über JSON/Data-Dateien definieren.