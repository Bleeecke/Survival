# Inselgenerator und Einstellungen

Stand: 2026-09-09. Generator **Version 2** ist für neue Spiele aktiv.

## Im Spiel

Im Hauptmenü **„Insel anpassen“** öffnen, ein Landschaftsprofil wählen und bei Bedarf die Regler ändern. Ein leerer Seed erzeugt eine zufällige Insel. Mit demselben Seed und identischen Einstellungen lässt sich eine Insel wieder erzeugen. Die eigentliche Erzeugung startet über den vorhandenen New-Game-Button. „Continue“ behält die gespeicherte Insel.

Profile: **Sanft** mit breiteren Stränden und ruhigeren Geländeformen, **Ausgewogen** als Standard und **Rau** mit schmaleren Stränden und mehr Hochland. Die Profile sind Landschaftsvorgaben, keine vollständigen Schwierigkeitsstufen für Hunger, Wetter oder Crafting.

Ungültige Einstellungen werden vor dem Zurücksetzen des bisherigen Spielstands abgefangen. Die Regler geben keine Orte von Ressourcen oder unbekannten Rezepten preis. Die vollständigen Karten unten sind separate Entwicklungsartefakte.

## Zentrale Stellschrauben

Standardwerte und gültige Bereiche: [`src/data/islandConfig.ts`](src/data/islandConfig.ts).

| Attribut | Standard | Wirkung / Grenze |
|---|---:|---|
| `landFraction` | 0.58 | Zielanteil Land vor Randbegrenzung und Entfernen abgetrennter Landstücke. Der tatsächliche Anteil kann niedriger liegen. |
| `coastRoughness` | 0.35 | Stärke kleiner Buchten/Landzungen; eine gröbere, vom Seed abhängige Grundform bleibt auch bei 0 erhalten. |
| `beachWidth` | 4 | Strandbreite als kürzeste Entfernung zum Wasser in waagerechten/senkrechten Feldern. Kein Höhen-Schwellenwert mehr. |
| `terrainRoughness` | 0.42 | Stärke feiner Details im Höhenfeld. |
| `plateauSize` | 8 | Glättungsdurchmesser der Höhenformen. Größer bedeutet weniger kleine Konturen, nicht exakt acht Felder große Plateaus. |
| `plateauFraction` | 0.30 | Zielanteil der zweiten Höhenstufe am Inland; im Code einstellbar. |
| `mountainFraction` | 0.18 | Zielanteil von Hochland/Gipfeln am Inland. Etwa 15 % davon werden der höchsten Stufe zugeteilt. Nachbearbeitung kann Anteile leicht ändern. |
| `vegetationDensity` | 0.8 | Multiplikator für Pflanzen, Bäume, zugehörige Streuressourcen und große Bäume. Erz, Steine und garantierte Startressourcen bleiben davon ausgenommen. |
| `rampSpacing` | 22 | Mindestabstand automatisch verteilter Aufgänge. Die Erreichbarkeitskorrektur darf zusätzliche, näher liegende Verbindungen setzen. |
| `mountainRidges` | 2 | Anzahl zusätzlicher Gebirgsrücken. Ohne Rücken entstehen weiterhin Höhen aus dem Grundfeld. |
| `ridgeStrength` / `ridgeWidth` | 0.32 / 18 | Stärke und Breite dieser Rücken im internen 257 × 257-Höhenfeld. |
| `moistureScale` / `rockScale` | 30 / 24 | Räumliche Größe von Feuchtigkeits- bzw. felsigen Zonen. |
| `debugOreBlock` | false | Aktiviert ausdrücklich den früher immer erzeugten Erz-Testblock nahe dem Start. Kein normaler Spielregler. |

Die acht wichtigsten Einstellungen sind im Hauptmenü verfügbar. `ISLAND_RANGES` ist die gemeinsame Grundlage für Validierung und Reglergrenzen. Der Seed ist unabhängig vom Profil.

Die Karte bleibt **250 × 250 Felder**, mit 32 Pixeln je Feld. Diese technischen Größen stehen weiter in `worldConfig.ts`; freie Kartengrößen sind wegen weiterer fester Weltgrenzen im Spiel nicht Teil dieser Änderung. Nicht unterstützte Größen in Spielständen werden nicht stillschweigend neu skaliert.

## Ressourcenverteilung

- [`worldConfig.ts`](src/data/worldConfig.ts): Einzelvorkommen mit `frequency`, `spawnOn`, `minQuantity`, `maxQuantity`.
- [`islandResources.ts`](src/data/islandResources.ts): Gruppen mit Anzahl, Radius, Dichte und Mindestabstand zum Start; zusätzlich große Bäume und weitere Stöcke.
- Häufigkeiten gelten pro geeignetem Feld bzw. Platzierungsversuch, nicht als garantierte Anzahl von Vorkommen. Biome, Abstand und bereits belegte Plätze begrenzen die tatsächlichen Mengen.
- Zwei Feuerstein-Vorkommen und mindestens ein Kiesel-Vorkommen werden im über Gelände erreichbaren Bereich von höchstens 14 Schritten zum Start sichergestellt. Neue Garantievorkommen liegen mindestens fünf Schritte entfernt; vorhandene nähere Vorkommen zählen mit. Andere Ressourcenplätze werden dafür nicht überschrieben.
- Die unmittelbaren neun Felder um den Start werden von Ressourcen freigehalten. Wasser am Start wird nicht mehr zu einer künstlichen rechteckigen Strandfläche umgewandelt.

## Ablauf

1. Seed und Einstellungen prüfen.
2. Höhenfeld mit regelbarer Feinheit und Gebirgsrücken erzeugen. Ein Rücken hebt jede betroffene Stelle einmal nach ihrem Abstand an; die frühere wiederholte Aufsummierung entlang seiner Abtastpunkte entfällt.
3. Grundform mit Küstenvariation kombinieren, Land-Zielwert anwenden und nur die zusammenhängende Hauptinsel behalten. Küstenvariation läuft am Kartenrand aus.
4. Entfernung zum Wasser bestimmt den Strand. Geglättete Inlandshöhen und Zielanteile bestimmen die Höhenstufen; Feuchtigkeit und Felsigkeit bestimmen die Biome.
5. Höhenübergänge auf benachbarte Stufen begrenzen, Start suchen und Rampen in allen vier Richtungen verteilen.
6. Erreichbarkeit mit denselben Höhenregeln wie die Bewegung prüfen. Zusätzliche Rampen verbinden Regionen; seltene, von unpassierbaren Gipfeln eingeschlossene Taschen erhalten einen kurzen Gebirgspass.
7. Ressourcen, Baumgruppen, Wasserstellen, Startgarantien und Wrack erzeugen.

`plateauSize` legt keine konkrete Zahl von Plateaus fest. Große, zusammenhängende Landschaftsformen werden jetzt gezielt begünstigt; ein späteres System mit ausdrücklich platzierten „zwei Plateaus plus einem Bergmassiv“ wäre eine weitere Generatorversion.

## Gespeicherte Inseln

Neue Spielstände enthalten `generation.version = 2` und eine Kopie aller aufgelösten `IslandSettings`. Neue Standardwerte ändern dadurch keine bereits gespeicherte Insel. `restoreWorld.ts` stellt die passende Karte wieder her und übernimmt verbrauchte Ressourcen, Bauten, abgelegte Gegenstände samt Zustand und den gespeicherten Startpunkt.

Spielstände ohne Versionsangabe verwenden die eingefrorene `LegacyWorldGenerator.ts`. Deren Höhenkarte wurde für Seed 42 gegen einen vor der Änderung aufgenommenen SHA-256-Wert geprüft. Diese Datei nicht zum Abstimmen neuer Inseln bearbeiten. Unbekannte Versionen und unvollständige Einstellungen werden abgelehnt, statt eine andere Insel unter den gespeicherten Objekten zu erzeugen.

**Für weitere Agenten:** Änderungen an V2-Algorithmen, festen Formeln oder der Biomeinteilung können trotz gleichem Seed andere Gelände erzeugen. Für solche späteren Änderungen eine neue Generatorversion anlegen und den bisherigen Wiederherstellungspfad erhalten. Änderungen an Standardwerten allein benötigen das nicht, da aufgelöste Werte gespeichert werden. Ressourcen-Balanceänderungen gelten für neu erzeugte Vorkommen; gespeicherte Ressourcen werden beim Laden übernommen.

## Vergleich und Prüfstand

**39 Tests und TypeScript-/Vite-Build bestanden.** ESLint besteht für die neuen Generator-/Konfigurationsmodule und beide geänderten Menükomponenten; dies ist kein projektweiter Lint-Lauf.

```powershell
npm run islands:compare
npm run islands:compare -- 42 137 2026
npm test
npm run build
```

[Vergleichskarte](artifacts/islands/comparison.png) · [SVG](artifacts/islands/comparison.svg) · [Messdaten](artifacts/islands/comparison.json)

Die Karte zeigt tatsächlich erzeugte Tilemaps: Blau = Wasser, Sandfarbe = Strand, Hellgrün = Tiefland, Dunkelgrün = Plateau, Graugrün = Hochland, Hellgrau = höchste Stufe. Der Punkt markiert den Start. Es handelt sich um eine Übersicht des Generators, nicht um einen Live-Screenshot.

Für die neun Standardvergleiche mit Seeds 42, 137 und 2026:

- Alle begehbaren Geländefelder erreichbar; keine benachbarten Höhensprünge größer als eins.
- Das raue Profil hat bei allen drei Seeds mehr Küsten- und Höhenkanten als das sanfte Profil.
- Beispiel Seed 42: 938 / 1146 / 1410 Höhenkanten und 24 / 32 / 41 Rampen für Sanft / Ausgewogen / Rau.
- Die gemessene Erzeugung dauerte in diesem lokalen Node-Lauf etwa 0.23–0.47 Sekunden. Das ist keine Aussage zur Bildrate oder Startdauer im Browser.

Zusätzlich getestet: individuelle Reglerwirkungen, zwei extreme kleine Gebirgsinseln mit zuvor eingeschlossenen Taschen, deterministische Wiederholung, Speichern/Laden beider Generatorstände, Startressourcen, Debug-Ausnahme und ungültige Eingaben. Die Erreichbarkeitsprüfung betrachtet Gelände und Höhen, keine exakte Bewegung zwischen einzelnen Baumstämmen. Live-Bedienung des neuen Menüs und ein vollständiger Spieltest bleiben mangels Browserverbindung offen.
