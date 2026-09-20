# Bauarbeit, Baustellen und Upgrades

Stand: 2026-09-20. Der folgende Umsetzungsstand geht dem ursprünglichen Entwurf weiter unten vor.

## Implementiert

Aktualisierung Bedienung/Material: Direkter Gebäudeklick und Aktion „Ausbauen“, nächste Stufe und Voraussetzungen als Hover-/Fokus-Hinweis. Keine Zielstufenauswahl und kein Objektdropdown mehr. Material kann jetzt in beliebigen Teilmengen angeliefert werden; `delivered` speichert Mengen pro Ressource. Lieferung nimmt nur noch fehlende Mengen aus Inventar und nahen Vorräten. Arbeit beginnt nach vollständiger Lieferung. Beim Aufgeben werden nur tatsächlich eingebrachte Mengen erstattet. Diese Regel ersetzt die ursprüngliche vollständige Bausatzübernahme unten.

- Alle Bau-Menü-Platzierungen erzeugen persistierte Baustellen; Material darf beim Planen fehlen. „Bauen & Lager“ oder Klick auf eine Baustelle öffnet die Aktionen. Es gibt keine sofortige Fertigstellung mehr.
- Materialübernahme bindet den vollständigen Bausatz aus Inventar und Vorräten im bisherigen Drei-Felder-Bereich. Sie ist bewusst ausgelöst und nur direkt neben der Baustelle möglich. Kein Ferntransport von Materialien.
- Explizite Arbeit auf orthogonal angrenzender Kachel gleicher Höhe; Bewegung und andere Interaktionen unterbrechen. Ausdauerverbrauch, vorhandener Skill-Einfluss und Werkzeugverschleiß sind angeschlossen. Fortschritt bleibt beim Unterbrechen und Laden erhalten.
- Sichtbarer Aufbau für Schlafplatz, Feuerstelle, Arbeitsplatz und Unterkünfte; übrige Bauten haben einen allgemeinen Rohbau. Zeichnung wird im aktiven Frame-Aufruf aktualisiert, Geometrie nur pro Fortschrittsstufe. Persistierter Fortschritt maximal zweimal pro Sekunde; Arbeitsanimation läuft unabhängig flüssig.
- Ausbaukette Schlafplatz → Palmendach → Holzunterkunft → Blockhütte. Zusatzkosten/Arbeit in `src/data/construction.ts`. Beim Palmendach gilt das unten beschriebene 4+6-Blätter-Modell; direkter Neubau kostet 10 Blätter und 45 Basis-Sekunden. Weitere Zusatzkosten: Holzunterkunft 18 Holz + 5 Stein / 100 s; Blockhütte 20 Holz + 15 Stein + 10 Bretter / 180 s. Neue Unterkünfte belegen 1/2/3/4 Felder in einer Reihe; keine Drehfunktion. Bestehende Bauten behalten ihre gespeicherte Breite.
- Bereits bekannte Ausbaustufen bestimmen die blaue Flächenvorschau. „Ausbaufläche reservieren“ reserviert den größten bekannten Ausbau, ohne Bewegung zu sperren. Reservierungen werden gespeichert, können freigegeben werden und gehen beim Fertigstellen auf den Bau über.
- Schlafplatz, Arbeitsplatz, gelöschte Feuerstelle und leere Lagerbox: Ziel wählen, am alten Standort abbauen, Transportgut aufnehmen, selbst zum Ziel laufen, dort aufbauen. Tragen verlangsamt die Bewegung. Unterbrechen legt das Transportgut an der Spielerposition ab; Laden setzt Arbeit nicht automatisch fort. Nach dem Verpacken ist nur Unterbrechen/Fortsetzen möglich, kein materialvernichtendes Aufgeben.
- Feuerlöschen bewahrt Restbrennstoff als `coldFuel`; fünf Sekunden Spielzeit Abkühlung vor dem Abbau. Später über die Bauoberfläche wieder entzündbar. ID, Schaden, Inhalte und Brennstoffzustand werden beim Versetzen erhalten. Upgrades übernehmen den Schadensanteil und lassen den Ausgangsbau bis zur Fertigstellung nutzbar.
- Abbruch vor Arbeitsbeginn: vollständige Materialrückgabe als Bodenstapel. Nach Arbeitsbeginn: 50 % pro Ressource, abgerundet. Kein Inventarplatz nötig; keine Wiederholungs-Erstattung. XP einmalig beim Abschluss mit bestehendem Wiederholungsmalus, keine XP durch Versetzen. Anteiliges Arbeits-XP und gestaffelte Materiallieferungen bleiben spätere Erweiterungen.
- Alte Tagesbaustellen werden einmalig in vorausbezahlte Baustellen mit anteiligem Fortschritt und ursprünglicher Fläche migriert. Die alten Sofort-/Tagesbau-Interaktionen wurden entfernt. Generatorversion bleibt unverändert.

Quellen: `ConstructionSystem.ts`, `constructionMigration.ts`, `construction.ts`, `ConstructionPanel.tsx`, `craftingStore.ts`, `worldStore.ts`, `GameManager.ts`, `CampArt.ts`.

Prüfung: automatisierte Tests für Unterbrechung, Reservierung, Upgrade, Materialbilanz, Transport, Speichern/Laden und Migration; Build und gezielter Lint. `node scripts/render-construction-review.cjs` erzeugt echte Renderer-Prüfansichten. Live-Browsertest war mangels verfügbarer Browserverbindung nicht möglich. Bestehende Lint-Befunde in `GameScreen.tsx` (Intro-Effekt, `useBeltSlot`-Benennung) sind unabhängig von diesen Änderungen.

## Ursprünglicher Entwurf und spätere Erweiterungen

## Ziel

Platzieren legt einen Bauplan fest. Erst Materiallieferung und aktive Arbeit vor Ort machen daraus ein nutzbares Bauwerk. Der sichtbare Aufbau vermittelt Fortschritt. Bestehende Einrichtungen lassen sich unter Wiederverwendung geeigneter Teile ausbauen; direkter Neubau bleibt möglich.

## Aktueller Stand

- `craftingStore.startBuild` startet bereits einen zeitbasierten Bauauftrag. Er läuft innerhalb eines quadratischen Bereichs von drei Feldern um den Bauplatz weiter, ohne eine gesonderte Arbeitsinteraktion zu verlangen.
- `BuildingSystem` prüft Wissen, Skills, Werkzeuge, Materialien und Platz. Baumaterial kommt aus Inventar, Bodenstapeln und Lagern innerhalb von drei Feldern. Verbrauch erfolgt erst bei Fertigstellung.
- Ein einziger, nicht persistierter `CraftJob` enthält den gesamten Baufortschritt. Abbrechen löscht ihn ohne Materialverlust; Weggehen pausiert ihn. Das ist keine dauerhafte Weltbaustelle.
- `CampArt.drawConstruction` zeigt allgemeine Markierungen und einen Balken, keinen gebäudespezifischen Aufbau.
- Bauzeiten sind bereits vorhanden: Schlafplatz 5 s, Feuerstelle 8 s, Palmendach 40 s, Holzunterkunft 120 s, Blockhütte 300 s, jeweils vor Skill-Einfluss.
- `Structure` enthält außerdem ältere Tagesbau-Felder (`constructionTarget`, `constructionDaysLeft`, `lastBuildDay`). Alle bestehenden Tagesbau-/Interaktionspfade vor der Umsetzung erfassen und auf einen gemeinsamen Ablauf migrieren.
- Baufläche ist teilweise hart codiert: Palmendach zwei Felder, andere Platzierungen ein Feld. Upgrades brauchen zentrale Flächenangaben.

## Vorgeschlagener Spielablauf

1. Bekanntes Gebäude auswählen, Vorschau drehen/ausrichten soweit unterstützt, gültigen Platz bestätigen. Ein Plan darf auch bei fehlendem Material gesetzt werden; unbekannte Bauweisen bleiben verborgen. Fehlende Skills/Werkzeuge werden angezeigt und verhindern Arbeit, nicht die Planung eines bekannten Baus.
2. Am Plan stehen benötigte, gelieferte und noch fehlende Materialien. Der Plan reserviert die Fläche, blockiert aber noch nicht wie eine fertige Wand.
3. Baustelle anklicken → „Bauen“. Charakter geht zu einem erreichbaren Arbeitsfeld direkt am Rand. Ohne automatischen Laufweg zeigt die erste Version „Stelle dich neben die Baustelle“ und wartet auf dieselbe explizite Aktion.
4. Material aus dem Inventar bewusst anliefern. „Material übernehmen“ kann außerdem vorhandene Bodenstapel/Lager im bisherigen Drei-Felder-Bereich verwenden; diese Komfortregel wird klar angezeigt. Automatisches Holen von entfernten Lagern gehört in einen späteren Schritt.
5. Nur während aktiver Arbeit steigt der Fortschritt. Figur steht still, blickt zur Baustelle und führt eine passende Bewegung aus. Laufbefehl, Sammeln, Craften, Schlafen oder eine andere Tätigkeit unterbrechen die Bauarbeit.
6. Fortschritt und gelieferte Materialien bleiben beim Weggehen, Aufgabenwechsel und Speichern erhalten. Mehrere Pläne/Baustellen sind möglich, aber nur eine aktive Tätigkeit gleichzeitig.
7. Fertigstellung erzeugt genau ein Bauwerk und schaltet dessen Funktionen frei. Planen oder bloßes Danebenstehen erzeugt keine Arbeit.

Arbeitsfeld: eine der orthogonal angrenzenden, begehbaren Randkacheln der gesamten Baufläche, auf erreichbarer Höhe. Keine Arbeit diagonal durch Ecken, durch Hindernisse oder über eine unpassierbare Höhenkante. Bei Wegfall des Arbeitsfeldes pausieren und den Grund nennen.

## Sichtbarer Aufbau

| Bau | Anfang | Aufbau | Abschluss |
|---|---|---|---|
| Schlafplatz | Boden vorbereiten | einzelne Blattlagen | geschlossene Unterlage |
| Feuerstelle | Platz freiräumen | Steinring entsteht | Feuerholz einlegen |
| Palmendach | Material und Bodenlager | Pfosten, Querträger, Bindungen | Dach erhält nach und nach Blätter |
| Holzunterkunft | Grundgerüst | Wände und Dachgerüst | geschlossene Verkleidung |

Jedes Gebäude erhält wenige klar lesbare Darstellungsstufen; kleine Elemente erscheinen innerhalb der Stufen nach Fortschritt. Nicht das fertige Gebäude gleichmäßig größer skalieren. Pausen stoppen Figur und Aufbau. Fortschrittsbalken hauptsächlich bei Auswahl; keine dauerhaften Balken über dem ganzen Lager. Renderer nur bei Stufenwechsel neu aufbauen.

## Materialien und Abbruch

Material ist nach Lieferung im Baustellenbestand gebunden und steht anderen Rezepten nicht mehr zur Verfügung. Vor einer Bauphase müssen deren Materialien vorhanden sein. Beim ersten Arbeitsfortschritt einer Phase werden sie einmalig in „verbaut“ verschoben; Materialmengen werden nicht pro Frame gerundet.

- „Arbeit unterbrechen“ behält alles. Dies muss sich klar von „Baustelle aufgeben“ unterscheiden.
- Einen unberührten Plan entfernen ist kostenlos.
- Unverbautes Material wird bei Aufgabe vollständig am Bauplatz abgelegt, auch bei vollem Inventar.
- Bereits verbaute Mengen ergeben ausschließlich definierte Rückbaumaterialien. Keine pauschale volle Erstattung, keine doppelten Auszahlungen durch Abbruch/Reload.
- Frühe Phase einfach halten: eine Materiallieferung für den gesamten Kleinbau, anschließend Arbeit. Größere Bauten bekommen mehrere Material-/Arbeitsphasen. Dasselbe Datenmodell unterstützt beides.

## Upgrades

Upgrade am bestehenden Bau auswählen. Vorschau zeigt Zielbau, zusätzliche Fläche, Zusatzmaterialien, Arbeitsaufwand und Verbesserungen gegenüber dem Bestand. Zielwissen und Zielwerkzeuge gelten auch beim Upgrade.

Kosten explizit pro Übergang definieren. Kein globaler Rabatt und keine blinde Subtraktion unterschiedlicher Zutatenlisten. Ein vorhandener Schlafplatz spart Unterlage, aber weder Dachpfosten noch Bindungen. Direkter Neubau muss funktional dasselbe Ergebnis ergeben.

### Konkreter erster Übergang: Schlafplatz → Palmendach

Vorgeschlagene Neubilanz, noch nicht beschlossene Spielwerte:

| Weg | Palmblätter | Äste | Lianen |
|---|---:|---:|---:|
| Schlafplatz | 4 | 0 | 0 |
| Upgrade: Dach ergänzen | 6 | 8 | 3 |
| Palmendach direkt, einschließlich Unterlage | 10 | 8 | 3 |

Aktuell kostet das direkte Palmendach 6 Blätter, 8 Äste und 3 Lianen. Im Vorschlag werden seine sechs Dachblätter um die vier Blätter der Unterlage ergänzt. Damit kostet das Upgrade zum Entscheidungszeitpunkt weniger; Schlafplatz plus Upgrade hat dieselben Gesamtmaterialkosten wie der direkte Bau. Früh vorsorgen wird nicht bestraft und eine Upgrade-Kette erzeugt keinen kostenlosen Rabatt.

Arbeitsaufwand ebenfalls konsistent: Vorschlag 5 Basis-Arbeitseinheiten für die Unterlage und 40 für das Dach; direkter Bau 45. Skill und Werkzeuge verändern die Arbeitsgeschwindigkeit. Konkrete Dauer erst im Spiel balancieren.

Weitere geeignete Übergänge: Palmendach → Holzunterkunft → Blockhütte; Feuerstelle → Granit-Feuerstelle; Arbeitsplatz → Werkbank. Für jede Verbindung separat prüfen, welche Teile tatsächlich wiederverwendbar sind. Bett als eigener Einrichtungszweig behandeln: ein Dach und eine bessere Schlafunterlage erfüllen unterschiedliche Funktionen.

### Bestand während des Umbaus

- Für das Dach bleibt der vorhandene Schlafplatz bis zur Fertigstellung nutzbar. Schlafen pausiert den Umbau.
- Ein Feuerstellenumbau verlangt gelöschtes Feuer; Kochen pausiert. Vorhandenen Brennstoff speichern und nach Kapazitätsregel übernehmen oder als Material ausgeben, niemals still löschen.
- Lagerinhalt, Schaden, Ausrichtung und Bauwerks-ID bewusst übertragen. Ein Upgrade ist keine kostenlose Vollreparatur: vorhandenen Schadensanteil übernehmen; neu hinzugefügte Teile sind unbeschädigt.
- Erst bei erfolgreicher Fertigstellung ersetzt/erweitert das Ziel den Bestand atomar. Kein zweites Gebäude daneben, keine doppelt belegte Fläche.
- Größere Baufläche vor Start reservieren und vor Abschluss prüfen. Eigener Ausgangsbau ist dabei zulässig; fremde Bauten, andere Baustellen und unzulässiges Gelände nicht.
- Bei Abbruch bleibt der Ausgangsbau bestehen; Zusatzmaterialien folgen den normalen Rückbauregeln. Wird der Ausgangsbau zerstört, darf das Upgrade nicht ohne neue Prüfung fertig werden.

## Survival und Skills

Bauen ist körperliche Arbeit: moderater Ausdauerverbrauch, Nahrung/Wasser und Temperatur laufen weiter. Bei Erschöpfung pausiert der Charakter verständlich. Kein eigener Hunger-Timer neben dem bestehenden Survival-System.

Bauskill steigert Geschwindigkeit und später Stabilität/Qualität; vorhandene Zuordnung von Feuerbau zu Überleben bewusst beibehalten. XP nach tatsächlich geleisteter Arbeit mit einem festen Gesamtbudget pro Baustelle, persistiertem Vergabestand und abnehmendem Ertrag bei Wiederholungen. Unterbrechen und Fortsetzen darf weder Extra-XP geben noch bisherige Arbeit entwerten. Unverbrauchte Arbeitszeit wird bei Skillwechsel nicht neu berechnet: gespeichert werden geleistete Arbeitseinheiten.

Für die erste Version keine zufällige vollständige Zerstörung des Baus. Spätere handwerkliche Fehler dürfen begrenzte Nacharbeit verursachen. Regen, Werkzeugqualität und Verletzungen erst nach funktionierendem Grundablauf als klar sichtbare Geschwindigkeitsfaktoren integrieren.

## Technische Umsetzung

- `BuildDefinition`: zentrale Baufläche, Phasen mit Material-/Arbeitsbedarf, Grafikstufen und optionalen Upgrade-Verbindungen ergänzen. Zutaten für Neubau/Upgrade bleiben explizit und datengetrieben.
- Neue `ConstructionSite` im Weltzustand: ID, Zieldefinition, Position/Ausrichtung/Fläche, optional `sourceStructureId`, Phasenstand, gelieferte/verbaute Materialien, geleistete Arbeit, vergebene XP, pausierter Zustand und Version der gespeicherten Baukosten. Laufende Baustellen behalten ihre Kosten bei späteren Balanceänderungen.
- Welt-Snapshot und Wiederherstellung speichern Baustellen. Alte Saves erhalten eine leere Liste; ältere Tagesbaustellen explizit migrieren. Keine Änderung der Inselgeneratorversion für diese Save-Erweiterung.
- Gemeinsame aktive Tätigkeit referenziert die Baustellen-ID. Der Crafting-Slot darf Bauen und Werkzeugherstellung nicht gleichzeitig ausführen; inaktive Baustellen blockieren Crafting nicht. Nach Laden bleibt Arbeit pausiert, bis der Spieler sie fortsetzt.
- `BuildingSystem`: Planen, Materialtransfer, Arbeitsfeldprüfung, Fortschritt, Upgradeprüfung, Fertigstellung und Rückbau als gemeinsame Regeln. Transaktionen verhindern Materialverlust oder Duplikation zwischen Spielerinventar und Weltbestand.
- `GameManager`: Platzieren erzeugt Plan, Baustellen sind anklickbar, Bewegung unterbricht Arbeit. Kollisions-/Pfadregeln hängen am Bauzustand; Nutzfunktionen prüfen fertige Bauten. Bei Upgrade nur ausdrücklich erlaubte Bestandsfunktionen zugänglich lassen.
- Bauanzeige: „Material fehlt: 2 Lianen“, „Werkzeug fehlt“, „Arbeitsplatz blockiert“, „Pausiert“ und Fortschritt mit geschätzter Restzeit. Neubau/Upgrade zeigen konkrete Mehrwerte für Schlaf, Schutz, Lagerung usw.

## Umsetzungsreihenfolge und Abnahme

1. Dauerhafte Baustellen, gemeinsamer Tätigkeitsablauf, direkte Nachbarschaft, Speichern/Fortsetzen. Mit Schlafplatz und Feuerstelle erproben, anschließend alle Platzierungen durch denselben Ablauf führen.
2. Materialbestand, Rückbau und gebäudespezifischer sichtbarer Fortschritt. Bestehende Tagesbaupfade migrieren.
3. Schlafplatz → Palmendach als vollständiges Upgrade einschließlich Fläche, Kostenvergleich und erhaltener Schlafnutzung; dann weitere Übergänge.
4. Survival-Kosten, XP-Budget und Zeiten im tatsächlichen Spiel abstimmen; danach Reparatur und weitere Ausbaustufen.

Pflichttests: Kein Fortschritt ohne aktive Arbeit/am falschen Ort; kein paralleles Crafting; Unterbrechen/Tabwechsel/Schlafen/Laden; Materialbilanz bei Lieferung, Phasenwechsel, Abbruch und vollem Inventar; mehrfacher Abschluss; Kostenkonstanz bei Reload; kollidierende Upgrades; Bestandsinhalt und Brennstoff; alte Saves/Tagesbaustellen; keine XP-Schleife. Grafisch kleine und große Baustellen vor Ort prüfen, besonders Sichtbarkeit des arbeitenden Charakters hinter dem Rohbau.

Spätere Ergänzungen: Reparatur statt Abriss, gezielter Materialtransport, Bauprioritäten und Dach-/Bettmodule. Keine dieser Ergänzungen ist Voraussetzung für den ersten spielbaren Bauablauf.
