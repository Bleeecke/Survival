# Grafik: Bestandsaufnahme und Verbesserungsplan

- **Pflanzen und Aufg?nge (2026-09-09):** Bambus, Pilzgruppen und Beerenb?sche verwenden jetzt `ResourceArt` und gemeinsam genutzte `SpriteFactory`-Texturen. Beerenb?sche besitzen drei begrenzte Erntezust?nde (reif/wenig/leer); leere B?sche bleiben bestehen. Aufg?nge erhalten unregelm??ige, beidseitig auslaufende Erdpfade mit felsigen Schultern statt kurzer Trapeze. Palmen und Spielregeln bleiben unver?ndert. `npm run art:review` erzeugt zus?tzlich `artifacts/graphics/plants-sheet.svg`; Pflanzen und vier Rampenrichtungen wurden offline gerendert und gesichtet. 39 Tests, Build und gezielter Modul-Lint bestanden; Live-Sichtung/FPS-Messung offen.

Stand: 2026-09-09. **Erste umfassende Grafiküberarbeitung eingebaut.** Der folgende ursprüngliche Plan bleibt als Zielbild erhalten; der konkrete Umsetzungs- und Prüfstand steht direkt darunter.

## Umsetzungsstand

### Nachbesserung der Höhenübergänge

Auslöser: [dritter Nutzer-Screenshot](Screenshot%202026-09-09%20214043.png). Die alten Höhenkanten wirkten zwischen Wald und tieferem Gelände wie eine schmale Einfassung mit rechtwinkligen Knicken und hellen Pfosten. Die Palmen wurden vom Nutzer ausdrücklich bestätigt und bleiben unverändert.

`CliffArt.ts` ersetzt diesen Zeichenpfad vollständig. Kanten werden aus den tatsächlichen Höhenunterschieden im Kameraausschnitt abgeleitet und an gemeinsamen Eckpunkten verbunden. Außen- und Innenecken erhalten gekrümmte Übergänge; diagonale Berührungen verbinden keine getrennten Plateaus. Breitere, leicht unregelmäßige Erd-/Felsflächen ersetzen helle Randstreifen und schwarze Sockelleisten. An Innenecken verjüngt sich die Böschung, damit sich die Flächen nicht überschlagen. Nordkanten werden jetzt ebenfalls gezeichnet.

Ein Erdpfad kennzeichnet einen Aufgang nur bei einer Höhendifferenz von eins, vorhandener Rampenmarkierung und begehbaren Nachbarfeldern. Hohe Küsten bleiben Klippen, flache Sandufer bleiben vom Klippenrenderer ausgenommen. Änderungen betreffen ausschließlich die Darstellung; keine neue Rampe, andere Kollision oder Änderung der Weltgenerierung.

Prüfung: **29 Tests**, TypeScript-/Vite-Build und ESLint für das neue Modul bestanden. Zusätzliche Fälle: alle vier Richtungen, keine doppelten Kanten, getrennte diagonale Plateaus, anschließende Kurvenpunkte, stabile Geometrie bei veränderten Ausschnittgrenzen und keine Mutation der Welt. Zeichnungen bleiben statisch und werden mit dem vorhandenen Terrain-Redraw aktualisiert; keine zusätzlichen Animationen pro Frame.

[Böschungsansicht](artifacts/graphics/cliff-scene.png) und [Richtungs-/Eckenprüfung](artifacts/graphics/cliff-directions.png) wurden lokal gerendert und visuell geprüft. Reproduzierbare SVGs: `npm run art:cliffs`. Diese Bilder sind Offline-Prüfszenen, keine Live-Screenshots. Browser-Bildrate, Verdeckung beim Laufen und die konkrete Nutzer-Szene bleiben live zu prüfen.

### Eingebaut

- **Boden und Übergänge:** `TerrainArt.ts` ersetzt die alten Bodenzeichnungen für alle vorhandenen Biome. Keine kachelweisen Licht-/Schattenleisten mehr; gedeckte Palette, seltene Bodendetails, kurze unregelmäßige Grasbüschel und zusammenhängende Wasserlinien. Nachbarschaftsabhängige Übergänge für Ufer und Vegetation. Flache Sandufer werden nicht mehr als Felswand gezeichnet; hohe Küsten behalten ihre Klippen. Rampendarstellung folgt der vorhandenen Höhenregel, einschließlich Rampen auf der niedrigeren Nachbarkachel. Weltgenerierung und Kollisionen bleiben unverändert.
- **Ressourcen:** `ResourceArt.ts` zeichnet Holzbaum, Palme, Feuerstein, Kiesel, Stöcke, Fasern und Kokosnuss. Bäume haben drei stabile Varianten; Palmen drei grafische Erntezustände. Feuerstein ist kantig, Kiesel rund, Fasern bilden ein Blattbündel. Weitere Vegetationsfarben wurden an die Palette angenähert. Die fünf kleinen Sammelobjekte verwenden auch nach dem Ablegen ihre tatsächliche Form.
- **Texturen:** Die bisher ungenutzte `SpriteFactory.ts` ist jetzt eingebunden. Sie erzeugt die neuen Ressourcenbilder bei erster Verwendung und teilt sie zwischen Weltobjekten. Palmen wechseln beim Ernten die passende Textur. Sichtbarkeitsprüfung und Tiefensortierung gelten weiterhin für die Bilder; Texturen gehören zur Phaser-Instanz, Ressourcenreferenzen werden beim Beenden geleert.
- **Lager:** `CampArt.ts` vereinheitlicht Arbeitsplatz, Schlafmatte, Palmendach und Feuerstelle. Das Palmendach ist über seinem zwei Felder breiten Bauplatz zentriert. Ein eigener Welt-Layer zeigt den laufenden Bauauftrag einschließlich Fortschritt und Pause; Abbruch/Fertigstellung entfernt ihn. Keine fiktiven Materialmengen oder zusätzlichen Spielzustände.
- **Figur und Tätigkeit:** Laufbewegung folgt kontinuierlich der tatsächlichen Strecke statt diskreter Animationsschritte; reduzierte Körperbewegung und angepasste Hemdfarben. Armbewegung folgt aktivem Crafting/Bauen, kurze Sammelpose folgt einer erfolgreichen Ernte. Bestehender Schlaf-/Aufwachablauf bleibt erhalten.
- **Symbole und Feuer:** Fünf aus denselben Zeichenfunktionen exportierte SVG-Symbole erscheinen in Inventar, Rezeptzutaten/-ergebnissen, Aufheben und Lagerkisten. Andere Gegenstände behalten ihre bisherigen Symbole. Bestehende Flammen/Rauch/Funken bleiben begrenzt; Wärmeschein außerhalb des Bildausschnitts wird nicht gezeichnet. Leere Feuerstellen zeigen keine dauerhafte lebendige Glut mehr, da es keinen gespeicherten Glutzustand gibt.

### Geprüft und offen

- TypeScript-/Vite-Build bestanden. `npm test`: 26 Tests, darunter acht neue Grafiktests für Ufer/Klippen, deterministische Zeichnungen, Wellenanschlüsse, Texturgrenzen und Wiederverwendung, Rampen sowie Baustellen-Abbruch/Pause/Sichtbarkeit.
- Neue Zeichenmodule und die neuen/geänderten UI-Dateien außer `InventoryPanel.tsx` bestehen ESLint. Dort bestehen zwei vorher vorhandene Meldungen: exportierte `USABLE`-Konstante und ein gewöhnlicher Ereignishandler namens `useItem`, den die Hook-Regel beanstandet. Kein vollständiger projektweiter Lint-Erfolg behauptet.
- [Referenzszene](artifacts/graphics/reference-scene.svg) und [Objektübersicht](artifacts/graphics/asset-sheet.svg) wurden aus den tatsächlichen Zeichenfunktionen erzeugt und als PNG visuell geprüft. **Dies sind konstruierte Offline-Referenzen, keine Screenshots eines laufenden Spielstands.** `npm run art:review` reproduziert SVGs und UI-Symbole.
- Server liefert die neuen Symbole über Port 5174 aus. Vorhandene Spielstände benötigen keine Migration. Nach Speichern und Neuladen kann die Grafik im eigenen Spielstand geprüft werden.
- **Noch offen:** Interaktive Prüfung bei Tag/Nacht, Verdeckung während Bewegung, Tabwechsel und FPS-/Speichermessung auf dem Nutzergerät. Die fehlende Browserverbindung erlaubt keine belastbare Leistungszusage. Der weichere Sichtmaskenrand, individuelles Neuzeichnen sämtlicher später Ressourcen/Bauten und eine optionale Effektreduktion sind weitere Ausbauschritte; Chunk-Caching wird erst nach Messung entschieden.

### Einordnung der Pakete

G0 hat nun Screenshotreferenzen und reproduzierbare Offline-Zeichnungen; Live-Messung fehlt. G1 ist implementiert. G2 ist für frühes Lager, Baufortschritt und Tätigkeitsbewegung implementiert; kein neuer Schlafzustand wurde eingeführt. G3 vereinheitlicht alle Bodenbiome und Teile der Vegetation, ist aber noch keine vollständige Neuzeichnung jedes Weltobjekts. G4 vereinheitlicht fünf wichtige Symbole und bereinigt Feuerdarstellung/Sichtbarkeit; weitere Atmosphäre bleibt nachrangig.

## Grundlage und Grenzen

Gesichtet wurden das Introbild und die vorhandenen Bilddateien, der aktive Zeichenpfad in `src/services/phaser/GameManager.ts`, die vorbereitete `SpriteFactory.ts`, die Effektansätze und die bisherigen Terrain-Dokumente. Anschließend wurden zwei vom Nutzer bereitgestellte Spielscreenshots geprüft (siehe unten). Damit ist die statische Bildschirmwirkung dieser Szenen belegt. Eine interaktive Live-Spielansicht war nicht verfügbar; Animationen, Verhalten bei Kamerabewegung und Bildrate bleiben ungeprüft.

`terrain_direction_draft.md` liefert die bestehende Stilrichtung: handgemachte 2D-Formen, starke Silhouetten, ruhige Flächen und verständliche Höhen. `terrain_review_for_claude.md` ist ein älterer Review und kein Beleg dafür, dass alle dort beschriebenen Probleme weiterhin bestehen.

## Befund

### Screenshot-Review vom 2026-09-09

Referenzen: [Lager und Waldrand](Screenshot%202026-09-09%20210804.png) und [Strand mit Palmen](Screenshot%202026-09-09%202108501.png). Die Bilder zeigen unterschiedliche Ausschnitte; daraus keine Aussagen zu responsivem Layout oder abgeschnittenen Menüs ableiten.

| Sichtbarer Befund | Konkrete Verbesserung | Priorität |
|---|---|---|
| Sand zeigt ein deutliches quadratisches Raster, Wasser wiederholte rechteckige Streifenfelder | Helligkeitssprünge an Kachelgrenzen reduzieren; Details über größere zusammenhängende Bereiche verteilen; Wasser mit wenigen längeren Wellenlinien gestalten | Zuerst |
| Hohes Gras besteht fast flächendeckend aus gleichförmigen senkrechten Strichen | Halme zu unregelmäßigen Büscheln gruppieren, größere ruhige Zwischenflächen lassen; weiterhin klar von kurzem Gras unterscheiden | Zuerst |
| Waldboden zeigt viele ähnlich große grüne Kreise in wiederkehrender Anordnung | Kontrast und Dichte deutlich reduzieren; seltene Blatt-/Erdgruppen statt flächigem Punktemuster | Zuerst |
| Wasser–Sand bildet eine grobe Treppe; stellenweise ist eine schmale braune senkrechte Kante sichtbar | Nachbarschaftsabhängige Uferkonturen und schmalen Feuchtsandstreifen gestalten. Prüfen, ob die braune Kante eine echte Höhe darstellt; Strand und Klippe dürfen nicht gleich aussehen | Zuerst |
| Sand–Gras wechselt unvermittelt an Kachelgrenzen | Kleine unregelmäßige Grasränder und auslaufende Sandflecken entlang der tatsächlichen Grenze; keine zufälligen Flecken über die ganze Fläche | Zuerst |
| Kleine Steine, Stöcke und Pflanzen konkurrieren mit kontrastreichen Bodenmustern | Zunächst Boden beruhigen, dann Ressourcen mit prägnanter Form und gezieltem Hell-Dunkel-Kontrast hervorheben | Direkt danach |
| Kleine Bäume haben runde, konzentrische Kronen; Palmen wiederholen sehr ähnliche Formen | Gemeinsame stilisierte Formensprache mit leicht asymmetrischen Kronen; wenige stabile Varianten für Neigung, Größe und Blattanordnung | Danach |
| Sichtbarer Bereich endet in einer schwarzen, kachelweise gestuften Kontur | Optional eine schmale weichere bzw. unregelmäßige Maskenkante innerhalb bereits sichtbarer Fläche testen; verdeckte Welt nicht offenlegen | Später |

Figur, Palmen und Feuer sind bereits als solche erkennbar. Das Feuer bietet einen klaren warmen Orientierungspunkt. Diese Stärken erhalten. Aus den Bildern lässt sich weder die Animationsqualität noch die Ursache einer möglichen Unschärfe sicher bestimmen; angezeigte Müdigkeit und Bildskalierung sind dabei zu berücksichtigen.

**Geänderte Reihenfolge innerhalb G1:** Erst Bodenmuster und Wasser–Sand-/Sand–Gras-Übergänge in den gezeigten Szenen überarbeiten, dann die darauf liegenden Startressourcen. Der größte sichtbare Hebel ist derzeit die Flächengestaltung. Zusätzliche Effekte und ein kompletter Figurentausch sind nachrangig.

Für den Vorher/Nachher-Vergleich möglichst denselben Spielstand, dieselbe Position, Auflösung, Zoomstufe, Tageszeit und Müdigkeit verwenden. Die vorliegenden Screenshots dienen als visuelle Referenz; technische Messungen bleiben Teil von G0.

| Bereich | Nachweisbarer Stand | Konsequenz für den Plan |
|---|---|---|
| Intro | Detaillierte Pixelillustration mit gedeckten Sand-, Meer- und Pflanzenfarben, markanten Klippen und gestrandeter Figur | Stimmung und Palette als Bezug nutzen; Detailgrad nicht ungeprüft auf kleine Spielfiguren übertragen |
| Spielwelt | Boden, Ressourcen, Bauten und Spieler werden überwiegend aus Phaser-Graphics-Primitiven gezeichnet | Gemeinsame Gestaltungsvorgaben fehlen als zentrale Grundlage; Verbesserungen lassen sich schrittweise je Objektgruppe durchführen |
| Boden | Viele Farben und kleine, kachelbezogene Details; etwa Grashalme, Kreise, Streifen und Flecken | Risiko von Unruhe und sichtbarer Wiederholung; zuerst große Flächen und Übergänge prüfen |
| Spieler | Zusammengesetzte geometrische Körperteile, richtungsabhängige Darstellung und achtphasiger Laufzyklus | Animation ist bereits vorhanden; Silhouette, Proportionen und Bewegungsrhythmus gezielt verbessern |
| Bauten | Eigene Zeichnungen, z. B. Blattmatte mit Arbeitsstein und Unterschlupf mit Stützen/Dach | Formensprache angleichen und Zustände deutlicher machen, vorhandene Details nutzen |
| Texturvorbereitung | `SpriteFactory.ts` erzeugt Canvas-Texturen, ist nach Referenzsuche derzeit nicht eingebunden | Vorhandenen Ansatz prüfen; keinen zweiten konkurrierenden Ressourcenrenderer daneben aufbauen |
| Effekte | `ParticleManager.ts` ist ebenfalls nicht eingebunden; Bildschirmunschärfe ist in `GameScreen.tsx` vorhanden | Effekte erst nach visueller und technischer Basis verbessern; Unschärfe separat auf Kosten prüfen |

`src/assets/hero.png` ist eine abstrakte Vorlagengrafik, keine Spielfigur und keine geeignete Stilreferenz.

## Vorgeschlagene Gestaltungsregeln

**Stilisierte tropische 2D-Welt mit klaren, leicht unregelmäßigen Formen.** Die bestehende Terrain-Richtung bleibt maßgeblich. Das Intro liefert Atmosphäre und Farbfamilien. Ob die endgültigen Assets harte Pixelkanten oder weichere Illustrationskanten erhalten, wird an einer kleinen Vergleichsszene entschieden; beide Kantenstile nicht unkontrolliert mischen.

- Boden bleibt ruhig und kontrastarm. Sammelobjekte und nutzbare Bauten erhalten deutlichere Konturen und unterscheidbare Silhouetten.
- Einheitliche Lichtquelle oben links; Schattenrichtung, Schattenfarbe und Bodenanker folgen derselben Regel.
- Je Material wenige zusammengehörige Farbtöne: warmes Holz und Sand, kühles Wasser, klar unterscheidbare Steinflächen und Vegetation. Helligkeit trägt die Lesbarkeit zusätzlich zur Farbe.
- Große Form zuerst, Details danach. Einzelne Grashalme sind weniger wichtig als eine erkennbare Waldkante und ein gut sichtbarer Feuerstein.
- Die Figur bildet die Größenreferenz. Objektbild, begehbare Fläche und Interaktionsbereich müssen zusammenpassen.
- Variationen werden stabil aus Objekt-ID oder Weltseed gewählt. Beim Kameraschwenk wechseln keine Formen oder Farben zufällig.

## Priorisierte Verbesserungen

### P1: Ressourcen und Terrain lesbar machen

**Ressourcen:** Zuerst die Einstiegskette bearbeiten: lose Steine, Feuerstein, Stöcke, Pflanzenfasern, Lianen, Kokosnuss und Holzquellen. Feuerstein bekommt eine charakteristische kantige Form, Faserpflanzen lange gebündelte Blätter, Lianen erkennbare Ranken. Pro häufigem Objekt zunächst zwei bis drei Varianten mit gleicher Grundsilhouette. Abgeerntete Zustände bleiben eindeutig unterscheidbar.

Nähe oder Auswahl kann einen dezenten Umriss und den Namen einblenden. Kein dauerhaftes Leuchten über der ganzen Karte. Verborgene Objekte bleiben verborgen. Ein erkennbarer Gegenstand verrät noch keine unbekannten Rezepte: Die Wissensprogression bleibt erhalten.

**Terrain:** Zuerst Wasser–Sand und Sand–Gras. Zusammenhängende Uferformen statt voneinander unabhängiger Kachelstreifen; wenige Schaumlinien statt flächigem Bewegungsrauschen. Ruhigere Bodenvarianten mit seltenen Akzenten. Danach Waldkanten und Höhen bearbeiten: Klippen erhalten eine zusammenhängende Seitenfläche, begehbare Aufgänge eine eindeutig andere Form.

Grafische Klippenkorrekturen ändern keine Kollisionen. Falls die Ursache ungünstige Weltgenerierung ist, wird sie als gesonderte Aufgabe dokumentiert; ein aufgemalter Aufgang darf keinen nicht vorhandenen Weg versprechen.

**Abnahme:** Bei normalem Zoom lassen sich die wichtigsten Startressourcen unterscheiden; Küste und passierbare Höhenwege sind ohne Debug-Anzeige verständlich. Hinter Baumkronen und nachts bleibt die vorgesehene Spielinformation lesbar.

### P2: Figur und Lager sichtbar weiterentwickeln

Figur mit klarer Kopf-/Körperform und ruhigerem Bewegungsablauf überarbeiten. Vier Richtungen konsistent halten, Fußkontakt und Geschwindigkeit abstimmen. Zuerst kurze Zustände für Sammeln, Arbeiten und Schlafen ergänzen. Animation folgt dem tatsächlichen Auftrag und endet auch bei Abbruch; keine zweite Zeitschätzung im Renderer.

Lagerfeuer, Schlafplatz, Palmendach und Arbeitsplatz als zusammengehörige Gruppe gestalten. Feuer aus, Glut und brennendes Feuer klar unterscheiden. Laufenden Bau mit einer einfachen Baustellenansicht kennzeichnen, abgeschlossenen Bau mit der fertigen Form. Reparaturbedarf nur darstellen, wenn der zugrunde liegende Zustand tatsächlich existiert.

Skillfortschritt soll über bessere Ergebnisse spürbar sein. Werkzeugqualität zunächst mit einheitlichem Symbol, Text und Zustand in Inventar/Tooltip zeigen. Nicht für jede Qualitätsstufe sofort alle Weltgrafiken vervielfachen. Spätere sichtbare Ausrüstungsvarianten nur dort, wo sie beim Spielen erkennbar sind.

**Abnahme:** Tätigkeit und Stationszustand sind verständlich; Hände, Werkzeuge, Dächer und Baumkronen überdecken sich korrekt. Keine erfundenen Spielzustände allein für die Optik.

### P3: Symbole und Atmosphäre vereinheitlichen

Die wichtigsten Inventar-, Rezept- und Bausymbole aus denselben Formen und Materialfarben wie die Weltobjekte ableiten. Ein Gegenstand muss in Rezept, Inventar und Welt wiedererkennbar sein. Bedeutung zusätzlich durch Text vermitteln.

Danach sparsame Atmosphäre: kleine Feueranimation, begrenzter Rauch, vereinzelte Brandung und kurze Sammelreaktionen. Keine flächendeckende Vegetationsbewegung als erster Schritt. Nachtstimmung über Palette und lokale Lichtwirkung testen, ohne wichtige Interaktionen unlesbar zu machen. Effektreduktion als Option einplanen, falls Messungen dafür sprechen.

## Technischer Rahmen gegen erneutes Stocken

Die bisherigen Verbesserungen bei Tabwechsel und Sichtbarkeitsprüfung bleiben erhalten. Mehr Grafikdetails dürfen nicht automatisch mehr Zeichenarbeit pro Frame bedeuten.

1. Statische Ressourcen möglichst einmal als Textur erzeugen und mehrfach verwenden. `SpriteFactory` zunächst auf einer kleinen Objektgruppe gegen den aktiven Pfad testen: Optik, Anker, Skalierung, Tiefensortierung, Speicher und Startzeit.
2. Boden erst bei Bedarf in begrenzte Bereiche zwischenspeichern. Keine riesige Textur für die gesamte Welt. Änderungen müssen den betroffenen Bereich gezielt aktualisieren.
3. Nur sichtbare Animationen aktualisieren. Für Partikel eine feste Obergrenze und Wiederverwendung vorsehen; Transparenzflächen klein halten.
4. Unschärfe separat mit und ohne Effekt vergleichen. Erst bei bestätigtem Nutzen ersetzen oder reduzieren.
5. Renderumbauten und neue Zeichnungen getrennt vergleichen, damit Qualitätsgewinn und Kosten nachvollziehbar bleiben.

Es liegt keine neue FPS-Messung vor. Vorgeschlagenes Ziel: auf dem bisherigen Testgerät möglichst stabile 60 FPS bei gleichem Zoom und gleicher Szene. Neben Durchschnitt auch lange Einzelbilder, Speicher, Startdauer und Verhalten nach Tabwechsel erfassen; ein guter Durchschnitt verdeckt Ruckler.

## Konkrete Umsetzungspakete

| Paket | Inhalt | Fertig, wenn |
|---|---|---|
| G0 – Referenz | Feste Szene aus Strand, Waldrand, Feuerstein, Kokosnuss, Figur und kleinem Lager; vorherige Screenshots und Messung sichern | Tag, Nacht und dicht bewachsene Ansicht bei gleichem Seed/Zoom dokumentiert; Kantenstil und Palette festgelegt |
| G1 – Einstieg | Startressourcen und zwei Terrainübergänge in dieser Szene überarbeiten | Ressourcen unterscheidbar, Übergänge zusammenhängend, keine schlechtere Bildstabilität |
| G2 – Handlung | Figur, vier frühe Lagerobjekte und tatsächliche Arbeits-/Feuerzustände angleichen | Sammeln, Craften, Bauen, Schlafen und Abbruch visuell korrekt |
| G3 – Ausbreitung | Bewährten Stil auf weitere Biome, Höhen und Objekte übertragen | Keine Stilbrüche, sichtbare Kollisionen stimmen, Kameraränder zeigen kein störendes Aufpoppen |
| G4 – Feinschliff | Symbole und sparsame Atmosphäre | Einheitliche Wiedererkennung, Effekte verdecken nichts, Leistung erneut geprüft |

Empfohlener erster Umsetzungsschritt ist **G0 + G1**, bevor die gesamte Grafik ersetzt wird. So entsteht früh ein spielbarer Ausschnitt, an dem die Richtung beurteilt werden kann.

## Arbeitsregeln für weitere KI und Agenten

- Status pro Vorschlag als geplant, in Arbeit, geprüft oder verworfen festhalten. Dieser Plan genehmigt keine Änderungen an Survival-Regeln.
- Vor Umsetzung aktuellen Code prüfen; Dateipfade und Befunde können sich ändern.
- Für jedes Paket betroffene Assets/Funktionen, Vorher/Nachher-Bilder, Messbedingungen und offene Probleme ergänzen.
- Neue Assets erhalten dokumentierte Größe, Bodenanker, Varianten, Zustände und Herkunft/Nutzungsrechte. Generierte Konzepte gelten erst nach Aufbereitung und Prüfung als Spielassets.
- Bei jeder Grafikänderung auch Auswahl, Verdeckung, Nebel, Nacht, Zoom und Kamerawechsel prüfen. Gameplay-Daten und Kollisionsflächen nicht versehentlich verändern.
- Offene Hauptentscheidung: konkrete Kantenästhetik anhand der Referenzszene. Zwei statische Spielansichten sind geprüft; interaktive Live-Sichtung und Leistungsmessung bleiben bis G0 ausdrücklich offen.
# Baumgrafiken – umgesetzt am 2026-09-09

Nachtrag: Die zunächst übersehenen Pandanus- und separaten Lianenbaum-Renderer sind ebenfalls angepasst. Große Bäume und Banyans wurden nach Nutzerkorrektur wieder zu markanten Landmarken vergrößert (3,5-/3,2-fache normale Baumgröße), mit breitem Bodenschatten. Größere Cache-Texturen mit angepasstem Ursprung und Kamerarand verhindern abgeschnittene Kronen. Die vorhandene Kühlung (tagsüber, vier Tiles Radius, Zieltemperatur minus zwölf Spielwerte) wurde nicht verändert. `trees-sheet` zeigt den Größenvergleich; `vine-trees` zeigt den tatsächlichen Renderer vor/nach Lianenernte.

`TreeArt.ts` ersetzt die bisherigen runden Kronen für Holz-, Urwald-, Banyan-, Kautschuk-, Kakao-, Brotfrucht- und exotische Fruchtbäume. Geschichtetes Laub, verzweigte Stämme, Wurzelansätze und Banyan-Luftwurzeln verbinden sie mit dem neuen Pflanzenstil. Harzbäume behalten ihre zustandsabhängigen Schnitt-/Harzzeichen. Palmen bleiben unverändert. Die neuen statischen Baumarten teilen sich Texturen; Fruchtbäume unterscheiden volle, wenige und fehlende Früchte. Keine Änderung an Ernte, Kollision oder Inselgenerierung.

Prüfung: Texturgrenzen aller Varianten, Fruchtzustände und Cache getestet; Build und gezielter Modul-Lint erfolgreich. `trees-sheet.svg/png` zeigt die tatsächlichen Renderer offline; kein Live-Browser-Test.
