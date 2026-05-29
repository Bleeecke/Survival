# Survival Game – Komplette Spielwerte-Referenz

> **Zeitrechnung:** 1 Spieltag = 10 Minuten Echtzeit  
> `DAY_DURATION_MS = 600_000 ms`

---

## RESSOURCEN & SAMMELN

### Sammelbare Ressourcen nach Biom

| Ressource | Icon | Biom | Werkzeug | Sammeldauer | Max. Stapel | Regeneration |
|---|---|---|---|---|---|---|
| Holz | 🪵 | Wald, Dschungel | **Axt** | 1,2s | 99 | 2 min |
| Stein | 🪨 | Berg, Hügel | **Spitzhacke** | 2s | 50 | 3 min |
| Eisenerz | 🟤 | Berg, Hügel | **Spitzhacke** | 3s | 30 | 10 min |
| Obsidian | ⬛ | Berg (Cluster) | **Spitzhacke** | 3s | 10 | 15 min |
| Granit | 🩶 | Berg, Hügel (Cluster) | **Spitzhacke** | 2,5s | 30 | 10 min |
| Feuerstein | 🔶 | Strand, Hügel | — | 0,6s | 50 | 2 min |
| Bruchstein | ⚪ | (überall) | — | 0,4s | 99 | 2 min |
| Treibholz | 🪵 | Strand | — | 0,7s | 40 | 3 min |
| Muscheln | 🐚 | Strand | — | 0,3s | 60 | 1,5 min |
| Kokosnuss | 🥥 | Strand | — | — | 2 | — |
| Äste | 🌿 | Strand, Wiese | — | 0,5s | 99 | 1 min |
| Fasern | 🌾 | Wiese, Gras | **Messer** | 0,5s | 60 | 1,5 min |
| Kräuter | 🌿 | Wiese, Gras, Lichtwald | — | 0,6s | 30 | 2 min |
| Lianen | 🌿 | Dschungel, Wald | **Messer** | 0,6s | 40 | 1,5 min |
| Pilze | 🍄 | Wald, Dschungel | — | 0,7s | 20 | 2,5 min |
| Exotische Frucht | 🍊 | Dichter Dschungel | — | 0,9s | 15 | 20 min |
| Beeren | 🫐 | Wiese, Lichtwald | — | 0,8s | 30 | 2,5 min |
| Wasser (Quelle) | 💧 | — | — | 0,8s | 50 | 10s |
| Pfütze | 💧 | — | — | 0,6s | 3 | — |
| Fisch | 🐟 | Wasser | **Angel oder Speer** | 1,5s | 20 | 5 min |
| Palme (Blätter) | 🌴 | Strand | — | — | 5 | **30 min** |
| Palme (Holz hacken) | 🌴 | Strand | **Axt** | — | — | — |
| Baumharz | 🫙 | Harzbaum | — (Kokosschale nötig) | 2s | 20 | 5 min |

### Spezielle Sammel-Aktionen

| Aktion | Voraussetzung | Ergebnis |
|---|---|---|
| Palme – Blätter | — | 1× Palmenblatt (qty sinkt, wächst nach) |
| Palme – Äste | Axt ausgerüstet | 1× Äste (Bonus-Option) |
| Palme – Kokosnuss | Axt im Inventar | 1× Kokosnuss |
| Palme – Holz hacken | Axt ausgerüstet | 3–5× Holz, Baum weg |
| Harzbaum | 1× Kokosschale verbraucht | 1× Baumharz |
| Quelle/Pfütze | — | 1× Wasser (direkt trinken möglich: Durst -25) |

### Tier-Drops (beim Töten)

| Tier | Drops |
|---|---|
| Wildschwein | Wildschweinfleisch, Knochen, Tierhaut, Tierfett |
| Schildkröte | Schildkrötenfleisch, Schildkrötenpanzer |
| Krabbe | Krabbenfleisch |
| Fisch (Angel) | Fisch |
| Fisch (Speer) | Fisch (40% Erfolgsrate) |

---

## CRAFTING-REZEPTE

> **Zeitmessung:** 1 Spielminute ≈ 416 ms Echtzeit (DAY / 24 / 60)

### TIER 0 – Bloße Hände

| Name | Icon | Materialien | Ergebnis | Zeit | Werkzeug | Skill-XP |
|---|---|---|---|---|---|---|
| Lagerfeuer | 🔥 | Äste ×5, Bruchstein ×3 | Lagerfeuer | 3s | — | Feuermachen +20 |
| Feuerstein absplittern | 🪨 | Feuerstein ×1, Bruchstein ×1 | Gesp. Feuerstein ×1 | 3s | — | Feuersteinklopfen +15 ⚠️ 30% Schnittrisiko |
| Ast in Feuer härten | 🌿 | Äste ×2 | Gehärteter Ast ×1 | 4s | Lagerfeuer nötig | Holzbearbeitung +10 |
| Feuersteinmesser | 🔪 | Gesp. Feuerstein ×1, Gehärt. Ast ×1, Fasern ×3 | Feuersteinmesser | 5s | Feuersteinklopfen Stufe 1 | Feuersteinklopfen +25 |
| Muschelklinge | 🐚 | Muscheln ×3, Äste ×1, Fasern ×1 | Muschelklinge | 2s | — | Feuersteinklopfen +8 |
| Verband | 🩹 | Fasern ×2, Palmenblatt ×1 | Verband ×1 | 2s | — | Sammeln +5 |
| Treibholz zerbrechen | 🪵 | Treibholz ×1 | Äste ×2 | 2s | — | — |
| Palmenblätter zerreißen | 🌿 | Palmenblatt ×3 | Fasern ×1 | 4s | — | Kordel +5 |
| Palmendach | 🌴 | Äste ×8, Palmenblatt ×6, Lianen ×3 | Palmendach | 3s | — | Unterkunftsbau +15 |
| Regensammler | 🥥 | Kokosschale ×1, Palmenblatt ×1 | Regensammler | 2s | — | — |
| Kokosnuss öffnen | 🥥 | Kokosnuss ×1 | Kokosschale ×2 | 1,5s | Axt | — |

### TIER 1 – Einfache Werkzeuge

| Name | Icon | Materialien | Ergebnis | Zeit | Werkzeug | Skill-XP |
|---|---|---|---|---|---|---|
| Steinaxt | 🪓 | Äste ×2, Bruchstein ×5 | Steinaxt | 4s | — | Holzbearbeitung +20 |
| Steinspitzhacke | ⛏️ | Äste ×2, Bruchstein ×6 | Steinspitzhacke | 5s | — | Feuersteinklopfen +20 |
| Steinspeer | 🗡️ | Äste ×4, Bruchstein ×3 | Steinspeer | 4s | — | Jagen +15 |
| Angelrute | 🎣 | Äste ×3, Seil ×1, Lianen ×1 | Angelrute | 4s | Messer | Jagen +10 |
| Fackel | 🔦 | Äste ×2, Seil ×1, Baumharz ×2 | Fackel ×2 | 3s | — | — |
| Seil flechten | 🪢 | Fasern ×4, Lianen ×2 | Seil ×2 | 3s | Messer | Kordel +5 |
| Schildkrötenschale | 🐢 | Schildkrötenpanzer ×1, Lianen ×2 | Regensammler | 3s | — | Unterkunftsbau +8 |
| Gekochtes Essen | 🍖 | Beeren ×2 | Gekochtes Essen ×2 | 3s | Lagerfeuer | Kochen +10 |
| Gebratene Pilze | 🥘 | Pilze ×2 | Gebratene Pilze ×2 | 2,5s | Lagerfeuer | Kochen +10 |
| Gekochte Schildkröte | 🐢 | Schildkrötenfleisch ×2 | Gek. Schildkröte ×2 | 6s | Lagerfeuer | — |
| Gebr. Wildschwein | 🥩 | Wildschweinfleisch ×2 | Gek. Wildschwein ×2 | 5s | Lagerfeuer | — |
| Gekochte Krabbe | 🦀 | Krabbenfleisch ×2 | Gek. Krabbe ×2 | 4s | Lagerfeuer | — |
| Gebratener Fisch | 🐟 | Fisch ×2 | Gebratener Fisch ×2 | 4s | Lagerfeuer | — |
| Kräutermittel | 🌿 | Kräuter ×3 | Kräutermittel | 2s | — | Sammeln +10 |
| Fiebertee | 🍵 | Kräuter ×2, Wasser ×1 | Fiebertee | 3s | Lagerfeuer | Sammeln +8 |
| Parasitenmedizin | 🧪 | Kräuter ×4, Baumharz ×1 | Parasitenmedizin | 4s | — | Sammeln +12 |
| Fleisch räuchern | 🥩 | Wildschweinfleisch ×2, Äste ×2 | Geräuch. Fleisch ×2 | 8s | Lagerfeuer | Kochen +15 |
| Fisch trocknen | 🐟 | Fisch ×2 | Getr. Fisch ×2 | 10s | Lagerfeuer | Kochen +12 |
| Früchte trocknen | 🍊 | Exotische Frucht ×2 | Getr. Frucht ×3 | 8s | Lagerfeuer | Kochen +10 |

### TIER 2 – Steinwerkzeuge

| Name | Icon | Materialien | Ergebnis | Zeit | Werkzeug | Skill-XP |
|---|---|---|---|---|---|---|
| Verbesserte Axt | 🪓 | Holz ×5, Stein ×10 | Verb. Axt | 8s | Steinaxt | Holzbearbeitung +20 |
| Verbesserte Spitzhacke | ⛏️ | Holz ×5, Stein ×12 | Verb. Spitzhacke | 8s | Steinspitzhacke | — |
| Holzunterkunft | 🏠 | Holz ×20, Stein ×5 | Holzunterkunft | 8s | Steinaxt | — |
| Lagerbox | 📦 | Holz ×8, Seil ×2 | Lagerbox | 5s | Steinaxt | — |
| Werkbank | 🪚 | Holz ×15, Stein ×10 | Werkbank | 6s | Steinaxt | — |
| Holz zu Ästen | 🌿 | Holz ×1 | Äste ×3 | 2s | Steinaxt | — |
| Obsidianklinge | 🗡️ | Obsidian ×2, Gehärt. Ast ×1, Fasern ×3 | Feuersteinmesser | 6s | Feuersteinklopfen Stufe 3 | Feuersteinklopfen +30 |
| Granitfundament | 🪨 | Granit ×5, Stein ×3 | Stein ×8 | 5s | Steinspitzhacke | Unterkunftsbau +20 |
| Granit-Feuerstelle | 🔥 | Granit ×6, Äste ×4 | Lagerfeuer | 6s | Steinspitzhacke | Feuermachen +15 |

### TIER 3 – Werkbank

| Name | Icon | Materialien | Ergebnis | Zeit |
|---|---|---|---|---|
| Holzbretter | 🪵 | Holz ×10 | Bretter ×5 | 4s |
| Blockhütte | 🏡 | Holz ×40, Stein ×20, Bretter ×10 | Blockhütte | 20s |
| Bett | 🛏️ | Bretter ×8, Palmenblatt ×10 | Bett | 6s |
| Ackerbeet | 🌾 | Bretter ×10, Stein ×5 | Ackerbeet | 10s |
| Schmelzofen | 🏭 | Holz ×20, Stein ×15, Bretter ×10 | Schmelzofen | 15s |

### TIER 4 – Schmelzofen

| Name | Icon | Materialien | Ergebnis | Zeit |
|---|---|---|---|---|
| Eisenbarren | 🔩 | Eisenerz ×3, Holz ×5 | Eisenbarren | 15s |
| Eisenaxt | 🪓 | Eisenbarren ×1, Bretter ×3 | Eisenaxt | 10s |
| Eisenspitzhacke | ⛏️ | Eisenbarren ×1, Bretter ×3 | Eisenspitzhacke | 10s |

---

## NAHRUNG & EFFEKTE

| Item | Hunger | Durst | HP | Ausdauer | Sonstiges |
|---|---|---|---|---|---|
| Beeren (roh) | −25 | −8 | — | — | — |
| Gekochtes Essen | −55 | — | +15 | — | — |
| Pilze (roh) | −20 | — | +5 | — | — |
| Gebratene Pilze | −40 | — | +12 | — | — |
| Exotische Frucht | −50 | −15 | +8 | +20 | — |
| Fisch (roh) | — | — | — | — | ⚠️ verdirbt schnell |
| Gebratener Fisch | −70 | — | +20 | — | — |
| Wildschweinfleisch (roh) | −30 | — | — | — | ⚠️ Vergiftung, 35% Parasiten |
| Gek. Wildschwein | −55 | — | +15 | +20 | — |
| Krabbenfleisch (roh) | −20 | — | +3 | — | — |
| Gek. Krabbe | −55 | — | +18 | +15 | — |
| Schildkrötenfleisch (roh) | −30 | — | — | — | ⚠️ Vergiftung, 35% Parasiten |
| Gek. Schildkröte | −65 | — | +20 | — | — |
| Geräuch. Fleisch | −45 | — | +10 | +15 | hält 7 Spieltage |
| Getr. Fisch | −35 | — | +8 | +10 | hält 7 Spieltage |
| Getr. Frucht | −25 | — | +5 | — | hält 10 Spieltage |
| Wasser | — | −30 | — | +10 | — |
| Kokoswasser | — | −20 | — | — | beim Öffnen |

### Haltbarkeit (Verderb)

| Kategorie | Item | Haltbarkeit |
|---|---|---|
| Rohes Fleisch | Fisch, Wildschwein, Schildkröte, Krabbe | **0,5 Tage** (5 min) |
| Rohe Früchte | Beeren | 1 Tag (10 min) |
| | Pilze | 1,5 Tage |
| | Exotische Frucht | 2 Tage |
| Gekochtes | Gekochtes Essen, Pilze | 2 Tage |
| | Gebratener Fisch, Krabbe, Schildkröte | 1,5 Tage |
| Konserviert | Geräuchertes Fleisch, Getr. Fisch | **7 Tage** |
| | Getrocknete Frucht | **10 Tage** |
| Medizin | Kräutermittel | 4 Tage |

---

## MEDIZIN & HEILUNG

| Item | Effekt |
|---|---|
| Verband | Blutung stoppen, Wunde heilen, HP +5 |
| Kräutermittel | HP +35, Müdigkeit −10, heilt Vergiftung & Wunde |
| Fiebertee | HP +10, heilt Erkältung & Fieber |
| Parasitenmedizin | heilt Parasiten, HP +5 |

---

## KRANKHEITEN & VERLETZUNGEN

### Verletzungen

| Typ | Auslöser | Dauer | HP-Verlust/Tick | Weitere Malus |
|---|---|---|---|---|
| Schnittwunde | Feuerstein klopfen (30% Chance) | **15 min Echtzeit** | 0,004/100ms | Ausdauerregen ×0,5, Geschwindigkeit −10% |
| Blutung | Wildschwein-Angriff (40% Chance) | **8 min Echtzeit** | **0,018/100ms** (~108 HP/Tag!) | Geschwindigkeit −15% |

### Krankheiten

| Krankheit | Auslöser | Dauer | Drain pro Tick |
|---|---|---|---|
| Erkältung 🤧 | 5 min Echtzeit im Regen | 10 min | HP −0,004, Durst −0,002 |
| Fieber 🌡️ | Erkältung unbehandelt (~30 min Chance) | 15 min | HP −0,010, Durst −0,006 |
| Parasiten 🦠 | Rohfleisch essen (35% Chance) | 20 min | HP −0,006, Hunger −0,005 |
| Vergiftung ☠️ | Rohfleisch (Wildschwein/Schildkröte) | 3 min | HP −0,025 |

---

## SCHLAFEN

> **Schlafen öffnet:** E-Taste am Boden

### Schlaf-Qualität

| Ort | Müdigkeit/Stunde | HP-Effekt | Ausdauer |
|---|---|---|---|
| 🌿 Draußen | −11 (min. 10) | −1 HP pro Stunde | +8/Stunde |
| ⛺ Palmendach | −12 (min. 5) | kein Verlust | +8/Stunde |
| 🏠 Unterkunft/Hütte | −13 (min. 0) | +10 HP bei ≥8h | +8/Stunde |

### Sonstiges beim Schlafen

- **Hunger:** +1,5 pro Spielstunde
- **Durst:** +2,0 pro Spielstunde
- Wählbare Stunden: 2, 4, 6, 8, 10

### Müdigkeitsstufen & Folgen

| Stufe | Schwellwert | Bezeichnung | Effekte |
|---|---|---|---|
| 0 | 0–20 | Ausgeruht | Normal |
| 1 | 21–45 | Müdigkeit setzt ein | — |
| 2 | 46–65 | Müde | Blurfilter auf dem Canvas |
| 3 | 66–80 | Erschöpft | Stärkeres Blur |
| 4 | 81–92 | Übermüdet | Sekundenschlaf-Blinkeffekt alle ~8s |
| 5 | 93–100 | 💤 Kollaps | Maximales Blur |

---

## FÄHIGKEITEN (SKILLS)

> Level 1–10, XP-Formel: `XP für nächstes Level = aktuelles_Level × 20`

| Skill | Bezeichnung | XP durch Sammeln | XP durch Crafting |
|---|---|---|---|
| 🪨 Feuersteinklopfen | Flintknapping | — | Klopfen +15, Messer +25, Steinspitzhacke +20, Obsidianklinge +30 |
| 🪵 Holzbearbeitung | Woodworking | Holz +5 | Steinaxt +20, Verb. Axt +20, Ast härten +10 |
| 🧵 Kordel & Seile | Cordage | Fasern +5, Lianen +5 | Palmenblatt zerreißen +5, Seil +5 |
| 🔥 Feuermachen | Firemaking | — | Lagerfeuer +20, Granit-Feuerstelle +15 |
| 🌿 Sammeln | Foraging | Kräuter +8, Pilze +6, Exot. Frucht +8, Beeren +4 | Kräutermittel +10, Fiebertee +8, Parasitenmedizin +12, Verband +5 |
| 🍖 Kochen | Cooking | — | Gekochtes Essen +10, Pilze +10, Räuchern +15, Fisch trocknen +12 |
| 🗡️ Jagen | Hunting | Fisch +6, Wildschwein +10, Schildkröte +8, Krabbe +6 | Steinspeer +15, Angelrute +10 |
| 🏠 Unterkunftsbau | Shelterbuilding | — | Palmendach +15, Schildkrötenschale +8, Granitfundament +20 |

### Level-Bezeichnungen

| Level | Titel |
|---|---|
| 1–2 | Anfänger |
| 3–4 | Lehrling |
| 5–6 | Geübt |
| 7–8 | Erfahren |
| 9 | Experte |
| 10 | Meister |

### Skill-Effekte auf Crafting

- **Effektive Craftzeit:** `Basis × (1 − (Level−1) × 0.05)` → max. 45% schneller bei Level 10
- **Feuersteinklopfen Stufe 1** erforderlich für: Feuersteinmesser
- **Feuersteinklopfen Stufe 3** erforderlich für: Obsidianklinge
- **Feuermachen Stufe 1** erforderlich für: Ast härten
- **Knap-Erfolg:** Basiswert 35% + 6% pro Level (Level 1 = 41%, Level 10 = 89%)

---

## LAGERFEUER

### Brennstoff

| Material | Brenndauer |
|---|---|
| Äste (sticks) | +1 Tag |
| Treibholz (driftwood) | +2 Tage |
| Holz (wood) | +3 Tage |

### Kochen am Lagerfeuer (CampfireModal)

| Item | Kochzeit (Spielzeit) |
|---|---|
| Pilze | 20 Spielminuten (~8,3s real) |
| Krabbe | 30 Spielminuten (~12,5s real) |
| Fisch | 40 Spielminuten (~16,7s real) |
| Schildkröte | 50 Spielminuten (~20,8s real) |

---

## WERKZEUGE & BONUS

| Werkzeug | Kategorie | Besonderheit |
|---|---|---|
| Muschelklinge | Messer | primitiv, zerbrechlich |
| Feuersteinmesser | Messer | Standardmesser |
| Steinaxt | Axt | Holz hacken, Palme fällen |
| Verbesserte Axt | Axt | 3× Holzertrag |
| Eisenaxt | Axt | 5× Holzertrag |
| Steinspitzhacke | Spitzhacke | Stein/Erz abbauen |
| Verbesserte Spitzhacke | Spitzhacke | 3× Steinertrag |
| Eisenspitzhacke | Spitzhacke | 5× Steinertrag |
| Steinspeer | Waffe/Jagd | Nahkampf + Speerfischen (40% Erfolg) |
| Angelrute | Jagd | Fischen |
| Fackel | Licht | +3 Sichtweite |

### Speerwerfen / Speerfischen

- Fisch mit Steinspeer: **40% Erfolgsrate**, verbraucht Ausdauer, beschädigt den Speer

---

## GEWICHTE (Traglast)

> Max. Traglast: `MAX_CARRY_KG` (im Code definiert)

Schwerere Items verlangsamen den Spieler. Werkzeuge und Erze wiegen am meisten.

---

## SPIELWELT

| Parameter | Wert |
|---|---|
| Weltgröße | 250 × 250 Kacheln |
| Kachelgröße | 32px |
| Startposition | X=125, Y=210 |
| Spieltag | 10 Minuten Echtzeit |
| 1 Spielstunde | ~25 Sekunden Echtzeit |
