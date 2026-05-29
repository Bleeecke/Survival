# Survival Game — Crafting-, Ressourcen- und Knowledge-System

Version: 1.0  
Ziel: Umsetzbare Master-Dokumentation für Claude Code / Codex  
Basis: vorhandenes Crafting-System mit Rezepten, Skills, Tool-Prüfung, Erfolgswahrscheinlichkeit, Craftzeit, Sichtbarkeit und XP-Vergabe.

---

## 1. Grundidee

Das Spiel soll kein klassisches Tech-Tree-Spiel sein. Es soll sich nicht so anfühlen, als würde der Spieler Forschungspunkte ausgeben und dadurch neue Gegenstände freischalten.

Stattdessen soll der Spieler durch Erfahrung, Materialentdeckung, Werkzeugnutzung und Skillentwicklung neue Dinge verstehen.

Die Progression lautet:

> Nicht: „Ich habe Technologie erforscht.“  
> Sondern: „Ich habe gelernt, in dieser Umgebung zu überleben.“

Das System kombiniert:

- Skills
- entdeckte Materialien
- vorhandene Werkzeuge
- gebaute Stationen
- Umweltbedingungen
- wiederholte Nutzung
- versteckte Knowledge-Flags

Rezepte werden dadurch sichtbar, wenn sie aus Sicht der Spielfigur logisch verständlich werden.

---

## 2. Designziele

Das System soll:

- realistisch wirken, ohne zur Simulation jedes Details zu werden
- länger motivieren als ein reines Rezeptmenü
- den Spieler nach 10 Stunden noch unter Druck halten
- Crafting, Skills, Ressourcen, Tiere, Krankheiten, Wetter und Unterkunft verbinden
- keine schnelle vollständige Sicherheit erlauben
- ein Gefühl von Dschungel, Isolation und improvisiertem Überleben erzeugen
- datenbasiert aufgebaut sein, damit Claude Code / Codex es sauber erweitern kann

Das System soll nicht:

- nach drei Spieltagen bereits Unterkunft, Spitzhacke, Nahrungssicherheit und Komfort erlauben
- ein sichtbarer Forschungstechbaum sein
- Ressourcen zu generisch behandeln
- Crafting als reinen Button-Klick ohne Zusammenhang darstellen

---

## 3. Bestehende Mechaniken, die erhalten bleiben

Die vorhandenen Grundmechaniken bleiben erhalten, werden aber erweitert.

### 3.1 Materialprüfung

Ein Rezept kann nur hergestellt werden, wenn alle benötigten Input-Materialien im Inventar, in nahen Containern oder in der aktiven Crafting-Station verfügbar sind.

Dev-Modus:

```txt
freeCraft = true -> Materialprüfung wird übersprungen
```

### 3.2 Werkzeugprüfung

Werkzeuge können benötigt werden als:

- im Inventar vorhanden
- ausgerüstet in linker oder rechter Hand
- in der Station eingebaut
- in Reichweite

Beispiele:

```txt
campfire_near -> Lagerfeuer maximal 2 Tiles entfernt
any_axe -> Steinaxt, verbesserte Axt, Eisenaxt oder gleichwertiges Werkzeug
knife_required -> Messer oder scharfer Stein
workbench_near -> Werkbank maximal 2 Tiles entfernt
shelter_near -> Unterkunft maximal X Tiles entfernt
```

### 3.3 Skillprüfung

Rezepte können Mindestskills besitzen.

Beispiel:

```json
"requiresSkill": {
  "skill": "flint_knapping",
  "level": 1
}
```

### 3.4 Erfolgswahrscheinlichkeit

Für bestimmte primitive oder schwierige Herstellungsprozesse gilt:

```txt
chance = baseChance + (skillLevel - 1) * bonusPerLevel
```

Maximalwert:

```txt
maxChance = 1.0
```

Bei Fehlschlag:

- Materialien können teilweise oder vollständig verbraucht werden
- Werkzeug kann Haltbarkeit verlieren
- Spieler erhält reduzierte XP
- bei gefährlichen Tätigkeiten kann eine kleine Verletzung entstehen

Standard:

```txt
failXp = baseXp * 0.3
```

### 3.5 Craftzeit

Die bisherige Formel wird als Basis erhalten:

```txt
effectiveTime = craftingTime * (1 - (skillLevel - 1) * 0.05)
```

Begrenzung:

```txt
maxReduction = 45% bei Level 10
```

Erweiterung:

Craftzeit wird zusätzlich beeinflusst durch:

- Werkzeugqualität
- Müdigkeit
- Lichtverhältnisse
- Wetter
- Verletzungen
- Stationen
- Materialzustand

### 3.6 XP-Vergabe

XP wird vergeben für:

- erfolgreiches Crafting
- teilweise auch Fehlschläge
- Sammeln
- Jagd
- Verarbeitung
- Reparatur
- Behandlung von Krankheiten/Verletzungen
- Feuerpflege
- Bauphasen

---

## 4. Neues Kernsystem: Knowledge statt Tech-Tree

### 4.1 Prinzip

Es gibt keinen sichtbaren Technologiebaum. Intern existieren jedoch Voraussetzungen, die wie ein versteckter Tech-Tree funktionieren.

Der Spieler sieht nur:

- bekannte Rezepte
- neu verstandene Rezepte
- Hinweise wie „Du bekommst eine Idee...“
- neue Materialbeschreibungen

### 4.2 Knowledge-Quellen

Der Spieler erhält Wissen durch:

| Quelle | Beispiel |
|---|---|
| Material entdecken | Spieler findet Harz |
| Skilllevel erreichen | Holzbearbeitung Level 3 |
| Werkzeug herstellen | Feuersteinmesser gebaut |
| Umgebung nutzen | Fleisch in Rauch gelegt |
| Station bauen | Werkbank gebaut |
| Fehlschläge | Feuerstein zerspringt, Spieler lernt trotzdem |
| Tiere zerlegen | Knochen und Haut werden entdeckt |
| Krankheit erleben | Spieler lernt Behandlungsmöglichkeiten |

### 4.3 Knowledge Flags

Knowledge Flags sind interne boolesche Werte.

Beispiele:

```json
{
  "knowledge": {
    "understands_fire": true,
    "understands_sharp_edges": true,
    "understands_rope_binding": true,
    "understands_drying": false,
    "understands_smoking": false,
    "understands_hide_processing": false,
    "understands_charcoal": false,
    "understands_metal_smelting": false
  }
}
```

### 4.4 Rezeptfreischaltung

Ein Rezept wird sichtbar, wenn mehrere Bedingungen erfüllt sind.

Beispiel Fackel:

```json
{
  "id": "torch",
  "unlockConditions": {
    "discoveredItems": ["branch", "resin", "rope"],
    "skills": { "firemaking": 1 },
    "knowledge": ["understands_fire", "understands_rope_binding"]
  }
}
```

Beispiel Trockengestell:

```json
{
  "id": "drying_rack",
  "unlockConditions": {
    "discoveredItems": ["branch", "rope", "raw_meat"],
    "skills": { "building": 2, "hunting": 1 },
    "knowledge": ["understands_preservation"]
  }
}
```

### 4.5 UI-Regel

Der Spieler soll keine abstrakten Flags sehen.

Statt:

```txt
Knowledge Flag unlocked: understands_drying
```

Besser:

```txt
Du verstehst langsam, dass Fleisch länger hält, wenn du es trocknest.
```

---

## 5. Biome

Die Welt besteht aus Biomen mit eigenen Ressourcen, Gefahren und Tieren.

### 5.1 Strand

Ressourcen:

- Muscheln
- Krabben
- Kokosnüsse
- Palmblätter
- Treibholz
- Kiesel
- Salzwasser
- gelegentlich Schildkröten

Gefahren:

- Sonne
- Dehydration
- wenig Schatten
- Stürme
- nasses Treibholz

Gameplay-Rolle:

- Startgebiet
- leichte Nahrung
- einfache Materialien
- schlechte Langzeitbasis ohne Schatten/Wasser

### 5.2 Grasland

Ressourcen:

- Fasern
- kleine Äste
- Kräuter
- essbare Pflanzen
- kleine Steine

Gefahren:

- Hitze
- wenig Deckung
- Insekten
- giftige Pflanzen möglich

Gameplay-Rolle:

- frühe Sammelzone
- gute Sicht
- Übergang zum Wald

### 5.3 Hohes Gras

Ressourcen:

- Fasern
- Heilpflanzen
- versteckte Kräuter
- Insektenressourcen später optional

Gefahren:

- schlechte Sicht
- Schlangen
- Kratzer/Schnittwunden
- Orientierung erschwert

Gameplay-Rolle:

- riskantes Sammelgebiet
- Medizinressourcen
- frühe Gefahr ohne direkten Kampf

### 5.4 Leichter Wald

Ressourcen:

- Äste
- Holz
- Harz
- Pilze
- Kräuter
- Feuerstein gelegentlich

Tiere:

- Wildschweine
- Vögel optional
- Insekten

Gefahren:

- Dunkelheit
- Tiere
- Regen bleibt länger in der Umgebung

Gameplay-Rolle:

- erste echte Holzquelle
- Basisbau möglich
- guter mittlerer Schwierigkeitsgrad

### 5.5 Dichter Wald

Ressourcen:

- Hartholz
- große Baumstämme
- seltene Pilze
- seltene Heilpflanzen
- mehr Harz

Tiere:

- Wildschweine
- Schlangen
- später Raubtiere optional

Gefahren:

- niedrige Sichtweite
- hohe Feuchtigkeit
- mehr Krankheiten
- Verirrungsrisiko

Gameplay-Rolle:

- hochwertige Ressourcen
- hoher Druck
- gefährliche Expeditionen

### 5.6 Dschungel

Ressourcen:

- Lianen
- exotische Früchte
- Heilpflanzen
- seltenes Holz
- Bambus optional
- Giftpflanzen

Tiere:

- Schlangen
- Wildschweine
- Affen optional
- große Insekten optional

Gefahren:

- Fieberrisiko
- Parasiten
- Schlangenbisse
- schlechte Sicht
- ständige Feuchtigkeit

Gameplay-Rolle:

- hohes Risiko
- wertvolle Ressourcen
- Midgame/Endgame-Exploration

### 5.7 Höhlen / Felsbereiche optional

Ressourcen:

- Eisenerz
- Granit
- Feuerstein
- Obsidian optional

Gefahren:

- Dunkelheit
- Verletzungen
- Orientierung
- Tiere optional

Gameplay-Rolle:

- späte Ressourcengewinnung
- Metallverarbeitung

---

## 6. Ressourcen und Items

### 6.1 Item-Kategorien

Jedes Item gehört mindestens einer Kategorie an.

```txt
raw_resource
processed_resource
tool
weapon
food
medicine
building_part
station
container
fuel
animal_part
water_container
clothing
```

### 6.2 Gemeinsame Item-Eigenschaften

Alle Items können folgende Felder besitzen:

```json
{
  "id": "item_id",
  "name": "Anzeigename",
  "category": ["raw_resource"],
  "weight": 0.2,
  "stackSize": 20,
  "durability": null,
  "quality": "normal",
  "states": [],
  "tags": []
}
```

### 6.3 Zustände

Mögliche Itemzustände:

```txt
wet
dry
fresh
old
spoiled
smoked
dried
raw
cooked
burned
damaged
sharp
dull
infected
contaminated
```

---

## 7. Holz- und Pflanzenressourcen

### 7.1 Sammelressourcen

| ID | Name | Biom | Werkzeug | Nutzung |
|---|---|---|---|---|
| branch | Ast | alle | Hände | Feuer, primitive Werkzeuge |
| small_stick | kleiner Ast | alle | Hände | Feuerstarter |
| bushwood | Buschholz | Grasland | Hände/Messer | Brennstoff |
| palm_leaf | Palmenblatt | Strand | Hände/Messer | Dach, Wasserfänger |
| palm_wood | Palmholz | Strand | Axt | Bau, Feuer |
| driftwood | Treibholz | Strand | Hände | Feuer, Bau, meist feucht |
| log | Baumstamm | Wald | Axt | Bau, Bretter |
| hardwood_log | Hartholzstamm | dichter Wald | gute Axt | stabile Konstruktionen |
| resin | Harz | Wald | Messer | Fackeln, Wundverschluss |
| fiber | Fasern | Grasland | Hände/Messer | Seile |
| vine | Liane | Dschungel | Messer | starke Bindungen |
| herb | Kräuter | Grasland/Wald | Hände | Medizin |
| medicinal_plant | Heilpflanze | Dschungel | Hände | stärkere Medizin |
| mushroom | Pilz | Wald | Hände | Nahrung/Risiko |
| exotic_fruit | exotische Frucht | Dschungel | Hände | Nahrung |
| coconut | Kokosnuss | Strand | Hände | Nahrung/Wasser/Schale |
| bamboo | Bambus | Dschungel | Messer/Axt | Speere, leichte Bauweise |

### 7.2 Verarbeitete Holz-/Pflanzenressourcen

| ID | Name | Herstellung | Nutzung |
|---|---|---|---|
| split_wood | gespaltenes Holz | Stamm + Axt | Feuer, Bau |
| dry_wood | trockenes Holz | Holz trocknen | guter Brennstoff |
| plank | Brett | Holz + Werkbank | Bau |
| charcoal | Holzkohle | Holz im kontrollierten Feuer | langer Brennstoff, Schmieden |
| rope | Seil | Fasern + Liane | Bau/Werkzeuge |
| cordage | Kordel | Fasern | primitive Bindungen |
| hardened_stick | gehärteter Ast | Ast + Feuer | Speer, Werkzeuggriff |

---

## 8. Stein- und Mineralressourcen

### 8.1 Rohstoffe

| ID | Name | Biom | Nutzung |
|---|---|---|---|
| pebble | Kiesel | Strand/Grasland | primitive Werkzeuge |
| stone | Stein | Wald/Fels | Bau, Werkzeuge |
| flint | Feuerstein | Wald/Fels | scharfe Werkzeuge |
| granite | Granit | Fels/Höhle | stabile Bauten |
| obsidian | Obsidian | Vulkan/Fels optional | sehr scharf |
| iron_ore | Eisenerz | Höhle/Fels | Metall |
| clay | Lehm | Gewässer/Wald optional | Ofen/Keramik |

### 8.2 Verarbeitete Stein-/Metallressourcen

| ID | Name | Herstellung | Nutzung |
|---|---|---|---|
| sharp_stone | scharfer Stein | Feuerstein + Schlagstein | Messer, Speer |
| stone_blade | Steinklinge | Feuersteinklopfen | bessere Klinge |
| stone_slab | Steinplatte | Stein + Hammer | Bau |
| iron_bar | Eisenbarren | Erz + Ofen + Brennstoff | Werkzeuge |

---

## 9. Tierressourcen

### 9.1 Krabbe

| Drop | Nutzung |
|---|---|
| crab_meat | Nahrung |
| crab_shell | primitive kleine Werkzeuge optional |

### 9.2 Schildkröte

| Drop | Nutzung |
|---|---|
| turtle_meat | Nahrung |
| turtle_shell | Behälter, Regensammler-Upgrade |
| animal_fat | Brennstoff, Salbe |
| bone_small | kleine Knochen optional |

### 9.3 Wildschwein

| Drop | Nutzung |
|---|---|
| boar_meat | Nahrung |
| hide | Haut/Leder |
| bone | Werkzeuge, Haken, Nadeln |
| animal_fat | Brennstoff, Kochen, Salben |

### 9.4 Fisch

| Drop | Nutzung |
|---|---|
| fish | Nahrung |
| fish_bone | Angelhaken optional |
| fish_oil | Brennstoff/Salbe optional |

### 9.5 Schlange später

| Drop | Nutzung |
|---|---|
| snake_meat | riskante Nahrung |
| venom | Gift/Gegengift-System |
| snake_skin | leichte Lederressource optional |

---

## 10. Nahrungssystem

### 10.1 Nahrungszustände

Nahrung besitzt Zustände:

```txt
raw
fresh
old
spoiled
cooked
smoked
dried
burned
contaminated
```

### 10.2 Grundregeln

- Rohes Fleisch kann krank machen.
- Gekochtes Fleisch ist sicherer, aber hält nicht ewig.
- Geräuchertes Fleisch hält länger.
- Getrocknetes Fleisch ist leicht und haltbar.
- Verdorbene Nahrung erzeugt Magenprobleme, Parasiten oder Fieberrisiko.
- Pilze können essbar, giftig oder unbekannt sein.

### 10.3 Nahrungstabelle

| Item | Roh essbar | Gekocht | Haltbar machbar | Risiko |
|---|---:|---:|---:|---|
| crab_meat | ja | ja | begrenzt | niedrig |
| turtle_meat | nein | ja | ja | mittel |
| boar_meat | nein | ja | ja | hoch roh |
| fish | nein | ja | ja | mittel |
| mushroom | unbekannt | ja | nein | variabel |
| exotic_fruit | ja | nein | trocknen | Verderb |
| coconut | ja | nein | nein | niedrig |

---

## 11. Medizin- und Krankheitssystem

### 11.1 Krankheiten und Zustände

| ID | Name | Ursache | Effekt | Behandlung |
|---|---|---|---|---|
| wet_cold | Erkältung | nass + kalt + schlechter Schlaf | Ausdauer runter | Wärme, Schlaf, Kräutertee |
| fever | Fieber | Infektion, Dschungel, Biss | Crafting langsamer, Sicht schlechter | Heilpflanze, Ruhe |
| food_poisoning | Magenprobleme | verdorbenes Essen, rohe Nahrung | Hunger/Durst schneller | Wasser, Ruhe, Kräuter |
| infection | Infektion | unbehandelte Wunde | Fieberrisiko | Verband, Harz, Salbe |
| parasite | Parasiten | ungekochtes Wasser/Nahrung | langsame Schwächung | gekochtes Wasser, Heilpflanze |
| exhaustion | Erschöpfung | Schlafmangel, Überlastung | Skill-Malus, langsamer | Schlaf, Unterkunft |
| snake_venom | Schlangengift | Schlangenbiss | kritischer Zustand | Gegengift/Heilpflanze |

### 11.2 Verletzungen

| ID | Name | Ursache | Effekt | Behandlung |
|---|---|---|---|---|
| cut | Schnitt | Werkzeug, Dornen | Blutung/Infektion | Verband |
| bite | Biss | Tier | Blutung/Infektion | Verband, Salbe |
| sprain | Verstauchung | Sturz, Überlastung | Bewegung langsamer | Ruhe |
| burn | Verbrennung | Feuer | Schaden/Schmerz | Wasser, Salbe |
| scratch | Kratzer | hohes Gras, Tier | kleines Infektionsrisiko | Reinigung |

### 11.3 Medizinische Items

| ID | Name | Herstellung | Wirkung |
|---|---|---|---|
| herbal_remedy | Kräutermittel | 3x Kräuter | leichte Heilung |
| bandage | Verband | Fasern / Stoff später | stoppt Blutung |
| resin_seal | Harzverschluss | Harz | senkt Infektionsrisiko |
| primitive_salve | primitive Salbe | Tierfett + Kräuter | Wundschutz |
| fever_mix | Fiebermittel | Heilpflanze + Wasser | Fieber senken |
| antidote_basic | einfaches Gegengift | Heilpflanze + Schlangengift optional | Gift senken |

---

## 12. Werkzeugsystem

### 12.1 Grundregeln

Werkzeuge besitzen:

- Haltbarkeit
- Qualität
- Effizienz
- Gewicht
- benötigte Hand
- Skillbindung

### 12.2 Qualitätsstufen

| Qualität | Effekt |
|---|---|
| improvised | geringe Haltbarkeit, langsam |
| simple | Standard |
| sturdy | stabiler, etwas effizienter |
| fine | bessere Ausbeute, langlebiger |
| masterwork | selten, sehr langlebig |

### 12.3 Werkzeugliste

| ID | Name | Materialbasis | Nutzung |
|---|---|---|---|
| sharp_stone | Scharfer Stein | Feuerstein | Schneiden, Notwerkzeug |
| flint_knife | Feuersteinmesser | scharfer Stein + Griff + Fasern | Zerlegen, Seile, Medizin |
| stone_axe | Steinaxt | Äste + Kiesel/Stein | Holz, Kampf schlecht |
| stone_pickaxe | Steinspitzhacke | Äste + Stein | Stein/Erz |
| stone_spear | Steinspeer | Äste + Stein | Jagd |
| torch | Fackel | Ast + Harz + Seil | Licht |
| improved_axe | verbesserte Axt | Holz + Stein | effizienter Holzabbau |
| improved_pickaxe | verbesserte Spitzhacke | Holz + Stein | effizienter Steinabbau |
| iron_axe | Eisenaxt | Eisenbarren + Griff | Late Game Werkzeug |
| iron_pickaxe | Eisenspitzhacke | Eisenbarren + Griff | Late Game Erz |
| fishing_rod | Angelrute | Äste + Seil | Fischfang |
| bone_hook | Knochenhaken | Knochen | Angeln/kleine Fallen |
| bone_needle | Knochennadel | Knochen | Leder/Verbände später |

### 12.4 Haltbarkeit

Werkzeuge verlieren Haltbarkeit durch:

- Nutzung
- falsches Material
- Kampf
- Regen/Lagerung optional
- Fehlschläge beim Crafting

Bei 0 Haltbarkeit:

- Werkzeug bricht
- eventuell Rückgewinnung von Materialien

---

## 13. Feuer- und Brennstoffsystem

Feuer existiert bereits als wetterrelevantes System und bleibt zentral.

### 13.1 Feuerwerte

Ein Feuer besitzt:

```json
{
  "fuel": 50,
  "heat": 0.7,
  "lightRadius": 4,
  "smoke": 0.2,
  "rainProtection": 0.0,
  "stability": 0.8
}
```

### 13.2 Brennstoffe

| ID | Name | Brenndauer | Rauch | Bemerkung |
|---|---:|---:|---|
| branch | Ast | kurz | niedrig | leicht verfügbar |
| bushwood | Buschholz | kurz-mittel | mittel | frühes Feuer |
| dry_wood | trockenes Holz | lang | niedrig | guter Brennstoff |
| wet_wood | feuchtes Holz | schlecht | hoch | Notbrennstoff |
| palm_leaf | Palmenblatt | sehr kurz | mittel | schnelles Aufflammen |
| charcoal | Holzkohle | sehr lang | niedrig | hochwertig |
| animal_fat | Tierfett | Verstärker | niedrig | Feuerbooster |

### 13.3 Feuer-Interaktionen

- Feuer wärmt den Spieler.
- Feuer verbessert Schlafnähe, wenn geschützt.
- Feuer kocht Nahrung.
- Feuer schreckt manche Tiere ab.
- Feuer kann Rauch erzeugen.
- Feuer kann bei Regen ausgehen.
- Feuer unter Palmendach ist besser geschützt, aber Brandrisiko optional.

---

## 14. Unterkunft und Basebuilding

### 14.1 Funktion

Unterkünfte bieten:

- Schlafqualität
- Regeneration
- Schutz vor Regen
- Lagerkapazität
- psychologische Sicherheit
- Schutz vor Tieren, je nach Stufe

### 14.2 Gebäude und Stationen

| ID | Name | Funktion |
|---|---|---|
| campfire | Lagerfeuer | Wärme, Licht, Kochen |
| rain_collector | Regensammler | Wasser sammeln |
| palm_roof | Palmendach | minimaler Regenschutz |
| wooden_shelter | Holzunterkunft | besserer Schlaf, Lager |
| storage_box | Lagerbox | Items lagern |
| workbench | Werkbank | Verarbeitung, bessere Rezepte |
| bed | Bett | Erholung |
| drying_rack | Trockengestell | Nahrung haltbar machen |
| smoker | Räucherstelle | Fleisch räuchern |
| kiln | einfacher Ofen | Lehm/Kohle optional |
| smelter | Schmelzofen | Eisenbarren |
| reinforced_shelter | verstärkte Unterkunft | Wetterschutz, Sicherheit |

### 14.3 Bauphasen

Größere Gebäude sollten nicht sofort fertig sein.

Beispiel Holzunterkunft:

1. Grundgerüst bauen
2. Dach decken
3. Wände stabilisieren
4. Schlafplatz einrichten

Technisch kann das als mehrere Rezepte oder als BuildingProgress-Komponente umgesetzt werden.

```json
{
  "buildingId": "wooden_shelter",
  "progress": 0.45,
  "requiredStages": [
    "frame",
    "roof",
    "walls",
    "interior"
  ],
  "completedStages": ["frame"]
}
```

---

## 15. Skill-System

### 15.1 Skills

| ID | Name | Rolle |
|---|---|---|
| firemaking | Feuermachen | Feuer, Kohle, Hitze |
| woodworking | Holzbearbeitung | Holz, Bretter, Werkzeuge |
| flint_knapping | Feuersteinklopfen | Steinwerkzeuge |
| cordage | Kordel & Seile | Fasern, Seile, Bindungen |
| gathering | Sammeln | Pflanzen, Pilze, Früchte |
| cooking | Kochen | Nahrung sicher machen |
| hunting | Jagen | Tiere, Speere, Fallen |
| medicine | Medizin | Kräuter, Wunden, Krankheiten |
| building | Bauen | Unterkünfte, Stationen |
| fishing | Angeln | Fischfang |
| metalworking | Metallverarbeitung | Erz, Barren, Eisenwerkzeuge |

### 15.2 Levelstruktur

Skills haben Level 1 bis 10.

Progressionsempfehlung für ein 10-Stunden-Ziel:

- Level 1: sofort möglich
- Level 2: nach wenigen Aktionen
- Level 3: nach 30–60 Minuten im Bereich
- Level 4–5: nach mehreren Spielstunden
- Level 6+: Spezialisierung, nicht automatisch erreichbar
- Level 10: sehr selten, Langzeitmotivation

### 15.3 Diminishing Returns

Wiederholtes Crafting desselben Rezepts gibt weniger XP.

```txt
first 5 crafts: 100% XP
6-15 crafts: 60% XP
16-30 crafts: 30% XP
31+ crafts: 10% XP
```

Sammeln einfacher Ressourcen sollte ebenfalls nicht endlos stark leveln.

### 15.4 Skill-Meilensteine

#### Feuermachen

| Level | Effekt |
|---:|---|
| 1 | Lagerfeuer, Ast härten |
| 2 | Feuer leichter entzünden |
| 3 | Feuer besser gegen Regen schützen |
| 4 | Fackeln effizienter |
| 5 | Holzkohle verstehen |
| 7 | heißere Feuer für Metall |
| 10 | sehr effiziente Brennstoffnutzung |

#### Holzbearbeitung

| Level | Effekt |
|---:|---|
| 1 | primitive Holzgriffe |
| 2 | einfache Axt/Unterkunft besser bauen |
| 3 | Bretter herstellen |
| 4 | Lagerboxen stabiler |
| 5 | Werkzeuge haltbarer |
| 7 | komplexe Konstruktionen |
| 10 | hochwertige Unterkünfte |

#### Feuersteinklopfen

| Level | Effekt |
|---:|---|
| 1 | scharfer Stein, Feuersteinmesser |
| 2 | weniger Fehlschläge |
| 3 | bessere Klingen |
| 5 | Obsidian/feine Klingen optional |
| 7 | hochwertige Steinwerkzeuge |
| 10 | Meisterhafte primitive Klingen |

#### Kordel & Seile

| Level | Effekt |
|---:|---|
| 1 | einfache Kordel |
| 2 | Seil |
| 3 | stärkere Bindungen |
| 5 | bessere Haltbarkeit bei Werkzeugen |
| 7 | komplexe Fallen/Bauten |
| 10 | sehr langlebige Seile |

#### Medizin

| Level | Effekt |
|---:|---|
| 1 | Kräutermittel |
| 2 | Verbände effektiver |
| 3 | Harzverschluss verstehen |
| 4 | primitive Salbe |
| 5 | Fiebermittel |
| 7 | Gegengift |
| 10 | sehr geringe Infektionsrisiken |

---

## 16. Bestehende Rezepte, neu eingeordnet

Die vorhandenen Rezepte bleiben als Startbestand erhalten, werden aber nicht mehr über sichtbare Tiers freigeschaltet. Die alten Tiers dienen nur noch als interne Progressionsbereiche.

### 16.1 Frühe Überlebensrezepte

| Rezept | Inputs | Output | Voraussetzung |
|---|---|---|---|
| Lagerfeuer | 5x Äste + 3x Kiesel | Lagerfeuer | Grundwissen Feuer |
| Feuerstein absplittern | 1x Feuerstein + 1x Kiesel | scharfer Stein | Feuersteinklopfen oder Experiment |
| Ast in Feuer härten | 2x Äste | gehärteter Ast | Lagerfeuer nah, Feuermachen Lv1 |
| Feuersteinmesser | scharfer Stein + gehärteter Ast + 3x Fasern | Messer | Feuersteinklopfen Lv1 |
| Palmendach | 8x Äste + 6x Palmenblatt + 3x Liane | Palmendach | Baumaterial entdeckt |
| Regensammler | Kokosschale + Palmenblatt | Sammler | Kokosnuss geöffnet |
| Kokosschale öffnen | Kokosnuss | 2x Schale | Axt oder scharfer Stein |

### 16.2 Primitive Werkzeuge und Nahrung

| Rezept | Inputs | Output | Voraussetzung |
|---|---|---|---|
| Fackel | 2x Äste + 1x Seil + 2x Harz | 2x Fackel | Harz entdeckt, Feuerwissen |
| Steinaxt | 2x Äste + 5x Kiesel | Steinaxt | Bindung verstanden |
| Steinspitzhacke | 2x Äste + 6x Kiesel | Spitzhacke | Steinwerkzeugwissen |
| Steinspeer | 4x Äste + 3x Kiesel | Speer | Jagd Lv1 |
| Seil | 4x Fasern + 2x Liane | 2x Seil | Messer, Kordelwissen |
| Gekochtes Essen | 2x Essen | 2x gekocht | Lagerfeuer |
| Kräutermittel | 3x Kräuter | Heilmittel | Sammeln/Medizin |
| Gebratene Pilze | 2x Pilze | 2x gebraten | Lagerfeuer |
| Gegarte Schildkröte | 2x Schildkrötenfleisch | 2x gegart | Lagerfeuer |
| Gebratenes Wildschwein | 2x Wildschweinfleisch | 2x gebraten | Lagerfeuer |
| Gekochte Krabbe | 2x Krabbenfleisch | 2x gekocht | Lagerfeuer |

### 16.3 Infrastruktur

| Rezept | Inputs | Output | Voraussetzung |
|---|---|---|---|
| Holzunterkunft | 20x Holz + 5x Stein | Unterkunft | Axt, Bauen Lv2 |
| Lagerbox | 8x Holz + 2x Seil | Box | Axt, Seile |
| Werkbank | 15x Holz + 10x Stein | Werkbank | Holzbearbeitung Lv2 |
| Holz zu Ästen | 1x Holz | 3x Äste | Axt |
| Verbesserte Axt | 5x Holz + 10x Stein | Axt | Holzbearbeitung Lv3 |
| Verbesserte Spitzhacke | 5x Holz + 12x Stein | Hacke | Feuersteinklopfen Lv3 |

### 16.4 Fortgeschrittene Verarbeitung

| Rezept | Inputs | Output | Voraussetzung |
|---|---|---|---|
| Holzbretter | 10x Holz | 5x Brett | Werkbank, Holzbearbeitung Lv3 |
| Blockhütte | 40x Holz + 20x Stein + 10x Brett | Hütte | Bauen Lv5 |
| Bett | 8x Brett + 10x Palmenblatt | Bett | Unterkunft/Werkbank |
| Angelrute | 4x Äste + 2x Seil | Rute | Kordel Lv2, Fisch entdeckt |
| Gebratener Fisch | 2x Fisch | 2x gebraten | Lagerfeuer |
| Ackerbeet | 10x Brett + 5x Stein | Beet | optional später |
| Schmelzofen | 20x Holz + 15x Stein + 10x Brett | Ofen | Feuer Lv5, Bauen Lv4 |
| Eisenbarren | 3x Eisenerz + 5x Holz/Kohle | Barren | Schmelzofen |
| Eisenaxt | 1x Barren + 3x Brett | Axt | Metall Lv2 |
| Eisenspitzhacke | 1x Barren + 3x Brett | Hacke | Metall Lv2 |

---

## 17. Neue empfohlene Rezepte

### 17.1 Haltbarmachung

| Rezept | Inputs | Output | Voraussetzung |
|---|---|---|---|
| Trockengestell | 6x Äste + 2x Seil | Trockengestell | Bauen Lv2, Seil entdeckt |
| Getrocknetes Fleisch | rohes Fleisch + Trockengestell + Zeit | getrocknetes Fleisch | Trockengestell |
| Räucherstelle | Lagerfeuer + 4x Holz + 2x Seil + Palmblätter | Räucherstelle | Feuermachen Lv3 |
| Geräuchertes Fleisch | Fleisch + Rauch + Zeit | geräuchertes Fleisch | Räucherstelle |

### 17.2 Tierverarbeitung

| Rezept | Inputs | Output | Voraussetzung |
|---|---|---|---|
| Tier zerlegen | Tierkadaver + Messer | Fleisch + Haut/Knochen/Fett | Jagen Lv1 |
| Haut trocknen | Haut + Trockengestell | trockene Haut | Trockengestell |
| Lederstück grob | trockene Haut + Messer | Lederstück | Medizin/Bauen optional |
| Knochenhaken | Knochen + Messer | Angelhaken | Jagen Lv2 |
| Knochennadel | Knochen + Messer | Nadel | Medizin Lv2 |

### 17.3 Medizin

| Rezept | Inputs | Output | Voraussetzung |
|---|---|---|---|
| Verband | Fasern | Verband | Medizin Lv1 |
| Harzverschluss | Harz + Verband | Wundverschluss | Medizin Lv2 |
| Primitive Salbe | Tierfett + Kräuter | Salbe | Medizin Lv3 |
| Fiebermittel | Heilpflanze + gekochtes Wasser | Fiebermittel | Medizin Lv4 |
| Einfaches Gegengift | Heilpflanze + Schlangengift optional | Gegengift | Medizin Lv6 |

### 17.4 Feuer und Brennstoff

| Rezept | Inputs | Output | Voraussetzung |
|---|---|---|---|
| Holz trocknen | Holz + trockener Lagerplatz + Zeit | trockenes Holz | Lagerplatz |
| Holzkohle herstellen | trockenes Holz + kontrolliertes Feuer + Zeit | Holzkohle | Feuermachen Lv5 |
| Feuerstarter | trockene Fasern + Harz | Feuerstarter | Feuermachen Lv2 |

---

## 18. Tierverhalten

### 18.1 Krabbe

- erscheint häufig am Strand
- flieht langsam
- geringe Gefahr
- frühe Nahrung
- tagsüber/bei bestimmten Bedingungen häufiger

### 18.2 Schildkröte

- selten am Strand
- langsam
- viel Nahrung
- Panzer als wertvolle Ressource
- ethisch/spielerisch optional: nicht dauerhaft verfügbar

### 18.3 Wildschwein

- Grasland, Wald, dichter Wald
- flieht meist
- wird aggressiv bei Verletzung oder Nähe
- liefert viel Fleisch, Haut, Knochen, Fett
- gefährlich für schlecht ausgerüstete Spieler

### 18.4 Schlange später

- hohes Gras, Dschungel
- schwer sichtbar
- greift defensiv an
- Giftzustand
- wertvolle medizinische Progression durch Gegengift

### 18.5 Affe optional

- Dschungel
- kann Items stehlen
- schwer zu jagen
- erzeugt Störung statt reiner Kampfgefahr

---

## 19. Spawnregeln pro Biom

### 19.1 Grundstruktur

Biome sollten Datenobjekte besitzen:

```json
{
  "id": "beach",
  "name": "Strand",
  "resourceSpawns": [
    { "item": "pebble", "chance": 0.35, "min": 1, "max": 4 },
    { "item": "driftwood", "chance": 0.20, "min": 1, "max": 2 },
    { "item": "shell", "chance": 0.25, "min": 1, "max": 3 }
  ],
  "animalSpawns": [
    { "animal": "crab", "chance": 0.18 },
    { "animal": "turtle", "chance": 0.03 }
  ],
  "dangerModifiers": {
    "dehydration": 1.2,
    "snake": 0.0,
    "infection": 0.8
  }
}
```

### 19.2 Spawn-Balance

Ressourcen sollen nicht überall gleich vorkommen.

Wichtig:

- Strand = sicherer Start, aber langfristig begrenzt
- Grasland = Fasern/Kräuter, moderate Gefahr
- hoher Bewuchs = Medizin, aber Schlangenrisiko
- leichter Wald = guter Basisort
- dichter Wald = hochwertige Ressourcen, höheres Risiko
- Dschungel = sehr wertvoll, sehr gefährlich

---

## 20. Inventar-System

Mittelstufe Realismus.

### 20.1 Regeln

- Slots + Gewicht kombinieren
- kleine Ressourcen stapelbar
- große Ressourcen sperrig
- Werkzeuge belegen eigene Slots
- Überladung senkt Bewegung/Ausdauer

### 20.2 Beispielwerte

| Item | Gewicht | Stack |
|---|---:|---:|
| Ast | 0.2 | 20 |
| Stein | 0.5 | 15 |
| Baumstamm | 8.0 | 1 |
| Fleisch | 0.5 | 5 |
| Seil | 0.3 | 10 |
| Axt | 1.5 | 1 |
| Brett | 1.0 | 10 |

### 20.3 Container

| Container | Effekt |
|---|---|
| Kokosschale | Wasser/kleine Menge |
| Schildkrötenpanzer | Wasser/Materialbehälter |
| Lagerbox | Basislager |
| Regal optional | bessere Ordnung |
| Tasche optional | mobile Slots |

---

## 21. Balancing-Ziel für 10 Stunden Spielzeit

### Erste 30 Minuten

Spieler soll:

- Äste, Steine, Fasern sammeln
- erstes Feuer versuchen
- einfache Nahrung finden
- mit Regen/Durst/Hunger konfrontiert werden

### 1–2 Stunden

Spieler soll:

- Feuersteinmesser herstellen
- einfache Unterkunft/Palmendach bauen
- Regensammler bauen
- erste gekochte Nahrung herstellen

### 2–4 Stunden

Spieler soll:

- Steinaxt und Speer nutzen
- Holzunterkunft oder bessere Lagerstruktur beginnen
- Wildtiere ernsthaft als Ressource erkennen
- Krankheiten/Verletzungen erstmals erleben

### 4–7 Stunden

Spieler soll:

- Werkbank bauen
- Trockengestell/Räucherstelle entdecken
- Nahrung haltbar machen
- bessere Werkzeuge herstellen
- Dschungel/Wald-Expeditionen planen

### 7–10 Stunden

Spieler soll:

- stabile Basis besitzen, aber nicht völlig sicher sein
- bessere Unterkunft haben
- erste Metall-/Ofenlogik beginnen können, aber nicht zwingend abgeschlossen haben
- weiterhin Probleme mit Wetter, Krankheit, Nahrung und Werkzeugverschleiß haben

---

## 22. Technische Architektur für Claude Code / Codex

### 22.1 Ziel der Umsetzung

Die Systeme sollen datengetrieben umgesetzt werden. Keine Rezepte, Items, Tiere oder Krankheiten sollen hart im Code verstreut sein.

Alle Spielwerte liegen in JSON- oder TS/JS-Datenmodulen.

Empfohlene Dateien:

```txt
/src/data/items.json
/src/data/recipes.json
/src/data/skills.json
/src/data/knowledge.json
/src/data/biomes.json
/src/data/animals.json
/src/data/diseases.json
/src/data/buildings.json
/src/data/fuels.json
```

Wenn das Projekt nicht mit JSON arbeitet, können entsprechende TypeScript-Dateien verwendet werden:

```txt
/src/game/data/items.ts
/src/game/data/recipes.ts
```

### 22.2 Kernmodule

```txt
CraftingSystem
InventorySystem
SkillSystem
KnowledgeSystem
DiscoverySystem
FireSystem
WeatherSystem
DiseaseSystem
AnimalSystem
BuildingSystem
DecaySystem
BiomeSpawnSystem
```

### 22.3 Trennung von Logik und UI

Die UI darf keine Rezeptlogik enthalten.

UI fragt nur:

```txt
getVisibleRecipes(playerState)
canCraft(recipeId, playerState)
craft(recipeId, playerState)
```

Die Logik liegt vollständig in Systemmodulen.

---

## 23. Datenmodelle

### 23.1 Item

```ts
export type Item = {
  id: string;
  name: string;
  categories: string[];
  weight: number;
  stackSize: number;
  tags?: string[];
  durability?: number;
  quality?: "improvised" | "simple" | "sturdy" | "fine" | "masterwork";
  states?: string[];
  spoilageHours?: number;
  fuelValue?: number;
};
```

### 23.2 Recipe

```ts
export type Recipe = {
  id: string;
  name: string;
  inputs: { itemId: string; quantity: number }[];
  outputs: { itemId: string; quantity: number }[];
  baseCraftTime: number;
  requiredTools?: string[];
  requiredStations?: string[];
  requiredSkills?: Record<string, number>;
  requiredKnowledge?: string[];
  requiredDiscoveredItems?: string[];
  grantsSkillXp?: { skill: string; xp: number }[];
  grantsKnowledge?: string[];
  skillBasedSuccess?: {
    skill: string;
    baseChance: number;
    bonusPerLevel: number;
  };
  failure?: {
    consumeInputs: "all" | "partial" | "none";
    xpMultiplier: number;
    injuryChance?: number;
  };
};
```

### 23.3 PlayerState

```ts
export type PlayerState = {
  inventory: InventoryItem[];
  equippedLeft?: string;
  equippedRight?: string;
  skills: Record<string, { level: number; xp: number }>;
  knowledge: Record<string, boolean>;
  discoveredItems: Record<string, boolean>;
  statusEffects: string[];
  position: { x: number; y: number };
  nearbyStations: string[];
  shelterLevel?: number;
};
```

### 23.4 Animal

```ts
export type Animal = {
  id: string;
  name: string;
  biomes: string[];
  behavior: "passive" | "defensive" | "aggressive" | "skittish";
  health: number;
  speed: number;
  dangerLevel: number;
  drops: { itemId: string; min: number; max: number; chance: number }[];
};
```

### 23.5 Disease

```ts
export type Disease = {
  id: string;
  name: string;
  causes: string[];
  effects: {
    staminaModifier?: number;
    craftTimeModifier?: number;
    movementModifier?: number;
    hungerModifier?: number;
    thirstModifier?: number;
  };
  treatments: string[];
  progressionHours: number;
  severity: 1 | 2 | 3 | 4 | 5;
};
```

---

## 24. Zentrale Funktionen

### 24.1 Sichtbare Rezepte

```ts
function isRecipeVisible(recipe: Recipe, player: PlayerState): boolean {
  // 1. Prüfe entdeckte Materialien
  // 2. Prüfe Knowledge Flags
  // 3. Prüfe grobe Skillvoraussetzungen
  // 4. Verstecke Rezepte, die logisch noch nicht verstanden wurden
}
```

### 24.2 Craftbarkeit

```ts
function canCraft(recipe: Recipe, player: PlayerState): CraftCheckResult {
  // 1. Inputs vorhanden?
  // 2. Werkzeuge vorhanden?
  // 3. Stationen in Reichweite?
  // 4. Skilllevel ausreichend?
  // 5. Status blockiert? z.B. bewusstlos, stark verletzt
}
```

### 24.3 Crafting durchführen

```ts
function craft(recipe: Recipe, player: PlayerState): CraftResult {
  // 1. canCraft prüfen
  // 2. Erfolgswahrscheinlichkeit berechnen
  // 3. Inputs verbrauchen
  // 4. Outputs erzeugen
  // 5. Werkzeughaltbarkeit reduzieren
  // 6. XP vergeben
  // 7. Knowledge Flags vergeben
  // 8. Toast/Event zurückgeben
}
```

### 24.4 Knowledge aktualisieren

```ts
function updateKnowledgeFromEvent(event: GameEvent, player: PlayerState): void {
  // Beispiele:
  // item_discovered: Harz -> understands_resin_use evtl. später
  // crafted: flint_knife -> understands_sharp_edges
  // cooked: raw_meat -> understands_cooking_meat
  // status: food_poisoning -> understands_food_risk
}
```

---

## 25. Beispiel: Recipe-Daten

```json
{
  "id": "flint_knife",
  "name": "Feuersteinmesser",
  "inputs": [
    { "itemId": "sharp_stone", "quantity": 1 },
    { "itemId": "hardened_stick", "quantity": 1 },
    { "itemId": "fiber", "quantity": 3 }
  ],
  "outputs": [
    { "itemId": "flint_knife", "quantity": 1 }
  ],
  "baseCraftTime": 5,
  "requiredSkills": {
    "flint_knapping": 1
  },
  "requiredKnowledge": [
    "understands_sharp_edges"
  ],
  "requiredDiscoveredItems": [
    "sharp_stone",
    "fiber"
  ],
  "grantsSkillXp": [
    { "skill": "flint_knapping", "xp": 25 }
  ],
  "grantsKnowledge": [
    "understands_cutting_tools"
  ]
}
```

---

## 26. Beispiel: Item-Daten

```json
{
  "id": "dry_wood",
  "name": "Trockenes Holz",
  "categories": ["processed_resource", "fuel"],
  "weight": 0.8,
  "stackSize": 10,
  "tags": ["wood", "dry", "flammable"],
  "fuelValue": 80,
  "states": ["dry"]
}
```

---

## 27. Programmieranweisung für Claude Code / Codex

### Aufgabe

Baue das bestehende Crafting-System zu einem datengetriebenen Survival-Knowledge-System um.

### Wichtigste Vorgaben

1. Es soll keinen sichtbaren Technologiebaum geben.
2. Rezepte werden durch Skills, entdeckte Materialien, Werkzeuge, Stationen und Knowledge Flags sichtbar.
3. Bestehende Rezepte aus dem bisherigen Crafting-System bleiben erhalten.
4. Die alten Tiers werden nur noch intern als Progressionshilfe genutzt, nicht mehr als UI-Begriff.
5. Alle Items, Rezepte, Skills, Tiere, Krankheiten und Biome sollen datenbasiert definiert werden.
6. Keine Rezeptlogik direkt in UI-Komponenten schreiben.
7. Crafting muss über zentrale Funktionen laufen:
   - getVisibleRecipes
   - canCraft
   - getSuccessChance
   - getEffectiveCraftTime
   - craft
   - awardSkillXp
   - updateKnowledgeFromEvent
8. Das System muss später leicht erweiterbar sein.

### Entwicklungsreihenfolge

#### Phase 1 — Datenstruktur

- Lege Item-Datenmodell an.
- Lege Recipe-Datenmodell an.
- Lege Skill-Datenmodell an.
- Lege Knowledge-Datenmodell an.
- Migriere vorhandene Rezepte in neue Datenstruktur.

#### Phase 2 — Crafting-Core

- Implementiere Materialprüfung.
- Implementiere Werkzeugprüfung.
- Implementiere Stationsprüfung.
- Implementiere Skillprüfung.
- Implementiere Knowledge-Prüfung.
- Implementiere sichtbare Rezepte.

#### Phase 3 — Skill & XP

- Implementiere XP-Vergabe.
- Implementiere Levelkurve.
- Implementiere Diminishing Returns gegen Grinding.
- Implementiere Skillboni für Craftzeit und Erfolgschance.

#### Phase 4 — Discovery

- Items werden beim ersten Aufheben als entdeckt markiert.
- Neue Knowledge Flags werden durch Events vergeben.
- Rezepte erscheinen dynamisch, wenn Bedingungen erfüllt sind.

#### Phase 5 — Ressourcen und Biome

- Biome definieren.
- Ressourcen-Spawns pro Biom definieren.
- Tiere pro Biom definieren.
- Erste Spawnlogik implementieren.

#### Phase 6 — Zustände

- Itemzustände wie wet, dry, spoiled, cooked einbauen.
- Verderb für Nahrung einbauen.
- Brennstoffwerte für Feuer einbauen.

#### Phase 7 — Krankheiten und Verletzungen

- StatusEffects implementieren.
- Krankheiten aus Nahrung/Wetter/Tieren ableiten.
- Medizinitems mit Gegenwirkung einbauen.

#### Phase 8 — UI-Anbindung

- Crafting-Menü zeigt nur sichtbare Rezepte.
- Nicht erfüllte Anforderungen werden verständlich angezeigt.
- Keine Debug-Flags im normalen UI anzeigen.

### Technische Qualität

- Code modular halten.
- Keine riesigen Dateien.
- Daten und Logik trennen.
- Jede Systemfunktion einzeln testbar machen.
- Typen/Interfaces verwenden, falls TypeScript genutzt wird.
- Bestehende Spiellogik nicht unnötig zerstören.
- Erst Migration, dann Erweiterung.

---

## 28. Definition of Done

Das System gilt als erfolgreich umgesetzt, wenn:

- vorhandene Rezepte weiterhin funktionieren
- Rezepte nicht mehr simpel über sichtbare Tiers erscheinen
- neue Rezepte durch Skill + Discovery + Knowledge sichtbar werden
- Items eigene Kategorien, Gewichte und Zustände besitzen
- Crafting zentral über Systemfunktionen läuft
- Spieler durch Sammeln und Handeln Skills verbessert
- Wiederholungsgrinding weniger XP gibt
- Ressourcen pro Biom unterschiedlich verfügbar sind
- Tiere sinnvolle Ressourcen liefern
- Nahrung verderben kann
- Krankheiten/Verletzungen an Items und Umwelt gekoppelt werden können

---

## 29. Kurzfazit

Das Spiel soll sich nicht wie ein Aufbau- oder Forschungsmenü anfühlen.

Es soll sich so anfühlen:

> Ich bin allein im Dschungel. Ich habe keine Technologie erforscht. Ich habe gelernt, nicht zu sterben.

