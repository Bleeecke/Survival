# Skill & Knowledge System — Spieldesign-Dokument

**Projekt:** Survival Game  
**Version:** 2.0 (Eingebungs-Journal-System)  
**Stand:** 2026-05-30  
**Zweck:** Vollständige Implementierungsgrundlage für das überarbeitete Skill- und Knowledge-System

---

## Inhaltsverzeichnis

1. [Kernprinzipien](#1-kernprinzipien)
2. [Das Eingebungs-Journal](#2-das-eingebungs-journal)
3. [XP-Formel und Level-Schwellen](#3-xp-formel-und-level-schwellen)
4. [Knowledge Flags — Übersicht und Unlock-Verteilung](#4-knowledge-flags--übersicht-und-unlock-verteilung)
5. [Skill-Tech-Bäume (alle 8 Skills, Level 1–10)](#5-skill-tech-bäume-alle-8-skills-level-110)
   - [5.1 Überleben (survival)](#51-überleben-survival)
   - [5.2 Handwerk (crafting)](#52-handwerk-crafting)
   - [5.3 Bauen (building)](#53-bauen-building)
   - [5.4 Naturkunde (naturelore)](#54-naturkunde-naturelore)
   - [5.5 Jagen (hunting)](#55-jagen-hunting)
   - [5.6 Kochen (cooking)](#56-kochen-cooking)
   - [5.7 Medizin (medicine)](#57-medizin-medicine)
   - [5.8 Körperbeherrschung (body)](#58-körperbeherrschung-body)
6. [XP-Quellen — vollständige Tabellen](#6-xp-quellen--vollständige-tabellen)
7. [Material-Pickup Toasts](#7-material-pickup-toasts)
8. [Progression-Beispiel: Die ersten 30 Minuten](#8-progression-beispiel-die-ersten-30-minuten)
9. [Implementierungshinweise](#9-implementierungshinweise)
10. [Abweichungen vom alten Grübel-System](#10-abweichungen-vom-alten-grübel-system)

---

## 1. Kernprinzipien

### 1.1 Crafting und Bauen schlägt NIE fehl

**Designentscheidung:** Jede Crafting- oder Bau-Aktion gelingt immer — kein Fehlschlag, kein Materialverlust durch Scheitern.

**Begründung:**
- Fehlschläge fühlen sich wie Bestrafung an, nicht wie Lernen
- Der Spieler soll durch *tun* lernen, nicht durch Scheitern frustriert werden
- Skill-Progression ist der Mechanismus für Verbesserung, nicht RNG
- Bestehende `skillBasedSuccess`-Felder in recipes.json werden entfernt oder ignoriert

**Ausnahme:** Umgebungsrisiken (Sturm löscht Feuer, Regen verdirbt ungeschützte Nahrung) bleiben erhalten — das sind keine Crafting-Fehlschläge, sondern Weltmechanik.

### 1.2 Jede Handlung gibt Skill-XP

Sammeln, Craften, Bauen, Kochen, Heilen und Jagen — alles gibt XP.  
Keine Aktion ist "umsonst". Der Spieler wird immer besser, egal was er tut.

### 1.3 Skill Level-Ups schalten Eingebungen frei

Bei jedem Level-Up erhält der Spieler eine neue Eingebung im Journal.  
Die Eingebung ist ein narrativer Text, der erklärt, was der Spieler jetzt versteht.  
Einmal angeklickt → Knowledge Flag dauerhaft aktiv → neue Rezepte und Baupläne sichtbar.

### 1.4 Material-Pickups geben Sofort-Toasts

Wenn ein Spieler ein Material aufhebt, erscheint kurz ein atmosphärischer Toast (1 Satz).  
Dieser ist immer positiv-neugierig: "Das könnte nützlich sein." — niemals wertend.  
Der Toast ersetzt die alten `materialGrants` im Knowledge-System nicht — er ist rein narrativ.

### 1.5 Das Journal ersetzt das Schlaf-Grübel-System

Das alte System (Schlafen + Grübeln + Material-Trigger = Idee) wird abgelöst.  
Stattdessen: Skill-XP → Level-Up → Journal-Eingebung → einmal lesen → freigeschaltet.  
Kein Schlaf-Gate, kein Focus-Menü, keine zweistufige Trigger-Logik.

---

## 2. Das Eingebungs-Journal

### 2.1 UI-Konzept

```
HUD-Ecke (oben rechts oder links):
  [📖] — Buch-Icon, jederzeit klickbar
       — Roter Punkt wenn ungelesene Eingebungen vorhanden
       — Zahl im roten Punkt: Anzahl ungelesen

Journal-Panel (öffnet sich über das Spiel):
  ┌─────────────────────────────────────────────────┐
  │  📖 Eingebungs-Journal                    [X]  │
  ├─────────────────────────────────────────────────┤
  │  🔴 NEU  ── 3 neue Eingebungen ──               │
  │                                                 │
  │  🔴 [Feuerstein als Klinge]    Handwerk L2    │
  │     Heute beim Schlagen fiel mir auf, dass...   │
  │     [Eingebung annehmen →]                      │
  │                                                 │
  │  🔴 [Fasern verflechten]       Handwerk L3    │
  │     Die Lianen zwischen meinen Fingern...       │
  │     [Eingebung annehmen →]                      │
  │                                                 │
  │  ── Bereits freigeschaltet ──                   │
  │                                                 │
  │  ✅ [Ablagelogik]              Start           │
  │  ✅ [Einfaches Lager]          Start           │
  └─────────────────────────────────────────────────┘
```

### 2.2 Interaction Flow

```
Spieler sammelt / craftet / baut
        ↓
Skill erhält XP
        ↓
Level-Up erreicht?
   Nein → weiter spielen
   Ja  → Journal-Eingebung wird erstellt (noch nicht freigeschaltet)
        → Roter Punkt erscheint auf Journal-Icon
        → Optional: kleiner Toast "Neue Eingebung im Journal! 📖"
              ↓
Spieler öffnet Journal
        ↓
Eingebung lesen (Text erscheint, Atmosphäre)
        ↓
Spieler klickt [Eingebung annehmen →]
        ↓
Knowledge Flag wird auf true gesetzt
        ↓
Neue Rezepte/Baupläne erscheinen in der UI
        ↓
Eingebung wandert in "Bereits freigeschaltet"-Archiv
```

### 2.3 Regeln für Journal-Texte

- **Perspektive:** Ich-Perspektive, innerer Monolog
- **Länge:** 3–4 Sätze
- **Ton:** Nachdenklich, neugierig, leicht erschöpft — kein Triumphieren
- **Sprache:** Deutsch, einfach, keine Fachbegriffe
- **Keine** Gamification-Sprache ("Du hast entsperrt!", "Achievement!")
- Bezieht sich auf konkrete Erfahrungen ("Heute beim Hacken...", "Nach dem Regen...")

### 2.4 Technische Datenstruktur

```typescript
interface JournalEntry {
  id: string;                    // z.B. "journal_crafting_l2"
  skillId: SkillId;              // Welcher Skill hat es getriggert
  skillLevel: number;            // Bei welchem Level
  grantsKnowledge: KnowledgeFlag; // Was wird freigeschaltet
  title: string;                 // Kurztitel (z.B. "Feuerstein als Klinge")
  text: string;                  // Erzählerischer Text (3-4 Sätze)
  unlockedAt?: number;           // Timestamp (undefined = noch nicht gelesen)
}

interface JournalState {
  entries: JournalEntry[];
  hasUnread: boolean;
}
```

---

## 3. XP-Formel und Level-Schwellen

### 3.1 Aktuelle Formel (aus skills.ts)

```
XP für Level-Up = level * 20
```

| Level | XP benötigt | Kumulativ |
|-------|-------------|-----------|
| 1 → 2 | 20 XP       | 20 XP     |
| 2 → 3 | 40 XP       | 60 XP     |
| 3 → 4 | 60 XP       | 120 XP    |
| 4 → 5 | 80 XP       | 200 XP    |
| 5 → 6 | 100 XP      | 300 XP    |
| 6 → 7 | 120 XP      | 420 XP    |
| 7 → 8 | 140 XP      | 560 XP    |
| 8 → 9 | 160 XP      | 720 XP    |
| 9 → 10| 180 XP      | 900 XP    |

**Einschätzung:** L1→L2 (20 XP) ist sehr schnell. Mit 4–5 Aktionen à 5 XP ist der Spieler bereits auf L2.  
Das ist gewollt — frühe Levels gehen schnell, später wird es gemächlicher.

### 3.2 XP-Bandbreite pro Aktion

| Kategorie         | XP-Bereich | Beispiel                          |
|-------------------|------------|-----------------------------------|
| Einfaches Sammeln | 3–6 XP     | Kiesel aufheben: 3 XP             |
| Crafting Basis    | 5–10 XP    | Palmenblatt zerreißen: 5 XP       |
| Crafting Mittel   | 10–20 XP   | Seil flechten: 10 XP              |
| Crafting Komplex  | 20–30 XP   | Feuersteinmesser: 25 XP           |
| Kochen einfach    | 10 XP      | Essen kochen: 10 XP               |
| Kochen komplex    | 15 XP      | Fleisch räuchern: 15 XP           |
| Medizin           | 8–20 XP    | Verband anlegen: 8 XP             |
| Jagen (Kill)      | 10–20 XP   | Wildschwein erlegen: 18 XP        |
| Bauen einfach     | 5–10 XP    | Ablageplatz bauen: 5 XP           |
| Bauen komplex     | 20–40 XP   | Holzunterkunft bauen: 35 XP       |

---

## 4. Knowledge Flags — Übersicht und Unlock-Verteilung

### 4.1 Alle 16 Flags mit primärem Unlock-Pfad

| Knowledge Flag          | Label               | Primärer Unlock            | Alternativer Unlock       |
|-------------------------|---------------------|----------------------------|---------------------------|
| `knows_basic_rest`      | Einfaches Lager     | **Start** (immer bekannt)  | —                         |
| `knows_basic_storage`   | Ablagelogik         | **Start** (immer bekannt)  | —                         |
| `knows_sharp_edges`     | Klingen formen      | **Handwerk L2**            | Flint aufheben (Material) |
| `knows_binding`         | Fasern binden       | **Handwerk L3**            | Fiber aufheben (Material) |
| `knows_tool_binding`    | Werkzeug binden     | **Handwerk L4**            | Flint_knife craften       |
| `knows_hardened_wood`   | Holz härten         | **Handwerk L5**            | harden_stick craften      |
| `knows_metal`           | Metallverarbeitung  | **Handwerk L7**            | Iron_ore aufheben         |
| `knows_basic_fire`      | Feuerstelle möglich | **Überleben L2**           | Pebbles aufheben          |
| `knows_rain_collection` | Regenwasser sammeln | **Überleben L3**           | Regen + Materialien       |
| `knows_fire`            | Feuer beherrschen   | **Überleben L4**           | Campfire bauen            |
| `knows_preservation`    | Konservierung       | **Kochen L4**              | Wasser abkochen (Idee)    |
| `knows_basic_shelter`   | Dach bauen          | **Bauen L2**               | Regen + Materialien       |
| `knows_construction`    | Konstruktion        | **Bauen L4**               | palm_shelter bauen        |
| `knows_medicine`        | Heilkunde           | **Naturkunde L2**          | Herbs aufheben (Material) |
| `knows_cooking`         | Kochen              | **Kochen L2**              | cooked_food craften       |
| `knows_basic_weapon`    | Primitive Waffe     | **Jagen L2**               | stone_spear craften       |

### 4.2 Designentscheidungen zur Unlock-Verteilung

**Keine Duplikate:** Jedes Flag hat einen primären Skill-Unlock. Material-Grants bleiben als früher Sofort-Trigger erhalten (z.B. Flint aufheben → `knows_sharp_edges` sofort), aber das Journal-System ist der reguläre Pfad.

**Konflikt-Auflösung:**
- `knows_preservation` war in der Aufgabe doppelt (Überleben L6 UND Naturkunde L5 UND Kochen L3). Entscheidung: **Kochen L4** als primärer Pfad, weil der Spieler aktiv kochen muss, um Konservierung zu verstehen. Naturkunde und Überleben können dasselbe Flag als Alternative freischalten wenn der Spieler früher auf diese Skills fokussiert.
- `knows_medicine` war zwischen Naturkunde L2 und Medizin L2 unklar. Entscheidung: **Naturkunde L2** primär (man erkennt Heilpflanzen durch Naturbeobachtung), Medizin L3 als Vertiefungs-Eingebung die denselben Flag bestätigt/vertieft (oder einen zukünftigen Flag "knows_advanced_medicine" setzt).
- `knows_binding` war zwischen Handwerk L3 und Medizin L3 aufgeteilt. Entscheidung: **Handwerk L3** ist primär. Medizin L3 bekommt einen eigenen thematisch passenden Inhalt.

---

## 5. Skill-Tech-Bäume (alle 8 Skills, Level 1–10)

*Format pro Level:*
- **Knowledge Unlock:** Flag-Name (oder "Kein Unlock" / "Passiver Bonus")
- **Journal-Text:** Erzählerischer Ich-Text
- **XP-Quellen:** Was konkret XP für diesen Skill gibt

---

### 5.1 Überleben (survival)

*Beschreibung: Feuer, Wasser, Wetter, Schlaf, Grundroutinen*

---

#### Überleben L1 (Startlevel)

**Knowledge Unlock:** Kein Unlock (Startlevel)  
**Passiver Bonus:** Spieler kann basic survival-Aktionen ausführen  
**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Kiesel (pebbles) aufheben | 3 XP | Sammeln |
| Schlafplatz bauen | 5 XP | Erstes Bauobjekt |
| Ablageplatz anlegen | 3 XP | Organisieren |
| Regen abwettern (ohne Schutz) | 2 XP | Passiv bei Regen ohne Unterstand |
| Nacht überleben (erste) | 5 XP | Einmaliger Bonus |

---

#### Überleben L2

**Knowledge Unlock:** `knows_basic_fire`  
**Journal-Titel:** "Funken aus Stein"  
**Journal-Text:**
> Heute habe ich zwei Kiesel aneinandergeschlagen und einen Funken gesehen. Nur kurz, aber er war da. Ich glaube, mit genug trockenem Material darunter könnte ich das hinbekommen. Äste, ein Steinring — das sollte reichen, um ein Feuer zu entfachen. Ich sollte es ausprobieren.

**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Kiesel (pebbles) aufheben | 3 XP | Sammeln |
| Schlafplatz bauen | 5 XP | Bau |
| Nacht überleben | 3 XP | Wiederholend, aber reduziert |
| Regen ohne Unterstand überstehen | 4 XP | Zähigkeit lernen |
| Treibholz zu Ästen zerbrechen | 4 XP | Verarbeitung |

---

#### Überleben L3

**Knowledge Unlock:** `knows_rain_collection`  
**Journal-Titel:** "Was der Regen hinterlässt"  
**Journal-Text:**
> Es hat die ganze Nacht geregnet. Überall Pfützen — und ich habe gemerkt, dass die großen Palmblätter das Wasser wie Rinnen ableiten. Eine Kokosschale darunter hätte viel aufgefangen. Das nächste Mal werde ich das ausprobieren, bevor der Regen kommt, nicht hinterher.

**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Im Regen bleiben ohne Unterstand | 4 XP | Erfahrung durch Unangenehmes |
| Einfachen Regensammler bauen | 12 XP | Erste Wasserversorgung |
| Schlafplatz in der Nähe von Feuer schlafen | 6 XP | Verbesserte Erholung |
| Kiesel aufheben | 3 XP | Sammeln |
| Nacht am Feuer überleben | 5 XP | Mit Feuer ist die Nacht besser |

---

#### Überleben L4

**Knowledge Unlock:** `knows_fire`  
**Journal-Titel:** "Feuer beherrschen"  
**Journal-Text:**
> Das Lagerfeuer brennt jetzt zuverlässig. Ich habe gelernt, wie viel Holz es braucht, wann ich nachlegen muss, wie ich es vor Wind schütze. Es ist kein Zufall mehr — ich verstehe, was Feuer will. Mit einem richtigen Steinring hält es die ganze Nacht. Das verändert alles.

**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Lagerfeuer bauen | 15 XP | Wichtiger Meilenstein |
| Lagerfeuer anfeuern (nach Erlöschen) | 5 XP | Wiederholend |
| Granit-Feuerstelle bauen | 20 XP | Verbessertes Feuer |
| Die Nacht am Feuer überstehen (Regen) | 8 XP | Herausforderung |
| Treibholz zerbrechen | 4 XP | Brennholz vorbereiten |
| Ast in Feuer härten | 10 XP | Aktive Feuernutzung |

---

#### Überleben L5

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Feuer bleibt 20% länger aktiv; Schlafqualität +10%  
**Journal-Titel:** "Rhythmus finden"  
**Journal-Text:**
> Ich beginne, einen Rhythmus zu spüren. Wann es kalt wird, wann es regnet, wann die Tiere aktiv sind. Mein Körper stellt sich ein. Ich schlafe besser, wache wacher auf, friere weniger. Das Überleben ist weniger Kampf — mehr Tanz mit dem, was dieser Ort bietet.

**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Mehrere Nächte hintereinander überleben | 5 XP/Nacht | Streak-Bonus |
| Sturm überleben mit Unterstand | 10 XP | Vorbereitung zahlt sich aus |
| Feuer im Regen am Leben erhalten | 12 XP | Schwierige Situation |
| Schlafplatz/Bett nutzen | 3 XP | Routinepflege |

---

#### Überleben L6

**Knowledge Unlock:** Kein Knowledge-Unlock (Preservation kommt über Kochen L4)  
**Passiver Bonus:** Körpertemperatur-Regulierung verbessert; Wetterwarnung 30 Sek. früher  
**Journal-Titel:** "Das Wetter lesen"  
**Journal-Text:**
> Ich spüre Regen jetzt bevor er kommt. Die Art, wie der Wind dreht, die Farbe des Himmels am Abend — das sind keine Zufälle. Mein Körper lernt diese Zeichen. Ich habe genug Zeit, das Feuer zu schützen und Vorräte unterzustellen, bevor die ersten Tropfen fallen.

**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Sturm korrekt antizipieren (Feuer geschützt) | 12 XP | Vorausplanung |
| 7 Nächte ohne kritischen Hunger überleben | 15 XP | Einmaliger Meilenstein |
| Räucherstelle bauen | 20 XP | Langfristige Planung |

---

#### Überleben L7

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Schlafbedarf -10%; Hunger/Durst sinkt langsamer  
**Journal-Titel:** "Sparsamkeit"  
**Journal-Text:**
> Früher habe ich viel verschwendet — zu viel Holz, zu viel Nahrung auf einmal, zu wenig Schlaf. Jetzt plane ich weiter voraus. Zwei Schritte statt fünf. Ein kleines Feuer reicht für die Nacht. Mein Körper kommt mit weniger aus, weil er weiß, wie er das Wenige nutzt.

**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| 14 Tage Spielzeit überleben | 20 XP | Einmalig |
| Vorräte für 3+ Tage lagern | 8 XP | Planung |
| Ohne Feuer eine Nacht überstehen | 15 XP | Körperliche Abhärtung |

---

#### Überleben L8

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Krankheitsresistenz +20%; Gifte wirken langsamer  
**Journal-Titel:** "Widerstandskraft"  
**Journal-Text:**
> Mein Körper ist nicht mehr derselbe wie am ersten Tag. Die Hitze macht mir weniger aus. Regen ist unangenehm, aber kein Todesurteil mehr. Selbst wenn ich einmal schlecht esse oder eine Nacht friere — ich erhole mich schneller. Der Körper lernt, was er kann.

**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Krankheit überleben | 20 XP | Einmalig pro Krankheit |
| Gift überleben | 15 XP | Einmalig |
| 21 Tage überleben | 25 XP | Einmalig |

---

#### Überleben L9

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Alle negativen Umwelteffekte -15%  
**Journal-Titel:** "Dieses Land gehört mir"  
**Journal-Text:**
> Ich erinnere mich kaum noch an die Angst der ersten Tage. Die Dunkelheit ist jetzt Ruhe. Der Regen ist Wasser. Das Feuer ist ein alter Freund. Ich kenne jeden Weg, jeden Windschatten, jede Quelle. Ich bin nicht mehr Gast hier — ich gehöre dazu.

**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| 30 Tage überleben | 30 XP | Einmalig |
| Alle Grundbedürfnisse gleichzeitig erfüllt halten | 5 XP/Tag | Dauerhafter Bonus |

---

#### Überleben L10

**Knowledge Unlock:** Kein Knowledge-Unlock (Master-Level)  
**Passiver Bonus:** Alle Survival-Aktionen 10% schneller; Extremwetter Immunität +50%  
**Journal-Titel:** "Meisterschaft"  
**Journal-Text:**
> Es gibt keine Überraschungen mehr — nur Aufgaben. Ich erledige sie, ohne nachzudenken, schnell und ruhig. Feuer, Wasser, Schlaf, Nahrung: ein Kreislauf, den ich im Schlaf beherrsche. Manche nennen das Glück. Ich nenne es Erfahrung.

---

### 5.2 Handwerk (crafting)

*Beschreibung: Werkzeuge, Seile, Stein, einfache Verarbeitung*

---

#### Handwerk L1 (Startlevel)

**Knowledge Unlock:** Kein Unlock (Startlevel)  
**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Feuerstein (flint) aufheben | 4 XP | Sammeln |
| Kiesel (pebbles) aufheben | 3 XP | Sammeln |
| Holz (wood) aufheben | 5 XP | Sammeln |
| Äste (sticks) aufheben | 3 XP | Sammeln |
| Fasern (fiber) aufheben | 4 XP | Sammeln |
| Lianen (vine) aufheben | 4 XP | Sammeln |
| Treibholz zerbrechen | 4 XP | Einfache Verarbeitung |
| Palmenblätter zerreißen | 5 XP | Einfache Verarbeitung |

---

#### Handwerk L2

**Knowledge Unlock:** `knows_sharp_edges`  
**Journal-Titel:** "Klingen aus Stein"  
**Journal-Text:**
> Heute habe ich den Feuerstein gegen einen Kiesel geschlagen und etwas Unerwartetes passiert: eine Seite ist abgesplittert, messerscharf. Ich habe mir fast den Daumen aufgeschnitten. Aber ich habe begriffen — wenn ich das kontrolliert mache, kann ich eine Klinge formen. Einfach, aber brauchbar.

**XP-Quellen:** (zusätzlich zu L1-Quellen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Feuerstein absplittern (knap_flint) | 15 XP | Neu verfügbar durch Unlock |
| Muschelklinge craften | 8 XP | Erstes Werkzeug |
| Eisenerz (iron_ore) aufheben | 6 XP | Sammeln |

---

#### Handwerk L3

**Knowledge Unlock:** `knows_binding`  
**Journal-Titel:** "Fasern als Faden"  
**Journal-Text:**
> Ich habe Palmfasern zwischen den Fingern gerollt und gemerkt: wenn man sie dreht, werden sie fester. Verflochten halten sie erstaunlich viel. Zwei Stücke zusammengebunden, dann noch eins — ich könnte damit Steine an Äste binden, Blätter zusammenhalten, Gegenstände tragen. Fasern sind mehr als ich dachte.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Seil flechten (rope_fiber) | 10 XP | Neu: Binding-Rezept |
| Flint_knife craften | 25 XP | Erste richtige Klinge |
| Muschelklinge craften | 8 XP | Weiterhin verfügbar |

---

#### Handwerk L4

**Knowledge Unlock:** `knows_tool_binding`  
**Journal-Titel:** "Klinge und Griff"  
**Journal-Text:**
> Als ich die Feuersteinklinge mit Fasern an den Ast gewickelt habe, hat sich etwas verändert — ich spürte, wie die Kraft meiner Hand durch den Griff in die Klinge fließt. Das ist kein zusammengestückeltes Werkzeug mehr. Das ist ein Messer. Ich verstehe jetzt, wie Werkzeuge funktionieren: Klinge und Griff zusammen sind mehr als ihre Teile.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Steinaxt craften (stone_axe) | 20 XP | Wichtiges Werkzeug |
| Steinspitzhacke craften | 20 XP | Bergbau-Werkzeug |
| Feuersteinmesser craften | 25 XP | Gutes Messer |

---

#### Handwerk L5

**Knowledge Unlock:** `knows_hardened_wood`  
**Journal-Titel:** "Feuer macht Holz zu Eisen"  
**Journal-Text:**
> Ich habe einen feuchten Ast langsam über der Glut gedreht — nicht verbrennen lassen, nur erhitzen. Das Wasser verdampfte, die Fasern zogen sich zusammen. Danach war der Ast anders: harder, schwerer, fast wie Knochen. Das verändert, was ich bauen kann. Ein gehärtetes Stück Holz ist nicht mehr nur ein Stock.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Ast im Feuer härten | 10 XP | Neue Verarbeitung |
| Steinspeer craften | 15 XP | Benötigt hardened_stick |
| Verbesserte Axt craften | 20 XP | Tier-2-Werkzeug |
| Verbesserte Spitzhacke craften | 20 XP | Tier-2-Werkzeug |

---

#### Handwerk L6

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Crafting-Zeit aller Rezepte -15%  
**Journal-Titel:** "Hände wissen es"  
**Journal-Text:**
> Ich bemerke, dass meine Hände vor mir wissen, was zu tun ist. Ich fange an zu craften, und die Bewegungen kommen von selbst — richtige Spannung beim Weben, der richtige Winkel beim Absplittern. Handwerk ist kein Nachdenken mehr. Es ist Körperwissen.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Obsidianklinge craften | 30 XP | Hochwertige Klinge |
| Holzbretter craften (plank) | 15 XP | Benötigt Werkbank |
| Alle früheren Craftings | wie definiert | Weiterhin aktiv |

---

#### Handwerk L7

**Knowledge Unlock:** `knows_metal`  
**Journal-Titel:** "Das rostbraune Erz"  
**Journal-Text:**
> Ich habe diesen Stein schon oft gesehen — schwer, rostbraun, irgendwie anders als normaler Stein. Heute habe ich ihn ins Feuer gehalten und gesehen, wie an der Oberfläche etwas glänzte. Metall. Ich weiß nicht wie, aber ich weiß, dass man daraus etwas machen kann. Etwas viel Härteres als alles, was ich bisher hatte.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Eisenbarren schmelzen (iron_bar) | 25 XP | Erster Metallprozess |
| Eisenaxt craften | 20 XP | Endgame-Werkzeug |
| Eisenspitzhacke craften | 20 XP | Endgame-Werkzeug |

---

#### Handwerk L8

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Crafting-Zeit -25% kumulativ; Ressourcenverbrauch -10%  
**Journal-Titel:** "Weniger Material, mehr Ergebnis"  
**Journal-Text:**
> Ich verschwende nichts mehr. Früher habe ich beim Absplittern viel weggeworfen — jetzt treffe ich gezielter. Die Fasern reichen länger, weil ich sie straffer webe. Werkzeuge die früher Stunden brauchten, entstehen jetzt in Minuten. Erfahrung ist das effizienteste Werkzeug.

---

#### Handwerk L9

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Alle gecrafteten Items haben +10% Haltbarkeit  
**Journal-Titel:** "Qualität spüren"  
**Journal-Text:**
> Ich erkenne ein gut gemachtes Werkzeug jetzt beim ersten Griff. Das Gleichgewicht, die Schärfe, die Verbindung von Klinge und Griff — ich spüre sofort wenn etwas falsch ist, und korrigiere es. Meine Werkzeuge halten länger als die von jemandem, der einfach die Materialien zusammenwirft.

---

#### Handwerk L10

**Knowledge Unlock:** Kein Knowledge-Unlock (Master-Level)  
**Passiver Bonus:** Alle Crafting-Boni maximiert; seltene Materialien geben Bonus-Output  
**Journal-Titel:** "Meister des Handwerks"  
**Journal-Text:**
> Es gibt keine Materialien mehr, die mir Respekt einflößen. Feuerstein, Holz, Metall — alles ist nur Material, das auf seine Form wartet. Ich sehe in jedem Rohstoff das fertige Werkzeug. Das ist Handwerk auf höchstem Niveau.

---

### 5.3 Bauen (building)

*Beschreibung: Unterstände, Lager, Werkbank, Palisaden*

---

#### Bauen L1 (Startlevel)

**Knowledge Unlock:** Kein Unlock (Startlevel)  
**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Stein (stone) aufheben | 3 XP | Sammeln |
| Granit (granite) aufheben | 4 XP | Sammeln |
| Ablageplatz bauen | 5 XP | Einfachstes Bau |
| Schlafplatz bauen | 8 XP | Basis-Komfort |

---

#### Bauen L2

**Knowledge Unlock:** `knows_basic_shelter`  
**Journal-Titel:** "Blätter als Dach"  
**Journal-Text:**
> Es hat heute Nacht geregnet und ich bin durchnässt aufgewacht. Dabei habe ich auf die Palmen geblickt und etwas gesehen, das ich vorher übersehen hatte: die Blätter sind wasserabweisend, fast wie Dachziegel, wenn man sie übereinanderlegt. Äste als Gestell, Blätter als Dach, Lianen als Verbindung — ich könnte mich trocken halten.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Palmendach bauen (palm_shelter) | 25 XP | Erster echter Schutz |
| Granit-Feuerstelle bauen | 15 XP | Verbessertes Feuer |
| Fackelhalter bauen | 10 XP | Beleuchtung |

---

#### Bauen L3

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Bauzeit aller Strukturen -10%  
**Journal-Titel:** "Grundriss legen"  
**Journal-Text:**
> Ich habe angefangen, vor dem Bauen zu planen — zu überlegen, wo die Wände stehen sollen, wo das Feuer hin kommt, welche Seite windgeschützt ist. Ein paar Äste auf dem Boden als Markierung, dann erst anfangen. Das Ergebnis ist stabiler, hält besser, sieht gerader aus. Planen ist auch eine Form von Bauen.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Einfachen Regensammler bauen | 12 XP | Wasser-Infrastruktur |
| Schlinge bauen (snare_trap) | 10 XP | Jagd-Infrastruktur |
| Kräutergestell bauen | 12 XP | Medizin-Infrastruktur |

---

#### Bauen L4

**Knowledge Unlock:** `knows_construction`  
**Journal-Titel:** "Stabile Verbindungen"  
**Journal-Text:**
> Ich habe meinen ersten Unterstand im Sturm beobachtet und gesehen, was hält und was nicht. Die Verbindungen — da ist es. Fest verschnürt, Kreuzverbindungen, Gewicht oben als Anker. Ein Gebäude ist so stark wie seine schwächste Verbindung. Ich verstehe jetzt, wie man etwas baut, das wirklich hält.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Holzunterkunft bauen | 35 XP | Großes Bauprojekt |
| Werkbank bauen | 25 XP | Wichtige Infrastruktur |
| Lagerbox bauen | 15 XP | Lagerung |
| Trockengestell bauen | 12 XP | Nahrungsinfrastruktur |
| Räucherstelle bauen | 20 XP | Fortgeschrittene Infrastruktur |

---

#### Bauen L5

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Alle gebauten Strukturen haben +20% Stabilität gegen Sturm  
**Journal-Titel:** "Gegen den Sturm bauen"  
**Journal-Text:**
> Nach dem zweiten Sturm verstehe ich: man baut nicht für gutes Wetter, man baut für das schlechteste. Tiefere Grundpfähle, stärkere Verbindungen, flacheres Dach damit der Wind weniger Angriffsfläche hat. Ein Gebäude das einen Sturm übersteht, ist ein gutes Gebäude.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Holzbretter craften für Bau | 10 XP | Bauvorbereitung |
| Blockhütte bauen | 50 XP | Großes Endgame-Projekt |
| Bett bauen | 20 XP | Komfort |
| Ackerbeet bauen | 20 XP | Nahrungsproduktion |

---

#### Bauen L6

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Lagerbox-Kapazität +5 Slots; Strukturen kosten 10% weniger Material  
**Journal-Titel:** "Lager organisieren"  
**Journal-Text:**
> Ich habe eine Stunde damit verbracht, meinen Lagerplatz neu zu ordnen — und danach war alles einfacher. Nicht nur optisch: Ich finde Dinge schneller, nehme mit einer Bewegung was ich brauche, verliere nichts mehr zwischen den Stapeln. Ein gut organisierter Lagerplatz ist ein Werkzeug.

---

#### Bauen L7

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Alle Bauprojekte 20% schneller  
**Journal-Titel:** "Effizienter werden"  
**Journal-Text:**
> Ich merke, dass ich beim Bauen weniger nachdenke und mehr mache. Die Handgriffe sitzen, ich verschneide Äste nicht mehr falsch, die Verbindungen halten beim ersten Versuch. Bauen ist schneller geworden, weil mein Körper weiß was er tut.

---

#### Bauen L8

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Schmelzofen baubar (benötigt knows_metal + knows_fire zusätzlich)  
**Journal-Titel:** "Schmelze und Stein"  
**Journal-Text:**
> Ich habe genug über Feuer gelernt, um zu verstehen: heißer als ein normales Lagerfeuer ist möglich. Ein Ofen aus Stein, luftzufuhr unten, Brennstoff oben — die Hitze wird extrem. Das Eisenerz könnte schmelzen. Ich müsste es nur bauen.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Schmelzofen bauen | 45 XP | Großes Endgame-Projekt |

---

#### Bauen L9

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Strukturen benötigen 20% weniger Material  
**Journal-Titel:** "Weniger ist mehr"  
**Journal-Text:**
> Ich brauche nicht mehr so viele Materialien wie früher. Ich weiß wo ich Kraft einsetzen muss und wo Leichtigkeit ausreicht. Ein dünnerer Querbalken an der richtigen Stelle trägt mehr als ein dicker an der falschen. Effizienz ist Wissen.

---

#### Bauen L10

**Knowledge Unlock:** Kein Knowledge-Unlock (Master-Level)  
**Passiver Bonus:** Baumeister-Status; alle Boni maximiert; seltene Baurezepte verfügbar  
**Journal-Titel:** "Architekt"  
**Journal-Text:**
> Ich sehe eine leere Fläche und sehe bereits das Gebäude. Nicht als Bild, sondern als Liste von Schritten: hier Pfosten, dort Querbalken, da die Verbindung. Ich brauche keine Pläne mehr — ich trage sie im Kopf. Ich kann alles bauen, was dieser Ort hergibt.

---

### 5.4 Naturkunde (naturelore)

*Beschreibung: Pflanzen, Kräuter, Pilze, Ressourcen erkennen*

---

#### Naturkunde L1 (Startlevel)

**Knowledge Unlock:** Kein Unlock (Startlevel)  
**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Kräuter (herbs) aufheben | 8 XP | Sammeln |
| Pilze (mushroom) aufheben | 6 XP | Sammeln |
| Exotische Früchte aufheben | 8 XP | Sammeln |
| Nahrung (food) aufheben | 4 XP | Sammeln |
| Palmenblätter aufheben | 3 XP | Sammeln |

---

#### Naturkunde L2

**Knowledge Unlock:** `knows_medicine`  
**Journal-Titel:** "Die heilenden Blätter"  
**Journal-Text:**
> Ich habe eine Pflanze gefunden, die ich vorher ignoriert hatte — bitter riechend, mit kleinen zackigen Blättern. Als ich sie an meine aufgeschürfte Hand hielt, kühlte die Wunde. Der Schmerz ließ nach. Diese Pflanze heilt. Ich weiß nicht warum, aber ich weiß dass es stimmt. Ich muss lernen, mehr davon zu erkennen.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Verband craften (bandage) | 8 XP | Erste Medizin |
| Kräutermittel craften | 12 XP | Heilmittel |
| Kräutergestell bauen | 12 XP | Infrastruktur |

---

#### Naturkunde L3

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Kräuter und Pilze geben beim Sammeln 15% mehr XP; seltene Pflanzen sichtbar  
**Journal-Titel:** "Das Grün lesen"  
**Journal-Text:**
> Ich erkenne jetzt Unterschiede, die ich früher nicht sah. Diese Blätter sind essbar — jene nicht. Dieser Pilz ist harmlos — jener dort könnte gefährlich sein. Nicht weil ich es gelernt habe aus Büchern, sondern weil mein Körper es mir zeigt, wenn ich aufmerksam bin. Geruch, Textur, Farbe — Sprache der Natur.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Seltene Kräuter finden | 12 XP | Exploration |
| Ackerbeet bauen | 20 XP | benötigt naturelore L3 |
| Pilze in bestimmten Zonen finden | 8 XP | Zonenwissen |

---

#### Naturkunde L4

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Alle Naturmaterialien beim Sammeln +1 Stück; Pilze geben doppelten Hunger  
**Journal-Titel:** "Erntekenntnis"  
**Journal-Text:**
> Ich nehme immer nur einen Teil — lasse die Wurzel, lasse die Mutterpflanze stehen. Nicht aus Großzügigkeit, sondern weil ich weiß: morgen wächst wieder etwas, wenn ich heute nicht alles nehme. Die Ernte ist größer, wenn man weniger nimmt.

---

#### Naturkunde L5

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Giftige Pflanzen werden markiert; Kräuter heilen beim Sammeln passiv 1 HP  
**Journal-Titel:** "Gefährliches Grün"  
**Journal-Text:**
> Ich habe fast etwas gegessen, das mich hätte töten können. Der Geruch hat mich gewarnt — scharf, metallich, unnatürlich. Seither bin ich vorsichtiger. Nicht ängstlicher, aber respektvoller. Manche Pflanzen heilen. Manche töten. Den Unterschied zu kennen ist Leben.

---

#### Naturkunde L6

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Kräutermittel heilen 20% mehr; Fiebertee wirkt doppelt  
**Journal-Titel:** "Mischungen verstehen"  
**Journal-Text:**
> Zwei Kräuter zusammen wirken anders als jedes für sich. Das ist keine Magie — das ist Chemie, die ich nicht benennen kann, aber die mein Körper versteht. Bestimmte Kombis lindern Fieber besser, andere helfen gegen Wunden. Ich führe innerlich Buch über was mit was funktioniert.

---

#### Naturkunde L7-10

**L7:** Passiver Bonus: Alle Pflanzen im Radius werden beim Bewegen automatisch erkannt  
**L8:** Passiver Bonus: Kräuter können gelagert werden ohne Qualitätsverlust +50%  
**L9:** Passiver Bonus: Seltene Kräuter erscheinen häufiger in bekannten Gebieten  
**L10:** Master-Level: alle Naturmaterialien +2 beim Sammeln; vollständige Pflanzen-Datenbank aktiv  

*(Journal-Texte für L7–L10 folgen demselben Schema: atmosphärisch, ich-Perspektive, 3–4 Sätze)*

---

### 5.5 Jagen (hunting)

*Beschreibung: Tiere, Speere, Fallen, Zerlegen*

---

#### Jagen L1 (Startlevel)

**Knowledge Unlock:** Kein Unlock (Startlevel)  
**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Fisch (fish) aufheben | 6 XP | Sammeln |
| Wildschwein-Fleisch aufheben | 10 XP | Nach Kill |
| Wildschweinfell aufheben | 8 XP | Nach Kill |
| Schildkröten-Fleisch aufheben | 8 XP | Sammeln |
| Krabbenfleisch aufheben | 6 XP | Sammeln |

---

#### Jagen L2

**Knowledge Unlock:** `knows_basic_weapon`  
**Journal-Titel:** "Eine Waffe formen"  
**Journal-Text:**
> Ich habe das Wildschwein beobachtet — schnell, stark, mit diesen Hauern. Mit bloßen Händen hätte ich keine Chance. Aber ein langer Ast mit einer scharfen Spitze gibt mir Reichweite. Ich könnte den Speer erst werfen, dann näherkommen. Das braucht Übung, aber das Prinzip ist klar: Distanz ist Überleben.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Steinspeer craften | 15 XP | Jagdwaffe |
| Wildschwein erlegen | 18 XP | Jagd-Kill |
| Schlinge bauen | 10 XP | Fallen-Jagd |

---

#### Jagen L3

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Tiere bleiben länger in Sichtweite; Spurenlesen aktiviert (Tierstandorte auf Karte)  
**Journal-Titel:** "Beobachten vor dem Angriff"  
**Journal-Text:**
> Ich habe ein Wildschwein zwanzig Minuten lang nur beobachtet, bevor ich mich genähert habe. Ich habe gelernt: es läuft immer dieselbe Route. Dreht sich bei Geräuschen immer zuerst nach links. Hat einen toten Winkel nach rechts hinten. Dieser Moment des Wartens — das ist Jagd, nicht das Werfen.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Angelrute craften | 10 XP | Angelausrüstung |
| Angeln (fish fangen) | 8 XP | Pro Fang |
| Tier beobachten (neues Tier) | 5 XP | Erkundung |

---

#### Jagen L4

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Speerwurf-Reichweite +20%; Wildschweinfleisch-Ertrag +1  
**Journal-Titel:** "Den Körper kennen"  
**Journal-Text:**
> Ich weiß jetzt wo der Schlag sitzt. Nicht Glück, sondern Wissen — Schulterblatt, Halsseite, unter dem Ohr. Ein gezielter Treffer endet die Jagd schneller und ist humaner. Das Tier leidet weniger. Und ich spare Kraft, weil ich nicht nachjagen muss.

---

#### Jagen L5

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Fallen benötigen weniger Material; Schlingen halten länger  
**Journal-Titel:** "Die geduldige Falle"  
**Journal-Text:**
> Eine Falle braucht Geduld auf zwei Seiten — meine beim Aufbauen, das Tier beim Hineintappen. Ich habe gelernt, Fallen an Tierpfaden aufzustellen, nicht irgendwo. Die richtigen Gerüche, die richtige Höhe, kein menschlicher Geruch daran. Eine gut gestellte Falle arbeitet für mich, während ich schlafe.

---

#### Jagen L6-10

**L6:** Passiver Bonus: Fischfang zweimal so häufig; Angelzeit -30%  
**L7:** Passiver Bonus: Wildschweine fliehen langsamer; Jäger-Instinkt (automatisches Markieren in Nähe)  
**L8:** Passiver Bonus: Seltene Tierarten erscheinen (zukünftig: Reh, Vogel)  
**L9:** Passiver Bonus: Alle Jagd-Kills geben +50% XP  
**L10:** Master-Level: Speerwurf-Präzision maximiert; Tiere fürchten den Spieler (Bonus-XP wenn sie fliehen)

---

### 5.6 Kochen (cooking)

*Beschreibung: Nahrung sicher machen, haltbar machen, Wasser abkochen*

---

#### Kochen L1 (Startlevel)

**Knowledge Unlock:** Kein Unlock (Startlevel)  
**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Nahrung (food) aufheben | 4 XP | Sammeln → Survival-Instinkt |
| Feuer beobachten (Lagerfeuer vorhanden) | 2 XP | Passiv |

*(Kochen gibt erst richtig XP ab L2, wenn Rezepte verfügbar sind)*

---

#### Kochen L2

**Knowledge Unlock:** `knows_cooking`  
**Journal-Titel:** "Hitze macht sicher"  
**Journal-Text:**
> Ich habe rohes Fleisch gegessen und mich hinterher schlecht gefühlt. Als ich es über die Flamme gehalten habe — nur kurz, bis es bräunlich wurde — war es besser. Nicht nur im Geschmack. Mein Körper reagiert anders darauf. Hitze tötet etwas im Essen, das schadet. Das ist keine Theorie. Das ist Erfahrung.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Essen kochen (cooked_food) | 10 XP | Erstes Kochen |
| Pilze braten (cooked_mushroom) | 10 XP | Kochen |
| Wildschwein braten (cooked_boar) | 12 XP | Höherwertiges Kochen |
| Fisch braten (cooked_fish) | 10 XP | Kochen |
| Krabbe kochen (cooked_crab) | 10 XP | Kochen |
| Schildkröte garen (cooked_turtle) | 10 XP | Kochen |

---

#### Kochen L3

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Alle Gekochten Mahlzeiten geben +15% mehr Nahrungspunkte  
**Journal-Titel:** "Temperatur spüren"  
**Journal-Text:**
> Ich weiß jetzt, wann Fleisch gar ist — nicht durch einen Schnitt hinein, sondern durch das Zischen, den Geruch, die Farbe der Säfte. Zu lange und es wird trocken. Zu kurz und es bleibt roh. Das Feuer ist kein An-Aus-Schalter, es ist ein Instrument. Ich lerne, es zu spielen.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Trockengestell bauen | 12 XP | Infrastruktur |
| Räucherstelle bauen | 20 XP | Infrastruktur |
| Wasser kochen | 8 XP | Wasseraufbereitung |

---

#### Kochen L4

**Knowledge Unlock:** `knows_preservation`  
**Journal-Titel:** "Nahrung für später"  
**Journal-Text:**
> Fleisch das man nicht sofort isst, fault — aber ich habe etwas bemerkt: was lange über dem Feuer hängt, wird anders. Trockener, zäher, riecht geräuchert. Und wenn ich es dann eine Woche später esse, ist es noch gut. Das Feuer nimmt die Feuchtigkeit heraus. Ohne Feuchtigkeit kein Verfall. Das verändert alles.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Fleisch räuchern (smoked_meat) | 15 XP | Konservierung |
| Fisch trocknen (dried_fish) | 12 XP | Konservierung |
| Früchte trocknen (dried_fruit) | 10 XP | Konservierung |

---

#### Kochen L5

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Konservierte Nahrung hält 30% länger; Räuchern geht 20% schneller  
**Journal-Titel:** "Vorrat als Sicherheit"  
**Journal-Text:**
> Drei Tage geräuchertes Fleisch im Lager. Fünf getrocknete Fische. Ein paar eingewickelte Früchte. Ich muss nicht jeden Tag jagen — ich kann planen, horten, sparen. Ein Vorrat ist keine Gier. Ein Vorrat ist Zeit. Freie Zeit, die ich für anderes nutzen kann.

---

#### Kochen L6-10

**L6:** Passiver Bonus: Rezepte benötigen 1 Zutat weniger (wenn >2 Zutaten); Kochzeit -20%  
**L7:** Passiver Bonus: Gare Speisen geben Bonus-Moral (kleiner Stimmungsbonus)  
**L8:** Passiver Bonus: Wasser muss nicht mehr abgekocht werden (Körper ist immun)  
**L9:** Passiver Bonus: Neue Rezepte entdeckbar (Suppe, Frucht-Fisch-Kombination)  
**L10:** Master-Koch: alle Mahlzeiten maximal nahrhaft; Konservierung bis 14 Tage standard

---

### 5.7 Medizin (medicine)

*Beschreibung: Wunden, Krankheit, Salben, Gegengift*

---

#### Medizin L1 (Startlevel)

**Knowledge Unlock:** Kein Unlock (Startlevel)  
**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Kräuter aufheben | 8 XP | Auch für Naturkunde |
| Verletzt werden (passive Erfahrung) | 2 XP | Körperbewusstsein |

---

#### Medizin L2

**Knowledge Unlock:** Kein Knowledge-Unlock  
*(knows_medicine wird über Naturkunde L2 primär freigeschaltet)*  
**Passiver Bonus:** Heilmittel wirken 10% schneller; Wunden bluten 10% langsamer  
**Journal-Titel:** "Wunden kennen"  
**Journal-Text:**
> Ich habe mich heute am Feuerstein geschnitten — nicht schlimm, aber es hat geblutet. Ich habe einen zerriebenen Kräuterbrei auf die Wunde gedrückt und gewartet. Die Blutung hat aufgehört. Der Schmerz hat nachgelassen. Mein Körper will heilen — er braucht nur die richtigen Mittel. Ich lerne, ihm zu geben, was er braucht.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Verband anlegen (bandage) | 8 XP | Wundversorgung |
| Kräutermittel craften | 12 XP | Heilmittel |
| Kräutermittel anwenden | 10 XP | Heilung |

---

#### Medizin L3

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Krankheitsdauer -20%; Vergiftungsresistenz +15%  
**Journal-Titel:** "Fieber verstehen"  
**Journal-Text:**
> Ich habe Fieber gehabt — nicht lange, aber intensiv. Dabei habe ich etwas bemerkt: Fieber ist kein Feind, es ist eine Reaktion. Der Körper kämpft. Wenn ich ihm helfe zu kämpfen — mit Kräutertee, mit Wärme, mit Ruhe — geht es schneller vorbei. Fieber bekämpft man nicht. Man begleitet es.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Fiebertee craften | 15 XP | Krankheitsbehandlung |
| Fiebertee trinken (geheilt) | 8 XP | Anwendung |
| Parasitenmedizin craften | 20 XP | Fortgeschrittene Medizin |

---

#### Medizin L4

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Alle Heilmittel geben +20% mehr HP  
**Journal-Titel:** "Vorbeugung"  
**Journal-Text:**
> Ich bin nicht mehr krank geworden. Nicht wegen Glück — ich habe angefangen, vorbeugend zu handeln. Kein rohes Wasser mehr. Kein rohes Fleisch. Hände sauber nach Kontakt mit Tieren. Diese kleinen Dinge stapeln sich. Gesundheit ist nicht nur Heilung — es ist das Verhindern von Krankheit.

---

#### Medizin L5-10

**L5:** Passiver Bonus: Parasitenresistenz +40%; Vergiftungen heilen automatisch ab  
**L6:** Passiver Bonus: Alle Verbandsrezepte benötigen 1 Zutat weniger  
**L7:** Passiver Bonus: Kräutergestell-Bonus auf +40% Heilwirkung erhöht  
**L8:** Passiver Bonus: Schwerste Wunden können selbst versorgt werden ohne Materialverlust  
**L9:** Passiver Bonus: Passendes Gegenmittel kann aus beliebigen Kräutern improvisiert werden  
**L10:** Master-Mediziner: vollständige Immunität gegen Nahrungsvergiftung; alle Heilmittel maximale Wirkung

---

### 5.8 Körperbeherrschung (body)

*Beschreibung: Ausdauer, Tragen, Schleichen, Bewegung im Gelände*

---

#### Körper L1 (Startlevel)

**Knowledge Unlock:** Kein Unlock (Startlevel)  
**XP-Quellen:**

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Weit laufen (>200m ohne Stop) | 3 XP | Ausdauer |
| Schweres Inventar tragen (>80%) | 2 XP/Min | Körperbelastung |
| Schleichen (nahe an Tier) | 4 XP | Schleich-Erfahrung |

---

#### Körper L2

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Inventarkapazität +2 Slots; Laufgeschwindigkeit +5%  
**Journal-Titel:** "Mehr tragen"  
**Journal-Text:**
> Ich habe die Route vom Wald zum Lager dreimal hintereinander gelaufen — schwer beladen, schweißnass. Heute Morgen ist dieselbe Route leichter gefühlt. Nicht die Last wurde weniger. Mein Körper wurde stärker. Das ist kein Wunder — das ist tägliches Tun.

**XP-Quellen:** (zusätzlich zu vorherigen)

| Aktion | XP | Anmerkung |
|--------|-----|-----------|
| Vollgeladenes Inventar zum Lager bringen | 8 XP | Transport |
| 500m in einem Lauf | 5 XP | Ausdauer |

---

#### Körper L3

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Schleichen macht 40% weniger Geräusch; Spurenlesen schneller  
**Journal-Titel:** "Lautlos werden"  
**Journal-Text:**
> Ich bin heute auf drei Meter an ein Wildschwein herangekommen, ohne dass es mich bemerkt hat. Langsame Bewegungen. Füße rollen vom Ballen zur Ferse, nicht stampfen. Den Wind im Rücken. Das ist keine Magie — das ist Bewegung mit Bewusstsein. Mein Körper kann lautlos sein, wenn er es muss.

---

#### Körper L4

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Inventarkapazität +4 gesamt; Sprint-Ausdauer +30%  
**Journal-Titel:** "Ausdauer aufbauen"  
**Journal-Text:**
> Ich merke, dass ich später erschöpfe als früher. Die Lunge protestiert nicht mehr so schnell. Meine Beine kennen den Rhythmus — schnell wenn nötig, ruhig wenn möglich. Ausdauer ist kein Talent. Sie ist Training, das man sich in kleinen Dosen selbst gibt.

---

#### Körper L5

**Knowledge Unlock:** Kein Knowledge-Unlock  
**Passiver Bonus:** Hunger und Durst sinken 10% langsamer; Körpertemperatur stabiler  
**Journal-Titel:** "Effizienter Körper"  
**Journal-Text:**
> Mein Körper hat gelernt, mit weniger auszukommen. Weniger Wasser, weniger Nahrung — und trotzdem funktionsfähig. Nicht weil ich leide, sondern weil mein Stoffwechsel sich angepasst hat. Der Körper ist klug, wenn man ihm Zeit gibt zu lernen.

---

#### Körper L6-10

**L6:** Passiver Bonus: Vollsprint 50% schneller; Schleichen ist Standard-Bewegungsmodus möglich  
**L7:** Passiver Bonus: Inventar +6 Slots gesamt; schwere Items kosten 20% weniger Ausdauer  
**L8:** Passiver Bonus: Gelände-Debuffs (Schlamm, Geröll) komplett ignoriert  
**L9:** Passiver Bonus: Tiere fürchten Spieler natürlich (Bonus auf Jagd-XP)  
**L10:** Master-Körper: alle Körper-Boni maximiert; Sprint unbegrenzt; Inventar +10 Slots gesamt

---

## 6. XP-Quellen — vollständige Tabellen

### 6.1 Sammeln (Gather XP — aus skills.ts GATHER_SKILL_XP)

| Material | Skill | XP | Toast-Text |
|----------|-------|-----|------------|
| flint | crafting | 4 | Feuerstein |
| pebbles | survival | 3 | Kiesel |
| wood | crafting | 5 | Holz |
| sticks | crafting | 3 | Äste |
| fiber | crafting | 4 | Fasern |
| vine | crafting | 4 | Lianen |
| herbs | naturelore | 8 | Kräuter |
| mushroom | naturelore | 6 | Pilze |
| exotic_fruit | naturelore | 8 | Exotische Früchte |
| food | naturelore | 4 | Nahrung |
| palm_leaf | naturelore | 3 | Palmenblätter |
| fish | hunting | 6 | Fisch |
| boar_meat | hunting | 10 | Wildschwein-Fleisch |
| boar_hide | hunting | 8 | Wildschweinfell |
| turtle_meat | hunting | 8 | Schildkrötenfleisch |
| crab_meat | hunting | 6 | Krabbenfleisch |
| iron_ore | crafting | 6 | Eisenerz |
| stone | building | 3 | Steine |
| granite | building | 4 | Granit |

### 6.2 Crafting XP (aus recipes.json)

| Rezept-ID | Name | Skill | XP |
|-----------|------|-------|-----|
| knap_flint | Feuerstein absplittern | crafting | 15 |
| harden_stick | Ast in Feuer härten | crafting | 10 |
| palm_leaf_to_fiber | Palmenblätter zerreißen | crafting | 5 |
| rope_fiber | Seil flechten | crafting | 10 |
| shell_knife | Muschelklinge | crafting | 8 |
| flint_knife | Feuersteinmesser | crafting | 25 |
| stone_axe | Primitive Axt | crafting | 20 |
| stone_pickaxe | Steinspitzhacke | crafting | 20 |
| stone_spear | Steinspeer | hunting | 15 |
| fishing_rod | Angelrute | hunting | 10 |
| improved_axe | Verbesserte Axt | crafting | 20 |
| improved_pickaxe | Verbesserte Spitzhacke | crafting | 20 |
| obsidian_blade | Obsidianklinge | crafting | 30 |
| iron_bar | Eisenbarren | crafting | 25 |
| cooked_food | Gekochtes Essen | cooking | 10 |
| cooked_mushroom | Gebratene Pilze | cooking | 10 |
| cooked_boar | Gebratenes Wildschwein | cooking | 12 |
| cooked_fish | Gebratener Fisch | cooking | 10 |
| cooked_crab | Gekochte Krabbe | cooking | 10 |
| cooked_turtle | Gegarte Schildkröte | cooking | 10 |
| smoked_meat | Fleisch räuchern | cooking | 15 |
| dried_fish | Fisch trocknen | cooking | 12 |
| dried_fruit | Früchte trocknen | cooking | 10 |
| bandage | Verband | medicine | 8 |
| herbal_remedy | Kräutermittel | medicine | 12 |
| fever_tea | Fiebertee | medicine | 15 |
| antiparasitic | Parasitenmedizin | medicine | 20 |

### 6.3 Bau XP (neue Werte — Building-Skill)

| Bauwerk-ID | Name | Skill | XP (vorgeschlagen) |
|------------|------|-------|---------------------|
| storage_spot | Ablageplatz | building | 5 |
| sleeping_spot | Schlafplatz | building | 8 |
| campfire | Lagerfeuerstelle | survival | 15 |
| water_container | Einfacher Regensammler | survival | 12 |
| palm_shelter | Palmendach | building | 25 |
| wooden_shelter | Holzunterkunft | building | 35 |
| log_cabin | Blockhütte | building | 50 |
| bed | Bett | building | 20 |
| storage_box | Lagerbox | building | 15 |
| granite_campfire | Granit-Feuerstelle | building | 15 |
| torch | Fackelhalter | building | 10 |
| drying_rack | Trockengestell | cooking | 12 |
| smoking_rack | Räucherstelle | cooking | 20 |
| workbench | Werkbank | building | 25 |
| furnace | Schmelzofen | building | 45 |
| farm_plot | Ackerbeet | naturelore | 20 |
| herb_drying_rack | Kräutergestell | naturelore | 12 |
| snare_trap | Schlinge | hunting | 10 |

### 6.4 Kampf- und Jagd-XP

| Aktion | Skill | XP |
|--------|-------|-----|
| Wildschwein erlegen | hunting | 18 |
| Schildkröte erlegen | hunting | 10 |
| Krabbe fangen | hunting | 8 |
| Fisch angeln (pro Fang) | hunting | 8 |
| Tier mit Falle fangen | hunting | 12 |
| Neues Tier entdecken | hunting | 5 |

---

## 7. Material-Pickup Toasts

*Format: Materialname → Toast-Text (1 Satz, atmosph., Ich-Perspektive möglich)*  
*Anzeige: kurz (2–3 Sekunden), nicht blockierend, oben rechts oder am Materialicon*

| Material | Toast-Text |
|----------|------------|
| flint | Feuerstein — kalt und scharf an der Bruchkante. |
| pebbles | Ein paar glatte Kiesel — die könnten Funken geben. |
| wood | Schweres Holz — das hält was aus. |
| sticks | Trockene Äste — gut zum Brennen, gut zum Bauen. |
| fiber | Zähe Fasern — lassen sich zu fast allem drehen. |
| vine | Lianen — biegsam, aber reißfest. |
| herbs | Kräuter — bitterer Geruch, heilende Wirkung, vermutlich. |
| mushroom | Ein Pilz — hoffentlich der richtige. |
| exotic_fruit | Diese Frucht kenne ich nicht — riechen vor dem Essen. |
| food | Nahrung — Überleben beginnt hier. |
| palm_leaf | Breit und wasserabweisend — praktisch in der Natur. |
| fish | Frischer Fisch — besser gegart, aber jetzt ist er erstmal sicher. |
| boar_meat | Wildschwein-Fleisch — schwer erkämpft, gut errungen. |
| boar_hide | Dickes Fell — zäh wie das Tier selbst. |
| turtle_meat | Schildkröte — muss unbedingt gegart werden. |
| crab_meat | Krabbenfleisch — zart, nahrhaft, wenn frisch. |
| iron_ore | Dieses Erz ist schwerer als normaler Stein — da steckt Metall drin. |
| stone | Steine — Baustoff, Werkzeug, Waffe. Alles gleichzeitig. |
| granite | Granit — dichter, schwerer, hält Feuer besser. |
| coconut | Eine Kokosnuss — Schale, Wasser, Fruchtfleisch. Nichts verschwenden. |
| coconut_shell | Die leere Schale — wasserdicht, praktisch als Behälter. |
| palm_leaf | Die Fläche des Blatts leitet Wasser ab wie eine Rinne. |
| vine | Genug Lianen und man kann fast alles zusammenhalten. |
| tree_resin | Baumharz — klebrig, brennbar, heilsam vielleicht. |
| sharp_flint | Geschärfter Feuerstein — vorsichtig anfassen, das ist eine Klinge. |
| hardened_stick | Feuergehärteter Ast — fast wie Knochen, schwer zu brechen. |
| rope | Ein Seil aus eigener Hand — stärker als man denkt. |
| shells | Muschelschalen — scharf wenn gebrochen, praktisch als Klinge. |
| driftwood | Treibholz — vom Meer geformt, für Feuer und Bau brauchbar. |
| obsidian | Schwarzes Glas aus dem Vulkan — schärfer als alles andere. |
| iron_bar | Ein Eisenbarren — der erste. Schwer, glatt, kalt. Schön. |

---

## 8. Progression-Beispiel: Die ersten 30 Minuten

*Beschreibung des typischen Spielablaufs für einen neuen Spieler.*  
*Annahme: Spieler startet mit knows_basic_rest und knows_basic_storage freigeschaltet.*

---

### Phase 1: Ankommen (Minuten 0–5)

**Was der Spieler tut:**
Der Spieler erwacht am Strand ohne Werkzeuge. Erste Erkundung: Kiesel am Boden aufheben, Äste sammeln, Feuerstein finden.

**XP-Fluss:**
```
Kiesel aufheben ×3     → survival +9 XP
Äste aufheben ×3       → crafting +9 XP
Feuerstein aufheben ×2 → crafting +8 XP
Fasern aufheben ×2     → crafting +8 XP
```

**XP-Stand nach Phase 1:**
- survival: 9/20 (L1)
- crafting: 25/20 → **LEVEL UP auf L2!**

**Eingebung freigeschaltet:** `knows_sharp_edges` → Journal-Eintrag "Klingen aus Stein" erscheint  
**Roter Punkt erscheint auf Journal-Icon**

**Pickup-Toasts die erscheinen:**
- "Glatte Kiesel — die könnten Funken geben."
- "Feuerstein — kalt und scharf an der Bruchkante."
- "Trockene Äste — gut zum Brennen, gut zum Bauen."

---

### Phase 2: Erste Werkzeuge (Minuten 5–12)

**Was der Spieler tut:**
Spieler bemerkt roten Punkt, öffnet Journal. Liest "Klingen aus Stein"-Eingebung, klickt [Eingebung annehmen]. `knows_sharp_edges` aktiv. Sofort: Feuerstein absplittern ist im Crafting-Menü sichtbar. Spieler splittert Feuerstein ab.

**XP-Fluss:**
```
Journal öffnen/lesen           → (keine XP, aber Knowledge aktiv)
Feuerstein absplittern         → crafting +15 XP
Muschelklinge craften          → crafting +8 XP
Mehr Fasern sammeln ×4         → crafting +16 XP
Palmenblätter aufheben ×3      → naturelore +9 XP
```

**XP-Stand nach Phase 2:**
- crafting: 48/40 → **LEVEL UP auf L3!**
- naturelore: 9/20 (L1)

**Eingebung freigeschaltet:** `knows_binding` → Journal-Eintrag "Fasern als Faden"  
**Spieler öffnet Journal erneut, liest und akzeptiert → Seil-Rezept verfügbar**

---

### Phase 3: Schutz und Feuer (Minuten 12–20)

**Was der Spieler tut:**
Mit `knows_binding` aktiv: Seil flechten, Kräuter sammeln (Naturkunde XP), Ablageplatz bauen. Es beginnt zu nieseln — Spieler bekommt "Regen"-Event.

**XP-Fluss:**
```
Seil flechten                  → crafting +10 XP
Kräuter sammeln ×3             → naturelore +24 XP
Pilze aufheben ×2              → naturelore +12 XP
Ablageplatz bauen              → building +5 XP
Regen ohne Unterstand          → survival +4 XP
```

**XP-Stand nach Phase 3:**
- crafting: 58/60 (knapp unter L4)
- naturelore: 45/20 → **LEVEL UP auf L2!**
- building: 5/20 (L1)
- survival: 13/20 (L1 — noch nicht L2)

**Eingebung freigeschaltet:** `knows_medicine` → Journal-Eintrag "Die heilenden Blätter"  
**Außerdem:** Durch Regen + Palmenblätter im Inventar → `knows_basic_shelter` via rainGrants (Sofort-Grant, kein Journal)

*Hinweis für Implementierung: rainGrants aus knowledgeDefinitions.json bleiben als Sofort-Grants erhalten — sie brauchen kein Level-Up als Trigger. Sie ergänzen das Journal-System.*

---

### Phase 4: Erstes Feuer (Minuten 20–28)

**Was der Spieler tut:**
Mit `knows_basic_shelter` aktiv: Spieler kann Palmendach im Bauplan-Menü sehen. Zuerst aber: Kiesel sammeln — survival L2 wird fällig.

**XP-Fluss:**
```
Weitere Kiesel sammeln ×3      → survival +9 XP → survival L2!
Schlafplatz bauen              → building +8 XP
Palmendach bauen               → building +25 XP
Fasern und Äste für Feuerstelle sammeln
Lagerfeuer bauen               → survival +15 XP
```

**XP-Stand nach Phase 4:**
- survival: 9+4+15 = 28/40 (frisch L2 = braucht 40 für L3)
- building: 38/20 → **LEVEL UP auf L2!**

**Eingebungen freigeschaltet:**
- Überleben L2: `knows_basic_fire` → Journal "Funken aus Stein"  
- Bauen L2: `knows_basic_shelter` (bereits aktiv via Rain-Grant, Journal-Eintrag erscheint trotzdem als Erklärung)

**Journal hat jetzt 2 neue Einträge** (roter Punkt mit "2")

---

### Phase 5: Erste Mahlzeit (Minuten 28–30)

**Was der Spieler tut:**
Spieler hat Feuer. `knows_basic_fire` aktiv → Treibholz zerbrechen-Rezept sichtbar. Spieler öffnet Journal, liest "Funken aus Stein", akzeptiert. Dann: nach `knows_fire` (kommt durch Lagerfeuer bauen via grantsKnowledge in buildDefinitions) → Kochen wird möglich.

**XP-Fluss:**
```
Journal lesen (2 Einträge)    → knows_basic_fire + knows_basic_shelter aktiv
Treibholz zerbrechen           → survival +4 XP
Essen kochen (food ×2)         → cooking +10 XP → cooking L2!
```

**XP-Stand am Ende von Minute 30:**
- survival: L2, 32/40 XP
- crafting: L3, 68/60 → **L4!** (crafting hat XP aus Phase 2-3 angesammelt)
- building: L2, 13/40 XP
- naturelore: L2, 45/40 → **L3!** (XP aus Kräutern)
- cooking: L2, 10/40 XP
- hunting: L1, 0 XP
- medicine: L1, 0 XP
- body: L1, 0 XP

**Eingebungen nach 30 Minuten freigeschaltet:**
1. Handwerk L2: `knows_sharp_edges` — "Klingen aus Stein"
2. Handwerk L3: `knows_binding` — "Fasern als Faden"
3. Handwerk L4: `knows_tool_binding` — "Klinge und Griff"
4. Naturkunde L2: `knows_medicine` — "Die heilenden Blätter"
5. Naturkunde L3: Passiver Bonus (kein Flag, aber XP-Boost)
6. Bauen L2: `knows_basic_shelter` — "Blätter als Dach" (Bestätigung des Rain-Grants)
7. Überleben L2: `knows_basic_fire` — "Funken aus Stein"
8. Kochen L2: `knows_cooking` — "Hitze macht sicher"

**Offene Journal-Einträge nach 30 Minuten (noch nicht gelesen):**  
Abhängig davon, wie oft der Spieler das Journal öffnet. Typischerweise 2–3 ungelesen.

**Verfügbare Rezepte nach 30 Minuten:**
- Feuerstein absplittern ✅
- Muschelklinge ✅
- Feuersteinmesser ✅ (benötigt knows_binding + knows_sharp_edges)
- Seil flechten ✅
- Palmenblätter zerreißen ✅
- Verband ✅ (knows_medicine)
- Kräutermittel ✅
- Essen kochen ✅ (knows_cooking + Feuer)
- Steinspeer (sobald knows_hardened_wood via Überleben L4)

---

## 9. Implementierungshinweise

### 9.1 Änderungen an bestehenden Dateien

**recipes.json:**
- Feld `skillBasedSuccess` auf allen Rezepten entfernen oder ignorieren
- Alle Rezepte craften immer erfolgreich
- `grantsSkill` bleibt wie definiert — gibt XP bei erfolgreichem Craft

**knowledgeDefinitions.json:**
- `materialGrants` bleiben als Sofort-Grants (Pickup → sofortiger Flag, kein Journal)
- `rainGrants` bleiben als Sofort-Grants (Regen-Event → Flag, kein Level-Up nötig)
- `startingKnowledge` bleibt: `["knows_basic_rest", "knows_basic_storage"]`

**ideas.ts / ideas.json:**
- Das alte Grübel-System (ReflectionFocus, Schlaf-Gate, FOCUS_UNLOCK_CONDITIONS) wird deprecated
- Die `IdeaInsight`-Texte können als Vorlage für Journal-Texte recycelt werden
- Die `IDEAS`-Array-Daten können archiviert werden (nicht löschen, könnten für zukünftige Features nützlich sein)

### 9.2 Neue Dateien

**src/data/json/journalDefinitions.json** — Alle Journal-Einträge:
```json
[
  {
    "id": "journal_crafting_l2",
    "skillId": "crafting",
    "skillLevel": 2,
    "grantsKnowledge": "knows_sharp_edges",
    "title": "Klingen aus Stein",
    "text": "Heute habe ich den Feuerstein gegen einen Kiesel geschlagen..."
  },
  ...
]
```

**src/data/journal.ts** — TypeScript-Interface und Loader  
**src/services/JournalService.ts** — Logik: Level-Up → Journal-Eintrag erstellen, Journal-State verwalten

### 9.3 Skill-XP-System — Erweiterungen

Bestehende `GATHER_SKILL_XP` in skills.ts ist gut strukturiert.  
Ergänzen:

```typescript
// Bau-XP (neu, analog zu GATHER_SKILL_XP)
export const BUILD_SKILL_XP: Record<string, { skill: SkillId; xp: number }> = {
  storage_spot:     { skill: 'building',   xp: 5  },
  sleeping_spot:    { skill: 'building',   xp: 8  },
  campfire:         { skill: 'survival',   xp: 15 },
  water_container:  { skill: 'survival',   xp: 12 },
  palm_shelter:     { skill: 'building',   xp: 25 },
  wooden_shelter:   { skill: 'building',   xp: 35 },
  log_cabin:        { skill: 'building',   xp: 50 },
  bed:              { skill: 'building',   xp: 20 },
  storage_box:      { skill: 'building',   xp: 15 },
  granite_campfire: { skill: 'building',   xp: 15 },
  torch:            { skill: 'building',   xp: 10 },
  drying_rack:      { skill: 'cooking',    xp: 12 },
  smoking_rack:     { skill: 'cooking',    xp: 20 },
  workbench:        { skill: 'building',   xp: 25 },
  furnace:          { skill: 'building',   xp: 45 },
  farm_plot:        { skill: 'naturelore', xp: 20 },
  herb_drying_rack: { skill: 'naturelore', xp: 12 },
  snare_trap:       { skill: 'hunting',    xp: 10 },
};
```

### 9.4 Knowledge-Unlock via Level-Up — Mapping

```typescript
// src/data/skillKnowledgeUnlocks.ts
export const SKILL_LEVEL_KNOWLEDGE_UNLOCKS: Partial<Record<SkillId, Partial<Record<number, KnowledgeFlag>>>> = {
  crafting: {
    2: 'knows_sharp_edges',
    3: 'knows_binding',
    4: 'knows_tool_binding',
    5: 'knows_hardened_wood',
    7: 'knows_metal',
  },
  survival: {
    2: 'knows_basic_fire',
    3: 'knows_rain_collection',
    4: 'knows_fire',
  },
  building: {
    2: 'knows_basic_shelter',
    4: 'knows_construction',
  },
  naturelore: {
    2: 'knows_medicine',
  },
  hunting: {
    2: 'knows_basic_weapon',
  },
  cooking: {
    2: 'knows_cooking',
    4: 'knows_preservation',
  },
};
```

### 9.5 Toast-System — Technische Anforderungen

- Toast erscheint 2–3 Sekunden, dann fade-out
- Maximal 2 Toasts gleichzeitig sichtbar (queued)
- Pickup-Toasts: leichte Farbe (creme/gelb)
- Journal-Toasts ("Neue Eingebung!"): blau/lila, mit Buch-Icon
- Knowledge-Aktivierungs-Toasts: grün, mit Haken

### 9.6 Migrationsplan (altes Grübel-System → Journal)

1. **Schritt 1:** `JournalService` implementieren, parallel zu altem System
2. **Schritt 2:** Skill-Level-Up-Events feuern `journal.addEntry(skillId, level)`
3. **Schritt 3:** HUD-Button (Buch-Icon) mit rotem Punkt implementieren
4. **Schritt 4:** Journal-Panel UI implementieren
5. **Schritt 5:** Altes Sleep-Gate für Knowledge entfernen
6. **Schritt 6:** `ideas.ts` / `ReflectionFocus`-System als deprecated markieren
7. **Schritt 7:** Testen: Spieler kann alle 16 Flags ohne Schlafen freischalten

---

## 10. Abweichungen vom alten Grübel-System

| Aspekt | Altes System | Neues System |
|--------|-------------|--------------|
| **Trigger für Knowledge** | Schlafen + Focus wählen + Materialien aufheben | Skill-Level-Up → Journal lesen |
| **Schlaf-Gate** | Ja — ohne Schlafen kein Fortschritt | Nein — jederzeit |
| **Geschwindigkeit** | Langsam (1 Focus pro Schlafzyklus) | Schnell (Level-Up jederzeit) |
| **Narrativ** | Abstrakt (Fokus-Auswahl) | Konkret (Ich-Perspektive Journal) |
| **Fehlschlag** | Materialverlust möglich | Nie |
| **Sichtbarkeit** | Verborgen bis Schlaf + Trigger | Immer sichtbar (Journal offen) |
| **Frühes Feedback** | Material-Toast ohne Konsequenz | Material-Toast + Journal-Eintrag bei Level-Up |
| **Archiv** | Keins | Ältere Einträge bleiben sichtbar |

---

*Dokumentversion 1.0 — erstellt 2026-05-30*  
*Basierend auf: skills.ts, knowledge.ts, ideas.ts, recipes.json, buildDefinitions.json, knowledgeDefinitions.json, ideas.json*
