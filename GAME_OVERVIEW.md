# Survival Game – Spielübersicht
*Stand: v1.5 · 30.05.2026*

---

## Skills

8 Skills, Level 1–10. XP-Kosten pro Level: `level × 20`.
Crafting-XP sinkt bei Wiederholung (Diminishing Returns: 1/√n, min 10%).

| Skill | Beschreibung | XP durch Sammeln |
|---|---|---|
| **Überleben** | Feuer, Wasser, Wetter, Schlaf, Grundroutinen | Kiesel aufheben |
| **Handwerk** | Werkzeuge, Seile, Stein, einfache Verarbeitung | Feuerstein, Holz, Äste, Faser, Liane, Eisenerz |
| **Bauen** | Unterstände, Lager, Werkbank, Palisaden | Stein, Granit |
| **Naturkunde** | Pflanzen, Kräuter, Pilze, Ressourcen erkennen | Kräuter, Pilze, Früchte, Beeren, Palmblatt |
| **Jagen** | Tiere, Speere, Fallen, Zerlegen | Fleisch, Fisch, Felle |
| **Kochen** | Nahrung sicher machen, haltbar machen, Wasser abkochen | — |
| **Medizin** | Wunden, Krankheit, Salben, Gegengift | — |
| **Körperbeherrschung** | Ausdauer, Tragen, Schleichen, Bewegung im Gelände | — |

### Skill-Effekte auf Crafting
- **Craftingzeit** sinkt um 5% pro Level, max –45% bei Level 10
- **Erfolgswahrscheinlichkeit** (nur Feuerstein absplittern): Basis 35%, +6%/Level
- **Skill-Sperre**: Manche Rezepte/Bauten sind erst ab bestimmtem Level baubar

---

## Knowledge-System

Wissen wird durch Erleben freigeschaltet — nicht durch Menüs.

### Von Anfang an bekannt
| Flag | Bedeutung |
|---|---|
| `knows_basic_rest` | Kann improvisierten Schlafplatz bauen |
| `knows_basic_storage` | Kann Ablageplatz markieren |

### Durch Materialien aufheben
| Material | Gibt Wissen |
|---|---|
| Feuerstein / gespl. Feuerstein | `knows_sharp_edges` |
| Kiesel | `knows_basic_fire` |
| Faser / Liane | `knows_binding` |
| Kräuter | `knows_medicine` |
| Eisenerz | `knows_metal` |
| Kokosnuss / Kokosschale | `knows_rain_collection` |

### Durch Regen (wenn Materialien bekannt)
| Bedingung | Gibt Wissen |
|---|---|
| Palmblatt/Äste/Lianen gesehen | `knows_basic_shelter` |
| Kokosnuss/Palmblatt gesehen | `knows_rain_collection` |

### Durch Bauen
| Aktion | Gibt Wissen |
|---|---|
| Lagerfeuer bauen | `knows_fire` |
| Palmendach bauen | `knows_construction` |

---

## Grübel-System

**Ablauf:** Schlafen ≥6h + Lagerfeuer in der Nähe → Reflexionsfokus wählen → Materialien am nächsten Tag triggern Erkenntnisse → bei vollständiger Idee: Knowledge-Flag freigeschaltet

### Verfügbare Focuses

| Focus | Startend verfügbar | Freischaltbedingung |
|---|---|---|
| Wasser & Trinken | ✅ | — |
| Nahrung & Versorgung | ✅ | — |
| Werkzeuge & Verarbeitung | ✅ | — |
| Unterkunft & Schutz | ✅ | — |
| Feuer & Wärme | ✅ | — |
| Gesundheit & Medizin | ❌ | `knows_binding` |
| Jagd & Fallen | ❌ | `knows_basic_fire` |
| Lagerung & Ordnung | ❌ | `knows_fire` |

### Ideen nach Focus

**Unterkunft**
| Idee | Trigger-Materialien | Gibt |
|---|---|---|
| Palmendach | Palmblatt → Äste → Liane | `knows_basic_shelter` |
| Stabile Konstruktion | Holz → Liane (req: knows_basic_shelter) | `knows_construction` |

**Wasser**
| Idee | Trigger-Materialien | Gibt |
|---|---|---|
| Einfacher Regensammler | Kokosschale → Palmblatt | `knows_rain_collection` |
| Wasser abkochen | Wasser → Kokosschale (req: knows_fire) | `knows_preservation` |

**Werkzeuge**
| Idee | Trigger-Materialien | Gibt |
|---|---|---|
| Scharfer Stein | Feuerstein | `knows_sharp_edges` |
| Klinge und Griff | Gespl. Feuerstein → Faser (req: knows_sharp_edges) | `knows_tool_binding` |
| Holz im Feuer härten | Äste (req: knows_fire) | `knows_hardened_wood` |

**Feuer**
| Idee | Trigger-Materialien | Gibt |
|---|---|---|
| Lagerfeuerstelle | Kiesel → Äste | `knows_basic_fire` |

**Nahrung**
| Idee | Trigger-Materialien | Gibt |
|---|---|---|
| Kochen am Feuer | Beeren (req: knows_fire) | `knows_cooking` |
| Nahrung haltbar machen | Wildschweinfleisch → Kräuter (req: knows_cooking) | `knows_preservation` |

**Medizin**
| Idee | Trigger-Materialien | Gibt |
|---|---|---|
| Wunden versorgen | Kräuter → Palmblatt | `knows_medicine` |
| Fieber senken | Kräuter → Wasser (req: knows_medicine) | `knows_medicine` |

**Jagd**
| Idee | Trigger-Materialien | Gibt |
|---|---|---|
| Primitive Waffe | Gespl. Feuerstein → Äste (req: knows_sharp_edges) | `knows_basic_weapon` |
| Tiere beobachten | Wildschweinfell → Fleisch (req: knows_basic_weapon) | `knows_basic_weapon` |

**Lagerung**
| Idee | Trigger-Materialien | Gibt |
|---|---|---|
| Trockenes Vorratslager | Äste → Palmblatt → Liane | `knows_construction` |
| Räuchern | Holz → Wildschweinfleisch (req: knows_fire) | `knows_preservation` |

---

## Ressourcen

### Rohstoffe (sammelbar)

| Ressource | Fundort | Nachwächst | Sammeldauer |
|---|---|---|---|
| Holz | Wald | ✅ 2 min | 1,2 s |
| Äste | überall | ✅ 1 min | 0,5 s |
| Kiesel | überall | ✅ 2 min | 0,4 s |
| Feuerstein | Strand | ✅ 2 min | 0,6 s |
| Treibholz | Strand | ✅ 3 min | 0,7 s |
| Muscheln | Strand | ✅ 1,5 min | 0,3 s |
| Palmblatt | Strand/Palme | ✅ 2 min | 0,5 s |
| Faser | Wiese | ✅ 1,5 min | 0,5 s |
| Liane | Wald/Dschungel | ✅ 1,5 min | 0,6 s |
| Kräuter | Wiese | ✅ 2 min | 0,6 s |
| Pilze | Wald | ✅ 2,5 min | 0,7 s |
| Beeren | Wiese | ✅ 2,5 min | 0,8 s |
| Exotische Frucht | Dschungel | ✅ 20 min | 0,9 s |
| Stein | überall | ✅ 3 min | 2,0 s |
| Granit | Felsen | ✅ 10 min | 2,5 s |
| Obsidian | selten | ✅ 15 min | 3,0 s |
| Eisenerz | Felsen | ✅ 10 min | 3,0 s |
| Kokosnuss | Palme | ✅ 5 min | 1,2 s |
| Kokosschale | Palme | ✅ 3 min | 0,8 s |
| Baumharz | Harzbaum | ✅ 5 min | 2,0 s |
| Fisch | Wasser | ✅ 5 min | 1,5 s |
| Wasser | Quelle/Pfütze | ✅ | 0,5–0,8 s |

### Zwischenprodukte (nur durch Crafting)
| Ressource | Herstellung |
|---|---|
| Gesplitterter Feuerstein | Feuerstein absplittern |
| Gehärteter Ast | Ast in Feuer härten |
| Seil | Seil flechten |
| Holzbrett | Holz zu Brettern |
| Eisenbarren | Eisenerz einschmelzen |

### Tierdrops
| Ressource | Von |
|---|---|
| Wildschweinfleisch | Wildschwein |
| Wildschweinfell | Wildschwein |
| Schildkrötenfleisch | Schildkröte |
| Schildkrötenpanzer | Schildkröte |
| Krabbenfleisch | Krabbe |
| Knochen | Tiere allgemein |
| Tierhaut | Tiere allgemein |
| Tierfett | Tiere allgemein |

### Verarbeitete Nahrung
| Ressource | Verdirbt |
|---|---|
| Gekochtes Essen (Beeren) | ✅ |
| Gebratenes Wildschwein | ✅ |
| Gebratener Fisch | ✅ |
| Gek. Schildkröte | ✅ |
| Gek. Krabbe | ✅ |
| Gebratene Pilze | ✅ |
| Geräuchertes Fleisch | langsam |
| Getrockneter Fisch | langsam |
| Getrocknete Frucht | langsam |

### Medizin
| Ressource | Herstellung |
|---|---|
| Verband | Faser + Palmblatt |
| Fiebertee | Kräuter + Wasser (Lagerfeuer) |
| Parasitenmedizin | Kräuter + Baumharz |
| Kräutermittel | Kräuter |

---

## Crafting-Rezepte

### Tier 0 – Bloße Hände

| Rezept | Materialien | Benötigt | Gibt Skill-XP |
|---|---|---|---|
| Lagerfeuer | 5 Äste, 3 Kiesel | `knows_basic_fire` | +20 Überleben |
| Feuerstein absplittern | 1 Feuerstein, 1 Kiesel | `knows_sharp_edges` | +15 Handwerk |
| Ast in Feuer härten | 2 Äste | `knows_fire` + Lagerfeuer, Überleben Lv1 | +10 Handwerk |
| Feuersteinmesser | 1 ges. Feuerstein, 1 geh. Ast, 3 Faser | `knows_sharp_edges` + `knows_binding`, Handwerk Lv1 | +25 Handwerk |
| Palmendach | 8 Äste, 6 Palmblatt, 3 Lianen | `knows_basic_shelter` | +15 Bauen |
| Regensammler | 1 Kokosschale, 1 Palmblatt | `knows_rain_collection` | — |
| Kokosschale öffnen | 1 Kokosnuss | `knows_rain_collection` + Axt | — |
| Muschelklinge | 3 Muscheln, 1 Ast, 1 Faser | `knows_sharp_edges` | +8 Handwerk |
| Treibholz zerbrechen | 1 Treibholz | `knows_basic_fire` | — |
| Palmenblätter zerreißen | 3 Palmblätter | `knows_basic_shelter` | +5 Handwerk |
| Verband | 2 Faser, 1 Palmblatt | `knows_medicine` | +5 Naturkunde |

### Tier 1 – Erste Werkzeuge

| Rezept | Materialien | Benötigt | Gibt Skill-XP |
|---|---|---|---|
| Fackel | 2 Äste, 1 Seil, 2 Baumharz | `knows_fire` | — |
| Primitive Axt | 1 geh. Ast, 1 ges. Feuerstein, 3 Faser | `knows_tool_binding`, Handwerk Lv1 | +20 Handwerk |
| Steinspitzhacke | 2 Äste, 6 Kiesel | `knows_tool_binding` | +20 Handwerk |
| Steinspeer | 1 geh. Ast, 1 ges. Feuerstein, 2 Faser | `knows_hardened_wood` + `knows_sharp_edges`, Jagen Lv1 | +15 Jagen |
| Angelrute | 3 Äste, 1 Seil, 1 Liane | `knows_basic_weapon` + Messer | +10 Jagen |
| Seil flechten | 4 Faser, 2 Lianen | `knows_binding` + Messer | +10 Handwerk |
| Schildkrötenschale | 1 Schildkrötenpanzer, 2 Lianen | `knows_rain_collection` | +8 Bauen |
| Kräutermittel | 3 Kräuter | `knows_medicine` | +10 Naturkunde |
| Fiebertee | 2 Kräuter, 1 Wasser | `knows_medicine` + Lagerfeuer | +8 Naturkunde |
| Parasitenmedizin | 4 Kräuter, 1 Baumharz | `knows_medicine` | +12 Naturkunde |
| Gek. Essen (Beeren) | 2 Beeren | `knows_cooking` + Lagerfeuer | +10 Kochen |
| Geb. Pilze | 2 Pilze | `knows_cooking` + Lagerfeuer | +10 Kochen |
| Geb. Wildschwein | 2 Fleisch | `knows_cooking` + Lagerfeuer | +15 Kochen |
| Geb. Fisch | 2 Fisch | `knows_cooking` + Lagerfeuer | +12 Kochen |
| Geb. Krabbe | 2 Krabbenfleisch | `knows_cooking` + Lagerfeuer | +10 Kochen |
| Gek. Schildkröte | 2 Schildkrötenfleisch | `knows_cooking` + Lagerfeuer | +10 Kochen |
| Fleisch räuchern | 2 Fleisch, 2 Äste | `knows_preservation` + Lagerfeuer | — |
| Fisch trocknen | 2 Fisch | `knows_preservation` + Lagerfeuer | — |
| Früchte trocknen | 2 Früchte | `knows_preservation` + Lagerfeuer | — |

### Tier 2 – Konstruktion

| Rezept | Materialien | Benötigt | Gibt Skill-XP |
|---|---|---|---|
| Holzunterkunft | 20 Holz, 5 Stein | `knows_construction` + Steinaxt | +20 Bauen |
| Lagerbox | 8 Holz, 2 Seil | `knows_construction` + Steinaxt | — |
| Werkbank | 15 Holz, 10 Stein | `knows_construction` + Steinaxt | — |
| Verbesserte Axt | 5 Holz, 10 Stein | `knows_construction` + Steinaxt | — |
| Verb. Spitzhacke | 5 Holz, 12 Stein | `knows_construction` + Spitzhacke | — |
| Obsidianklinge | — | `knows_sharp_edges`, Handwerk Lv3 | +30 Handwerk |
| Granitfundament | — | `knows_construction` + Spitzhacke | — |
| Granit-Feuerstelle | — | `knows_fire` + Spitzhacke | +15 Überleben |
| Holz → Äste | 1 Holz | — + Steinaxt | — |

### Tier 3 – Werkbank

| Rezept | Materialien | Benötigt |
|---|---|---|
| Holzbretter | 10 Holz | `knows_construction` + Werkbank |
| Blockhütte | — | `knows_construction` + Werkbank |
| Bett | 8 Bretter, 10 Palmblätter | `knows_construction` + Werkbank |

### Tier 4 – Spätes Spiel

| Rezept | Materialien | Benötigt |
|---|---|---|
| Ackerbeet | 10 Bretter, 5 Stein | `knows_construction` + Werkbank |
| Schmelzofen | 20 Holz, 15 Stein, 10 Bretter | `knows_metal` + Werkbank |
| Eisenbarren | 3 Eisenerz, 5 Holz | `knows_metal` + Schmelzofen |
| Eisenaxt | 1 Barren, 3 Bretter | `knows_metal` + Schmelzofen |
| Eisenspitzhacke | 1 Barren, 3 Bretter | `knows_metal` + Schmelzofen |

---

## Baustrukturen (BuildMenu)

### Überleben / Basis

| Struktur | Materialien | Skill | Knowledge | Besonderheiten |
|---|---|---|---|---|
| Ablageplatz | — | — | `knows_basic_storage` | Kein Schutz, Tiere stehlen, Sturm verstreut |
| Schlafplatz | 4 Palmblätter | — | `knows_basic_rest` | Gesundheitsmalus, schlechte Erholung |

### Feuer

| Struktur | Materialien | Skill | Knowledge |
|---|---|---|---|
| Lagerfeuerstelle | 5 Äste, 3 Kiesel, 1 Feuerstein | Überleben Lv1 | `knows_basic_fire` |
| Granit-Feuerstelle | 6 Granit, 4 Äste | Überleben Lv2 | `knows_fire` |
| Fackelhalter | — | — | `knows_fire` |

### Unterkunft

| Struktur | Materialien | Skill | Knowledge |
|---|---|---|---|
| Palmendach | 8 Äste, 6 Palmblatt, 3 Lianen | Bauen Lv1 | `knows_basic_shelter` |
| Holzunterkunft | 20 Holz, 5 Stein | Bauen Lv2 + Handwerk Lv1 | `knows_construction` |
| Blockhütte | 40 Holz, 20 Stein, 10 Bretter | Bauen Lv3 + Handwerk Lv3 | `knows_construction` |
| Bett | 8 Bretter, 10 Palmblätter | Bauen Lv3 + Handwerk Lv3 | `knows_construction` |

### Wasser / Nahrung

| Struktur | Materialien | Skill | Knowledge |
|---|---|---|---|
| Einfacher Regensammler | 1 Kokosschale, 1 Palmblatt | — | `knows_rain_collection` |
| Trockengestell | 6 Äste, 2 Seil | Kochen Lv2 | `knows_preservation` |
| Räucherstelle | — | Überleben Lv3 + Kochen Lv2 | `knows_preservation` + `knows_fire` |
| Kräutergestell | 4 Äste, 2 Lianen | Naturkunde Lv2 | `knows_medicine` |
| Ackerbeet | 10 Bretter, 5 Stein | Naturkunde Lv3 | `knows_construction` |

### Werkstatt / Lager

| Struktur | Materialien | Skill | Knowledge |
|---|---|---|---|
| Lagerbox | 8 Holz, 2 Seil | Handwerk Lv2 | `knows_construction` |
| Werkbank | 15 Holz, 10 Stein | Handwerk Lv2 | `knows_construction` |
| Schmelzofen | — | Überleben Lv4 + Handwerk Lv4 | `knows_metal` + `knows_fire` |

### Jagd

| Struktur | Materialien | Skill | Knowledge |
|---|---|---|---|
| Schlinge | 2 Seil, 3 Äste | Jagen Lv2 | `knows_basic_weapon` |

---

## Spielerprogression – roter Faden

```
TAG 1 — Strandankunft
  → Kiesel aufheben → knows_basic_fire
  → Feuerstein aufheben → knows_sharp_edges
  → Faser aufheben → knows_binding
  → Lagerfeuer bauen (5 Äste, 3 Kiesel, 1 Feuerstein)
  → Palmblätter für Schlafplatz (4 Stück)

NACHT 1 — Erste Nacht
  → Schlafen (ggf. Grübeln: Feuer/Unterkunft/Werkzeuge)
  → Bei Regen: knows_basic_shelter freigeschaltet

TAG 2 — Werkzeuge
  → Feuerstein absplittern → sharp_flint
  → Ast in Feuer härten → hardened_stick
  → Feuersteinmesser bauen (braucht beide)
  → Palmendach bauen → knows_construction

TAG 3 — Nahrung & Wasser
  → Steinaxt / Steinspeer
  → Kochen lernen (Grübeln: Nahrung)
  → Regensammler / Wasserversorgung

WOCHE 1 — Basis aufbauen
  → Holzunterkunft
  → Lagerbox, Werkbank
  → Konservierung lernen

LANGFRISTIG
  → Blockhütte, Schmelzofen, Eisenwerkzeuge
  → Medizin, Jagd, Farming
```

---

## Was noch fehlt / geplant

| Bereich | Status |
|---|---|
| Medizin-Skill aktiv nutzen | ⏳ nur als Wissens-Gate, keine Skill-Boni |
| Körperbeherrschung-Mechaniken | ⏳ kein XP-Pfad, kein Spieleinfluss |
| Tiere stehlen vom Ablageplatz | ⏳ Beschreibung vorhanden, Mechanik fehlt |
| Sturm verstreut Gegenstände | ⏳ Beschreibung vorhanden, Mechanik fehlt |
| Wildschweinfall / Wildschweinhaut | ⏳ Haut als Ressource nicht genutzt |
| Angelrute-Mechanik | ⏳ im Rezept, Spiellogik unklar |
| Ackerbeet-Mechanik | ⏳ Struktur baubar, kein Farming-Loop |
| Spielziel / Endgame | ❌ fehlt komplett |
| Knochen / Tierhaut / Tierfett | ❌ Ressourcen vorhanden, keine Rezepte |
| Bambus / Pandanus / Kautschuk / Kakao | ❌ Baumtypen ohne Funktion |
