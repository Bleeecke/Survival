# Survival: Lernen, Fortschritt und langfristige Ziele

Stand: 2026-09-08 · Lebendes Arbeitsdokument für Chris und mitarbeitende KI/Agenten.

## 1. Auftrag und Verbindlichkeit

**Vom Nutzer vorgegeben:** Ein herausforderndes tropisches Singleplayer-Survival-Spiel mit langfristigem Spielspaß und erreichbaren Zielen. Sammeln, Wasser, Nahrung, Schlaf, Crafting und Werkzeugfortschritt sollen zusammenhängen. Die Figur weiß und kann nicht von Anfang an alles. Ein einfacher Unterschlupf soll naheliegen; gute Werkzeuge und anspruchsvolle Konstruktionen verlangen Erfahrung. Skill soll Erfolg und besonders gute Ergebnisse beeinflussen. „RimWorld-mäßig“ verstehen wir hier als Wunsch nach spürbarer Kompetenz, Qualitätsunterschieden und Geschichten aus Systemen; kein Auftrag, dessen konkrete Regeln zu kopieren.

**Projektgrenzen aus CLAUDE.md:** Keine Maschinen oder Elektrizität, technisches Ende bei primitiven Eisenwerkzeugen. Wissen durch Erleben. Ressourcen bleiben relevant. Phaser zeichnet die Welt, React die Oberfläche, Zustand hält den Spielzustand.

**Statuskennzeichnung:**

- **IST:** Im aktuellen Quellcode nachvollzogen; kein Ersatz für einen vollständigen Spieldurchlauf.
- **BEFUND:** Konkrete Abweichung oder problematische Abhängigkeit im Code.
- **VORSCHLAG:** Diskussionsgrundlage, noch keine beschlossene oder implementierte Mechanik.
- **OFFEN:** Entscheidung oder weitere Prüfung erforderlich.

Dieses Dokument beauftragt keine automatische Umsetzung aller Vorschläge. Bestehende Nutzerentscheidungen haben Vorrang. Zahlen für neue Mechaniken sind Testwerte, keine fertige Balance.

## 1a. Umsetzungsstand: erster Crafting-/Skill-Ausbau

**2026-09-08, auf Auftrag von Chris umgesetzt.** Dieser Abschnitt beschreibt den neuen Stand und ersetzt für die genannten Punkte die Ausgangsbefunde in Abschnitt 2. Die übrigen Designvorschläge sind weiterhin offen.

- Ein zentraler, nicht persistierter Auftrag in `craftingStore` verarbeitet Hand-Crafting, Werkstatt, Lagerfeuer und Bauen. Fortschritt wird aus dem Spiel-Update etwa zehnmal pro Sekunde gespeist, nicht aus separaten UI-Timern. Ein Auftrag gleichzeitig; Fenster schließen lässt ihn weiterlaufen. Pause, ausgeblendeter Tab und Schlaf stoppen den Fortschritt.
- Rezeptzeit sinkt mit dem zugeordneten Skill um 5 % je Stufe oberhalb 1, maximal 45 %. Holz härten trainiert Überleben; Kochen und Konservierung trainieren Kochen; Werkzeuge trainieren ihren Rezept-Skill. Bauen nutzt Bauen, Überlebensbauten mit entsprechendem XP-Skill nutzen Überleben für die Dauer.
- Feuersteinspalten und haltbare Werkzeuge verwenden die gemeinsame Ergebnisverteilung aus `craftingBalance.ts`: Anfänger 20/55/23/2 %, Stufe 3–5 8/27/55/10 %, Stufe 6–8 2/8/60/30 %, Stufe 9–10 0/2/48/50 % für misslungen/behelfsmäßig/solide/gut. Vorläufige Balance, noch kein Langzeit-Spieltest.
- Behelfsmäßige/solide/gute Werkzeuge haben 50/100/140 % der Basishaltbarkeit. Qualität, maximale und aktuelle Haltbarkeit bleiben beim Ausrüsten, Einlagern, Ablegen, Aufheben und Speichern erhalten. Neue Werkzeuge belegen einzelne Inventarplätze. Alte Werkzeuge ohne Qualität gelten als solide; vorhandener Verschleiß wird nicht zurückgesetzt.
- Misslingen verbraucht nur eine Einheit der ersten Rezeptzutat und gibt 25 % der normalen XP vor dem Wiederholungsabzug. Weitere Zutaten bleiben erhalten. Aufeinanderfolgende Fehlversuche reduzieren die Fehlschlagchance pro Versuch um zehn Prozentpunkte; dieser zusätzliche Bonus gilt innerhalb der laufenden Sitzung. Rezept-Wiederholungszähler und Skill-XP bleiben gespeichert.
- Materialverbrauch und Ergebnisübergabe erfolgen gemeinsam erst beim Abschluss. Bei Platzmangel wartet der Auftrag ohne Materialverlust; Abbruch gibt keine XP. Das Ergebnis wird einmal bestimmt und während des Wartens beibehalten. Nur die tatsächliche Ergebnisqualität benötigt Platz; vorhandene kompatible Stapel können genutzt werden. Die anfänglich zu strenge Prüfung aller möglichen Qualitäten wurde nach einer Fehlermeldung zum Feuersteinspalten korrigiert.
- Bekannte Verfahren verschwinden nicht bei Werkzeugverlust oder fehlendem Skill. Die Oberfläche nennt die fehlende Voraussetzung. Höhere Axt-/Spitzhackenstufen erfüllen die primitiven Werkzeuganforderungen. Gruppierte Crafting-Werkzeuge verschleißen ebenfalls, auch im Inventar.
- Die frühe Progression ist geöffnet: Das Messer nutzt einen normalen Ast statt eines gehärteten Griffs. Palmendach ist mit Grundwissen baubar und vergibt Konstruktionswissen. Fertige Feuerstelle vergibt Feuerwissen. Garen ist mit Feuerwissen zugänglich; nach drei erfolgreichen Herstellungsaufträgen für gegarte Nahrung wird Konservierung gelernt. Die entsprechenden Rezepte sind am Feuer verfügbar.
- Bauten haben tatsächliche Arbeitszeit; beim Verlassen des Umkreises von drei Feldern pausiert die Arbeit und setzt bei Rückkehr fort. Material kann aus dem Inventar, Bodenstapeln und Lagerboxen im Umkreis von drei Feldern um den Bauplatz kommen. So blockiert die 20-kg-Tragegrenze keine großen Projekte. Verbrauch erst nach abgeschlossener Arbeit.
- Bauen erhöht die maximale Strukturgesundheit um fünf Punkte je Skillstufe über 1. Neue Feuerstellen erhalten 5 % mehr anfänglichen Brennstoff je Überlebensstufe über 1. Bau-XP bekommen ebenfalls einen Wiederholungsabzug. Das sind erste Skillwirkungen, noch keine vollständige Wetterfestigkeits- oder Feuerentzündungsmechanik.

**Bewusst noch offen:** Reparaturaktionen, separates Feuerentzünden/Zunder, Zustands- und Arbeitsplatzmodifikatoren für Qualität, aktives Grübeln, zusätzlicher Ausbau von Naturkunde/Jagen/Medizin/Körperbeherrschung, Langzeitziele und eine vollständige gemeinsame Zeitsprung-Simulation. Laufende Aufträge werden beim Neuladen/Verlassen des Spiels abgebrochen; Materialien bleiben erhalten, Arbeitsfortschritt wird noch nicht gespeichert. Skill- und Gegenstandsdaten werden gespeichert.

**Prüfung:** Automatisierte Tests in `tests/crafting.test.cjs` decken den gemeinsamen Ablauf, Fehlversuche, Platzmangel, Pause, Werkzeugzustand, Baufortschritt, Material vom Boden und Kochprogression ab. Vollständiger TypeScript-/Vite-Build erfolgreich. Keine verfügbare Browseranbindung für einen visuellen Durchlauf; Bedienung und Langzeitbalance müssen im Spiel geprüft werden.

## 2. Ausgangsstand vor dem ersten Ausbau

Die getrennte Datei [TECHBAUM_IST.md](TECHBAUM_IST.md) enthält den vollständigen Datenkatalog: alle Ressourcen-Definitionen, Crafting-Rezepte, Bauvoraussetzungen und Wissensereignisse. Die Tabellen geben Daten wieder; die folgenden Befunde erklären, wo die Ausführung davon abweicht.

### Lernen und Herstellung

**IST:** Alle acht Skills starten auf Level 1; die Obergrenze ist 10. Die nächste Stufe kostet `aktuelles Level × 20` XP. Sammeln bestimmter Ressourcen und ausgewählte Rezepte/Bauten geben XP. Crafting-XP sinken pro Rezept mit `max(0,1; 1 / sqrt(Anzahl bisheriger Herstellungen + 1))`; die tatsächlich vergebenen XP werden gerundet und auf mindestens 1 begrenzt. Die Bauplatz-Ausführung vergibt ihre XP direkt, ohne diese Rezept-Abschwächung.

**IST:** Rezeptzeit sinkt um 5 % pro Stufe oberhalb 1, höchstens 45 %, wenn der jeweilige Ausführungspfad `getEffectiveCraftTime` benutzt. Es gibt harte Wissens-, Werkzeug- und vereinzelt Skill-Voraussetzungen. `isDiscovered` verbindet die Kenntnis mindestens eines Zutatenmaterials mit aktuell vorhandenem Werkzeug, Skill und Wissen. Deshalb kann eine zuvor bekannte Rezeptanzeige bei Werkzeugverlust wieder verschwinden.

**IST:** Erste Materialien vergeben teilweise sofort Wissen: Fasern → Bindung, Kräuter → Medizin, Erz → Metallwissen. Weitere Erkenntnisse kommen über Tagebuchereignisse, deren Einträge aktiv angenommen werden müssen. Regen kann Dach- und Wasserwissen direkt auslösen. „Wissen aus Erfahrung“ existiert somit, ist aber oft nur ein sofortiger Schalter nach einer einzigen Aktion.

**BEFUND:** `knap_flint` definiert 35 % Erfolg auf Stufe 1 und +6 Prozentpunkte je weiterer Stufe, also 89 % auf Stufe 10. `getSuccessChance` hat jedoch keinen aufrufenden Crafting-Pfad in `src`. Im aktuellen Crafting-Modal werden die Ausgaben ohne Erfolgswurf vergeben. Andere Rezepte haben keine solche Erfolgsdefinition. Es gibt noch keine herstellungsabhängigen Qualitätsstufen pro Gegenstand.

**BEFUND:** Das Grübelkonzept steht in `ideas.ts` und `ideas.json`, ist aber nicht in den aktuellen Schlafablauf eingebunden. Der Player-Store entfernt sogar einen alten `reflectionFocus` beim Laden. Die ältere Aussage „Grübeln vollständig integriert“ in CLAUDE.md ist daher überholt.

### Gegenwärtige frühe Kette

**IST, normaler Modus:**

1. Palmblätter → Schlafplatz; Bruchsteine + Palmblätter → Arbeitsplatz. Das nötige Grundwissen ist bereits bekannt.
2. Äste/Bruchsteine entdecken → Wissen über eine Feuerstelle. Die Feuerstelle kostet zusätzlich Feuerstein.
3. Feuerstelle bauen → Tagebuchereignis `first_campfire`; Eintrag annehmen → `knows_fire`.
4. Feuerstein + Bruchstein → scharfer Feuerstein. Zwei Äste am Feuer → gehärteter Ast. Fasern finden oder Palmblätter zerreißen.
5. Scharfer Feuerstein + gehärteter Ast + drei Fasern → Messer; Herstellung vergibt Werkzeugbindungswissen.
6. Mit Messer Fasern/Lianen zu Seil verarbeiten → primitive Axt. Die Axt öffnet Kokosnüsse; Schalen ermöglichen den Regensammler. Ein gefundenes Schalenobjekt kann diesen Teil abkürzen, sofern es tatsächlich verfügbar ist.
7. Gehärteter Ast + scharfer Stein + Fasern → Speer; daraus weiteres Jagdwissen und die Angelrute. Spitzhacke verlangt Werkzeugbindungswissen.
8. Regen und bekannte Dachmaterialien → Palmendach. Größere Konstruktionen wären der nächste Abschnitt, sind aber aktuell durch die nachstehende Wissensschleife blockiert.

**Wichtig:** `tier` ist eine Einordnung, keine automatische Zugangssperre. Das Messer ist Tier 0, benötigt über den gehärteten Ast dennoch ein Feuer. Feste Aussagen wie „Tag 2 = Messer“ wären ohne Kenntnis von Seed, Wetter und Spielverhalten irreführend.

### Blockaden und Widersprüche

| ID | Befund aus dem Code | Bedeutung / nächster Prüfschritt |
|---|---|---|
| B01 | Holzunterkunft braucht `knows_construction`; das aktive Tagebuchereignis dafür ist `first_wood_shelter` nach ihrem Bau. Die Ideen-Daten liefern keinen aktiven Ausweg. | Normale Konstruktionsprogression ist zirkulär. Erkenntnis aus einer früheren Handlung ableiten, etwa Prüfung/Verbesserung des Palmendachs. |
| B02 | Konservierung verlangt `knows_preservation`. Der Tagebucheintrag hängt an `first_cook_advanced`; kein aufrufender Ereignisauslöser in `src` gefunden. | Trocknen/Räuchern hat keinen nachgewiesenen normalen Einstieg. Zusätzlich fehlen diese Rezepte in `FIRE_CRAFT_IDS`, während das allgemeine Modal Feuerrezepte ausfiltert. |
| B03 | `getSuccessChance` wird nicht aufgerufen. | Beschreibung und Spielerfahrung beim Feuersteinspalten widersprechen sich. Erst ein einheitlicher Herstellungsabschluss, dann Chancen balancieren. |
| B04 | Bau-Definitionen haben `buildTime`; der normale `BuildDefinition`-Pfad setzt nach Materialverbrauch sofort die Struktur. Die alte Rezeptstrecke mit mehrtägigen Baustellen ist davon getrennt. | Angaben „2/4 Tage Arbeit“ sind für diesen Baupfad nicht verlässlich. Bauzeit muss echte Arbeitszeit mit Unterbrechungen werden. |
| B05 | Kochen nutzt eigene `COOKABLE`-Daten, eigene Mengen/Zeit und vergibt beim Abholen dort weder Rezept-XP noch direkt Rezept-Wissen. | Die Rezepttabellen beschreiben den tatsächlichen Kochpfad nur teilweise. Erstes Kochen ermöglicht immerhin den Tagebucheintrag für Kochwissen. |
| B06 | `obsidian_blade` gibt `flint_knife` aus; Obsidianwissen steht in JSON, fehlt aber im TS-Konstantensatz. | Keine tatsächlich eigene schärfere/sprödere Klinge; Daten/Typen auseinandergefallen. |
| B07 | Manche Rezepte/Bauten verlangen exakt `stone_axe` oder `stone_pickaxe`; nur `any_axe`/`any_knife` kennen Alternativen. | Bessere Werkzeuge ersetzen schlechtere nicht durchgängig. Werkzeugfähigkeiten statt Einzel-IDs prüfen. |
| B08 | Techbaum zeigt eine nach Kategorien gruppierte Auswahl, keine vollständige Abhängigkeit zwischen Wasser, Feuer, Bauten und Werkzeugen. Feuerrezepte/Bauten sind ausgefiltert. Materialanzeige liest außerdem das Inventar wie ein ID→Menge-Objekt statt `inventory.items`. | Anzeige erklärt Blockaden nicht zuverlässig; Materialfarben können falsch sein. Suchfilter nutzt auch bei unbekannten Rezepten ihren echten Namen. |
| B09 | Farm und Angeln haben Update-Logik; deren Timer bekommen aktuell nur im Tick-Zweig ein einzelnes Frame-Delta. | Die ältere Aussage „kein Farming-Loop“ stimmt nicht; nominelle 40 Sekunden der Farm sind dadurch aber nicht verlässlich. Zeitmodell vor Wirtschaftsbalancing vereinheitlichen. |
| B10 | Tierhaut, Knochen, Fett und weitere Definitionen haben keine normale Rezeptverwendung im Katalog. Manche Pflanzen haben Spawn-Frequenz 0. | Datenbestand ist nicht gleich erreichbarer Inhalt. Keine zusätzliche Ressource ohne Herkunft, Nutzen und Verbrauch ergänzen. |

Weitere Prüfstellen: Tool-Verschleiß wird nur für konkrete `requiresTool`-IDs angewandt, nicht für Werkzeuggruppen; Voraussetzungen werden nicht in allen Herstellungsabschlüssen gleich geprüft. Schlaf berechnet Wärme teilweise aus Unterkunftsqualität statt tatsächlichem Feuerzustand. Nahrung stapeln erneuert teils den Zeitstempel alter Nahrung. Diese Unterschiede können den späteren Ressourcendruck stärker beeinflussen als neue Rezepte.

## 3. Gewünschtes Spielerlebnis

**VORSCHLAG:** „Ich kann mich heute weiter vorwagen, weil ich gestern etwas gelernt und gut vorbereitet habe.“

Fortschritt soll nachweislich mehr Handlungsspielraum schaffen: weniger Zeit für tägliche Versorgung, längere Expeditionen, bessere Entscheidungen bei schlechtem Wetter. Es darf vorübergehende Sicherheit geben. „Permanenter Druck“ bedeutet relevante Entscheidungen und wiederkehrenden Bedarf, nicht pausenlose Bestrafung oder das automatische Entwerten guter Planung.

Die ersten Tage stellen unmittelbare Fragen: Wo schlafe ich? Woher kommt morgen Wasser? Später ändern sich die Fragen: Reicht mein Vorrat für die Erkundung? Habe ich Werkzeug und Ersatz? Kann ich diesen Ort im Sturm erreichen? Welche größere Aufgabe möchte ich abschließen?

Mehr Holz für dieselbe Axt allein erzeugt keine Langzeitmotivation. Neue Stufen brauchen neue Möglichkeiten, erkennbare Meilensteine und andere Risiken.

## 4. Entdecken, versuchen, beherrschen

**VORSCHLAG:** Vier getrennte Zustände pro Technik:

| Zustand | Spielerwissen / Oberfläche | Beispiel |
|---|---|---|
| Unbekannt | Kein vollständiges Rezept, höchstens beobachtbare Materialeigenschaften | „Dieser Stein bricht anders als die anderen.“ |
| Vermutung | Konkreter Ansatz, begründete Versuchsaktion | „Vielleicht lässt sich eine scharfe Kante abschlagen.“ |
| Erprobt | Rezept dauerhaft bekannt, auch wenn Material/Werkzeug gerade fehlt | „Die Klinge funktioniert, die Bindung hält schlecht.“ |
| Beherrscht | Zuverlässige Herstellung und Zugang zu anspruchsvollen Varianten | Stabile Messer, gute Bindungen, kontrollierter Materialeinsatz |

Wissen beantwortet **was und warum**, Skill beantwortet **wie zuverlässig und wie gut**, Ausrüstung und Zustand beantworten **unter welchen Bedingungen**. Ein einzelnes Kräuterblatt sollte keine umfassende Medizin freischalten. Erz erkennen sollte noch kein Verständnis des gesamten Verhüttens bedeuten.

Bekanntes darf bei Werkzeugverlust nicht wieder „???“ werden. Zeige stattdessen „bekannt, Schneidwerkzeug fehlt“. Der Techbaum wird ein Wissensnetz mit konkreten nächsten Versuchen, keine Liste aller späteren Bauanleitungen. Eine optionale vollständige Entwickleransicht hilft Agenten und Tests, ohne Entdeckungen im normalen Spiel vorwegzunehmen.

**Gegen Sackgassen:** Jede lebenswichtige Basistechnik hat mindestens einen zugänglichen Weg ohne Wetterglück, seltene Beute oder Erfolg genau dieser Technik. Ein schlechtes Blattdach darf ohne ersten Regen ausprobiert werden; Regen zeigt seine Schwächen und motiviert die Verbesserung. Wissen darf nicht ausschließlich beim Schlafen entstehen: Ruhiges Beobachten/Arbeiten bietet eine langsamere Alternative.

## 5. Skill, Fehlschlag und Qualität

**VORSCHLAG:** Ein erstes Messer darf gelingen. Ein gutes Messer soll auffallen. Schwierigkeit, Erfahrung, Materialeignung, Arbeitsplatz und Verfassung bestimmen gemeinsam das Ergebnis. Harte Skill-Sperren nur für wirklich komplexe Verfahren; bei einfachen Werkzeugen lieber einen riskanten Versuch erlauben.

Als kleiner erster Prototyp reichen vier Ergebnisse:

| Ergebnis | Wirkung | Lernwert |
|---|---|---|
| Misslungen | Kein fertiges Werkzeug; ein Teil des geeigneten Materials bleibt übrig | Konkreter Hinweis und begrenzte Übungs-XP |
| Behelfsmäßig | Benutzbar, deutlich geringere Haltbarkeit | Der Spieler kommt weiter und erkennt Verbesserungsbedarf |
| Solide | Normale Haltbarkeit und Leistung | Verlässlicher Standard |
| Gut | Höhere Haltbarkeit, eventuell kleiner Zeitvorteil | Sichtbare Belohnung für Können und Vorbereitung |

Erfolg und Qualität zunächst mit einer gemeinsamen Ergebnisverteilung bestimmen, nicht mit mehreren unabhängigen Würfen, die das Risiko undurchsichtig vervielfachen.

**Unverbindliche Testverteilung für ein einfaches Steinwerkzeug bei geeignetem Arbeitsplatz und ausgeruhtem Zustand:**

| Erfahrungsbereich | Misslungen | Behelfsmäßig | Solide | Gut |
|---|---:|---:|---:|---:|
| Anfänger (1–2) | 20 % | 55 % | 23 % | 2 % |
| Geübt (3–5) | 8 % | 27 % | 55 % | 10 % |
| Erfahren (6–8) | 2 % | 8 % | 60 % | 30 % |
| Meisterlich (9–10) | 0 % | 2 % | 48 % | 50 % |

Das ist keine universelle Tabelle: Feuersteinspalten kann anfangs schwieriger sein als das Binden eines bereits brauchbaren Splitters. Ein Anfänger soll nicht durch wiederholten Verlust aller Startressourcen sterben. Bei wiederholtem Misslingen eines Grundverfahrens steigt durch beobachteten Lernfortschritt die Chance auf wenigstens ein behelfsmäßiges Ergebnis. Keine vorgetäuschte Zufallsanzeige: solche Lernboni erklären.

Erst Haltbarkeit als Qualitätswirkung prototypisieren, etwa 50/100/140 % für behelfsmäßig/solide/gut. Nicht gleichzeitig Ertrag, Schaden, Geschwindigkeit und Gewicht vervielfachen. Materialstufe und Qualität bleiben getrennt: ein gutes Steinmesser hat einen Nutzen, ersetzt aber nicht jede Fähigkeit eines Eisenwerkzeugs.

**Beispiel Messer:** Groben Abschlag herstellen → ohne Griff kurzfristig schneiden können → unsaubere Bindung ergibt behelfsmäßiges Messer → wiederholte echte Nutzung, Nachbinden und bessere Vorbereitung ergeben verlässliche Werkzeuge. Holz muss für das erste Notmesser im Vorschlag nicht zwingend gehärtet sein; Härtung ist eine Verbesserung. Das entschärft die heutige Abhängigkeit vom Feuer.

**XP-Regeln:** Sinnvolle Versuche und Nutzung lehren, nicht nur Erfolg. Neue Verfahren und angemessen schwierige Aufgaben geben mehr als hundert identische Seile. Fehlversuchs-XP begrenzen; billige Wiederholung darf keine schnelle Meisterschaft erzeugen. Bauen/Abreißen darf keinen XP-Kreislauf ohne angemessene Kosten bilden. Spezialisierung entsteht durch Zeit und Praxis, nicht durch unerklärliches Verlernen anderer Skills.

**Gegenstandsdaten:** Qualität und Resthaltbarkeit müssen am konkreten Gegenstand gespeichert werden, auch beim Ablegen, Einlagern und erneuten Ausrüsten. Unterschiedliche Werkzeuge nicht unbemerkt in einen Stack ohne individuelle Eigenschaften verschmelzen. Alte Spielstände bekommen ausdrücklich Standardqualität; kein stilles Heilen beschädigter Werkzeuge beim Ausrüsten.

### S01 – Die acht Skills und ihr Lernfortschritt

**Status: Als Designrichtung mit Chris abgestimmt und auf seinen Wunsch dokumentiert (2026-09-08). Noch nicht umgesetzt.** Konkrete XP-Werte, Wahrscheinlichkeiten und Bonusgrenzen bleiben zu testen; die Beispielzahlen oben sind weiterhin Vorschläge.

Wir behalten die acht bereits angelegten Skills und geben ihnen klar unterscheidbare Auswirkungen. Die Orientierung an RimWorld betrifft erfahrungsabhängiges Können, Arbeitsgeschwindigkeit und Ergebnisqualität; die Regeln werden auf einen einzelnen Überlebenden angepasst.

| Skill / bestehende ID | Erfahrung durch | Geplante Verbesserung mit Erfahrung |
|---|---|---|
| **Überleben** / `survival` | Feuer entzünden und erhalten, Wasser aufbereiten, einfache Lagerarbeiten | Zuverlässigeres Feuermachen, sparsamerer Zunderverbrauch, schnellere grundlegende Survival-Arbeiten |
| **Handwerk** / `crafting` | Feuerstein bearbeiten, Schnüre herstellen, Werkzeuge bauen und reparieren | Kürzere Herstellungszeit, bessere Ergebnisqualität, höhere Werkzeughaltbarkeit und bessere Reparaturen |
| **Bauen** / `building` | Unterstände errichten, Dächer verbessern, Strukturen reparieren | Höhere Baugeschwindigkeit, wetterfestere und haltbarere Konstruktionen |
| **Naturkunde** / `naturelore` | Pflanzen untersuchen, gezielt sammeln, Pflanzen anbauen | Bessere Pflanzenkenntnis, Ernteerträge und Pflege; gefährliche Nahrung besser einschätzen |
| **Jagen** / `hunting` | Tiere beobachten, Spuren lesen, Fallen stellen, jagen und zerlegen | Besseres Anschleichen, sicherere Waffenhandhabung, erfolgreicherer Fallenbetrieb und mehr verwertbare Tierbeute |
| **Kochen** / `cooking` | Mahlzeiten zubereiten, Nahrung trocknen und räuchern | Kürzere Zubereitungszeit, weniger misslungene oder verdorbene Ergebnisse, besserer Nährwert und längere Haltbarkeit |
| **Medizin** / `medicine` | Wunden versorgen, Verbände anlegen, Heilmittel herstellen | Bessere Behandlungsqualität, wirksamere Mittel und geringeres Infektionsrisiko |
| **Körperbeherrschung** / `body` | Laufen, Klettern, Schwimmen und Tragen unter Belastung | Geringerer Ausdauerverbrauch, höhere Trittsicherheit und bessere Bewegung mit Gepäck |

Die Tabelle beschreibt das Zielbild. Spurenlesen, Klettern, Reparaturen und andere genannte Tätigkeiten dürfen nicht allein aufgrund dieses Eintrags als bereits vorhandene Spielmechaniken behandelt werden.

**Lernregeln:**

- Erfahrung entsteht durch passende Tätigkeiten, nicht allein durch verstrichene Zeit.
- Sinnvolle Fehlversuche geben begrenzte Erfahrung. Lernen darf nicht ausschließlich erfolgreichen Figuren offenstehen.
- Neue und angemessen anspruchsvolle Arbeiten lehren mehr als endlose Wiederholung desselben einfachen Rezepts.
- Schlaf kann Erfahrungen festigen, erzeugt aber ohne vorherige Praxis keine Erfahrung.
- Wissen und Skill bleiben getrennt: Erz erkennen verrät noch nicht das Verfahren der Eisenherstellung. Erst ein bekanntes Verfahren kann mit wachsendem Können zuverlässiger und besser ausgeführt werden.
- Gute Skills erleichtern Alltagsarbeit spürbar. Spätere Herausforderung entsteht durch größere Vorhaben und Expeditionen; einfache Arbeiten bleiben nicht künstlich unzuverlässig.

**Beispiel Messer:**

| Können | Gewünschtes Spielerlebnis |
|---|---|
| Anfänger | Darf einen Versuch wagen. Häufig entsteht eine grobe, kurzlebige Klinge; gelegentlich misslingt die Arbeit. |
| Geübt | Brauchbare Messer gelingen zuverlässig und schneller. |
| Erfahren | Gute Messer halten länger; Reparaturen werden wirksamer. |
| Meister | Einfache Messer gelingen nahezu sicher. Anspruchsvolle Werkzeuge bleiben von Material und Arbeitsbedingungen abhängig. |

**Erste Ausbaustufe:** Handwerk, Bauen und Überleben vollständig wirksam machen und den Ablauf vom ersten Feuerstein bis zum zuverlässigen Lager prüfen. Anschließend die übrigen Skills nach denselben Grundregeln ausbauen. Das ergänzt die Prioritäten in Abschnitt 9; bestehende Fortschrittsblockaden und uneinheitliche Crafting-Pfade müssen zuvor bzw. dabei behoben werden.

**Noch auszuarbeiten:** XP pro Tätigkeit, Bonuskurven, Schutz gegen stumpfes Training sowie genaue Zuständigkeiten bei Überschneidungen. Beispielsweise Wasseraufbereitung versus Kochen und Anschleichen versus Körperbeherrschung vor der Umsetzung eindeutig zuordnen, damit eine Aktion nicht unbeabsichtigt mehrfach belohnt wird.

## 6. Schlaf, Wasser, Nahrung und Arbeit als zusammenhängender Ablauf

**VORSCHLAG:** Schlaf schafft Arbeitsfähigkeit und festigt bereits gemachte Erfahrungen. Er erfindet keine Technik ohne Beobachtung und Praxis. Vor dem Schlaf kann die Figur eine offene Frage auswählen. Guter Schlaf macht die nächste Schlussfolgerung leichter; schlechter Schlaf verlangsamt sie, blockiert aber nicht den gesamten Techbaum.

| System | Druck | Verbesserung | Neue Möglichkeit |
|---|---|---|---|
| Wasser | Versorgung bindet Wege und Zeit | Auffangen, sichere Aufbereitung, transportierbare Vorräte | Längere Erkundung außerhalb der Wasserstelle |
| Nahrung | Verderb und riskante Beschaffung | Kochen, Konservierung, mehrere Bezugsquellen | Reiseproviant und Schlechtwetterreserve |
| Schlaf | Erschöpfung senkt Arbeitsleistung | Trockene Unterlage, Dach, später gutes Bett | Anspruchsvolle Arbeiten ausgeruht planen |
| Feuer | Brennstoff, Nässe, Unterhalt | Zunder trocken lagern, Feuer schützen, Glut erhalten | Kochen, Härtung, später Metallverfahren |
| Werkzeug | Verschleiß und ineffiziente Arbeit | Nachbinden, Reparatur, bessere Materialien | Größere Bauprojekte und neue Gebiete |
| Lager | Tragegrenze, Wege, Vorratsschutz | Geordnete Lagerung und Zwischenlager | Mehrtägige Vorhaben statt Einzelfahrten |

Feuerstelle bauen und Feuer entzünden werden als getrennte Handlungen vorgeschlagen. Ein Steinring allein gibt kein Wissen über das Beherrschen von Feuer. Zunder und Brennstoff müssen sichtbar unterschiedliche Aufgaben haben. Für den ersten Prototyp genügt ein vereinfachtes, spielbares Verfahren; keine realweltliche Handwerks-Simulation bis ins Detail.

Lange Arbeiten brauchen eine gemeinsame Simulationszeit. Schlaf, Kochen, Bauen, Nahrung, Wetter und Brennstoff dürfen beim Zeitsprung nicht unterschiedlich altern. Längere Bauarbeiten lassen sich unterbrechen; bereits geleistete Arbeit bleibt. Zehn Minuten Balkenbeobachten sind kein anspruchsvolles Bauen.

## 7. Fortschrittsabschnitte und erreichbare Ziele

**VORSCHLAG, keine Tages-Sperren:**

| Abschnitt | Nachweisbarer Meilenstein | Was dadurch neu möglich wird |
|---|---|---|
| Ankommen | Erste Nacht überleben, erreichbares Wasser kennen, provisorischen Schlafschutz anlegen | Einen Tag bewusst planen |
| Improvisieren | Nutzbare Klinge, erstes selbst entzündetes Feuer, eine gegarte Mahlzeit | Material verarbeiten, gefährliche Nahrung sicherer nutzen |
| Verlässlich leben | Versorgung für mehrere Tage, reparierbares Werkzeug, Dach hält normalen Regen | Das Lager für eine Expedition verlassen |
| Insel erschließen | Zwei Außenlager und eine vorbereitete Route durch ein schwieriges Gebiet | Seltene Materialien und Hinweise für ein Großziel erreichen |
| Handwerk meistern | Wiederholt solide Werkzeuge, Werkstatt, belastbares Lager und Konservierung | Große Projekte planbar ausführen |
| Primitives Eisen | Verfahren verstanden, funktionsfähige Feuertechnik, erstes selbst hergestelltes Eisenwerkzeug | Letzte Ausbau- und Expeditionsprojekte |
| Abschluss | Ein zusammenhängendes Langzeitziel tatsächlich erfüllen | Abschluss mit Rückblick; optional weiterspielen |

Stufen sind ein Netz: Jagd ist nicht der einzige Ernährungsweg; Metall darf nicht Voraussetzung für jede sinnvolle Langzeitaufgabe sein. Schutz und Versorgung entwickeln sich neben dem Werkzeugzweig. Kein obligatorisches „erst 100 Gegenstände craften“.

### Drei mögliche Langzeitziele

**Z01 – Rettung vorbereiten (empfohlener erster Zielpfad, noch offen):** Einen geeigneten Signalort erkunden, Zugang/Versorgung sichern, sichtbares Signal und wettergeschützten Brennstoffvorrat vorbereiten, ein angekündigtes Sichtfenster nutzen. Erfolg verlangt Planung aus mehreren Systemen, keinen zufälligen Rettungswurf nach stundenlangem Warten. Nach verpasstem Fenster gibt es einen nachvollziehbaren weiteren Versuch. Keine Elektronik erforderlich. Rettung braucht nicht zwingend Eisen; Metall kann die Vorbereitung erleichtern.

**Z02 – Die Insel verstehen:** Mehrteilige Expedition mit auffindbaren Hinweisen, gefährlichen Orten und praktischen Schlussfolgerungen. Wissen über Wasser, Wetter, Tiere oder sichere Routen ist die Belohnung. Kein flächendeckendes Abklappern belangloser Sammelobjekte.

**Z03 – Auf Dauer bestehen:** Ein Versorgungsnetz aufbauen, eine angekündigte schwere Wetterphase mit vorbereiteten Reserven bewältigen und anschließend die Versorgung wiederherstellen. Erfolg wird über klar messbare Zustände bewertet, nicht über einen unendlichen Timer. Freies Weiterspielen bleibt möglich.

Zunächst einen Zielpfad vollständig umsetzen. Drei halbfertige Enden helfen weniger als ein sinnvoller Abschluss.

## 8. Ressourcenpolitik und faire Herausforderung

**VORSCHLAG:** Jede Ressource bekommt eine klare Herkunft, einen frühen Hinweis auf ihre Eigenschaften, mindestens einen relevanten Verwendungszweck und einen Grund, sie später noch zu beachten. Alternativen sollten Entscheidungen ermöglichen: Liane schnell nutzbar, geflochtenes Seil zuverlässiger; seltenes Material nicht bloß ein andersfarbiger Stein mit größerer Zahl.

- Knochen: Haken/Nadel als Verbindung von Jagd zu Angeln und Verarbeitung.
- Tierhaut/Fell: begrenzter Wetterschutz oder Behälter nach einer einfachen Verarbeitungskette. Doppelte IDs `hide`/`boar_hide` zuerst fachlich klären.
- Fett: Brenn- oder Pflegemittel mit Verderb/Verbrauch, wenn es ein reales Spielproblem löst.
- Harz: Bindung abdichten, Werkzeug reparieren, Brennstoff – vorhandene Rolle vertiefen.
- Lehm und Holzkohle: nur ergänzen, wenn die primitive Eisenkette damit verständlicher und spielerisch interessanter wird; beide sind hier Vorschläge, kein vorhandener Inhalt.

Frühe Engpässe dürfen sich entspannen. Eine bessere Axt soll Holzarbeit tatsächlich erleichtern. Die Herausforderung wandert zu Transport, Vorbereitung und größerer Reichweite, statt Holzbedarf beliebig hochzusetzen. Passive Produktion braucht Standort, Aufwand und Grenzen; endlos automatisch ins Inventar erzeugtes Essen macht Versorgung bedeutungslos.

Wettergefahren ankündigen und Gegenmaßnahmen ermöglichen. Nicht jede Verbesserung durch skalierende Katastrophen sofort neutralisieren. Ein funktionierendes Lager ist eine verdiente Ausgangsbasis für anspruchsvollere Aufgaben.

## 9. Umsetzung in kleinen überprüfbaren Schritten

| Priorität | Arbeitspaket | Abnahmekriterium |
|---|---|---|
| P0 | Bestehende Wissensschleifen und nicht erreichbare Menüpunkte beheben | Frisches Spiel erreicht Feuer → Messer → Konstruktion → Konservierung ohne Entwicklerfreigabe; jeder Schritt hat einen aktiven Auslöser. |
| P0 | Gemeinsamen Herstellungsabschluss für die verschiedenen Oberflächen festlegen | Materialien, Wissen, Werkzeug, Platz, Zeit, XP und Ergebnis folgen überall derselben Regel. Abbruch/volle Taschen führen nicht zu Duplikaten oder stillen Verlusten. |
| P1 | Ein Lern-/Qualitätsprototyp: Abschlag und Messer | Anfänger können weiterkommen; Erfahrung verbessert messbar Ergebnis und Haltbarkeit; Fehlschläge geben nachvollziehbares Feedback. |
| P1 | Bekanntes Wissen von momentaner Herstellbarkeit trennen | Verlorenes Werkzeug versteckt keine gelernte Technik; unbekannte Technik wird nicht durch Suche verraten. |
| P1 | Schlaf und Zeit konsistent; Basisversorgung abstimmen | Schlaf/Tabpause/Crafting erzeugen keine Sonderwege zu unbegrenzt Vorräten oder Gratisfortschritt. |
| P2 | Unterbrechbare Bauarbeit, Werkzeugreparatur und Expeditionen | Vorbereitung spart spürbar Risiko und Zeit; Fortschritt bleibt beim Unterbrechen erhalten. |
| P2 | Einen vollständigen Langzeitzielpfad | Klarer Beginn, mehrere sinnvolle Zwischenziele, überprüfbarer Abschluss und freiwilliges Weiterspielen. |
| P3 | Zusätzliche Materialien, Spezialgebiete und Weltvarianten | Jede Ergänzung schafft eine Entscheidung statt nur mehr Sammellast. |

Vor Änderungen neue Begriffe in `src/types/` definieren. Keine zweite Crafting-Logik im UI ergänzen. Daten und Runtime-Verhalten getrennt prüfen. Für neue Systeme nicht wieder pro Bild die gesamte Welt verarbeiten: Lernereignisse ereignisgesteuert, Bedürfnisse in festen Simulationsschritten, Grafik unabhängig davon.

### Spieltests und Messfragen

- Mehrere feste Seeds vom frischen Start prüfen, einschließlich ungünstiger Ressourcenverteilung und ausbleibendem Regen. Dev-Modus aus.
- Wie lange bis Wasser, Notunterstand, erster brauchbarer Klinge, selbst entzündetem Feuer und stabiler Versorgung? Median und problematische Ausreißer statt nur einen guten Durchlauf betrachten.
- Wie viele Fehlversuche bis zum ersten nutzbaren Werkzeug? Bleibt immer eine verständliche Überlebensoption?
- Welcher Anteil der Zeit ist dieselbe Versorgungsroutine? Sinkt er mit Kompetenz zugunsten neuer Aufgaben?
- Welche Technik kann nur durch sich selbst gelernt werden? Jede solche Schleife braucht einen alternativen Einstieg.
- Werden Qualität/Verschleiß durch Speichern, Ablegen, Stapeln oder Ausrüsten umgangen?
- Sind Fehler rückblickend verständlich? Hat ein Wetterereignis eine Entscheidung erzwungen oder nur Vorräte vernichtet?
- Erreichen erfahrene Spieler später neue Entscheidungen, oder nur größere Materialkosten?

## 10. Offene Entscheidungen für Chris

1. Soll Rettung das erste konkrete Hauptziel sein, mit optionalem Weiterspielen, oder soll dauerhaftes Bestehen im Vordergrund stehen?
2. Soll die Figur ein unerfahrener Durchschnittsmensch sein oder einen kleinen wählbaren Erfahrungshintergrund besitzen?
3. Wie sichtbar sind Chancen: genaue Prozente oder verständliche Einschätzungen mit Einflussfaktoren?
4. Tod: neuer Lauf, optionaler Speicherstand oder wählbarer Modus? Noch keine Entscheidung aus dem bisherigen Gespräch ableiten.
5. Wie lang soll ein vollständiger Lauf ungefähr sein? Erst nach einem spielbaren frühen Abschnitt belastbar planen.

## 11. Zusammenarbeit und Ideenprotokoll

Agenten lesen zuerst CLAUDE.md, dieses Dokument und den Ist-Katalog. Bei Widerspruch zählt für IST der aktuelle Code; für die Richtung zählt die Nutzerentscheidung. Keine Ideen stillschweigend als beschlossen umetikettieren. Beim Bearbeiten vorhandene Beiträge erhalten oder mit Begründung als ersetzt markieren.

Neue Beiträge verwenden eine stabile ID und folgende Vorlage:

```markdown
### I-XXX – Titel
Status: VORSCHLAG | ZU PRÜFEN | BESCHLOSSEN | UMGESETZT | VERWORFEN
Autor / Datum:
Problem aus Spieltest oder Code:
Vorgeschlagene Regel und konkrete Spielsituation:
Abhängigkeiten / betroffene Ressourcen und Techniken:
Warum entsteht eine interessante Entscheidung?
Risiken: Grind, Sackgasse, Zufallsfrust, Leistungsbedarf, Speicherstände
Kleinster testbarer Prototyp:
Abnahmekriterium:
Gegenargument / Alternative:
Entscheidung durch Chris / Begründung:
```

Bei Umsetzung: betroffene Befund-ID verlinken, echten Prüfstand nennen und den Ist-Katalog aktualisieren. Eine Dateidefinition allein ist kein Beweis für eine aktive Mechanik. Neue Vorschläge dürfen dieses Dokument erweitern; widersprüchliche Alternativen nebeneinander diskutieren, bis eine Entscheidung feststeht.

### Entscheidungen und Änderungen

| Datum | Autor | Eintrag |
|---|---|---|
| 2026-09-08 | Chris | Herausforderung, langfristiger Spielspaß, erreichbare Ziele und erfahrungsabhängiges Können als gewünschte Richtung. |
| 2026-09-08 | Codex | Quellcode-Abgleich und erster Designentwurf. Alle neuen Mechaniken und Zahlen bleiben Vorschläge. Keine Spielregeln durch diesen Dokumentationsschritt verändert. |
| 2026-09-08 | Chris / Codex | Skillrichtung S01 festgehalten: acht Skills, Lernen durch Tätigkeit, bessere Qualität und Geschwindigkeit, Trennung von Wissen und Können. Zuerst Handwerk, Bauen und Überleben ausbauen. Nur dokumentiert; Zahlen und Detailbalance offen. |

## 12. Quellcode für die weitere Arbeit

- [CraftingSystem](src/services/game/CraftingSystem.ts): Entdeckung, Voraussetzungen, Erfolgsfunktion, XP und Rezeptzeit.
- [CraftingModal](src/components/game/CraftingModal.tsx), [InventoryPanel](src/components/game/InventoryPanel.tsx), [CampfireModal](src/components/game/CampfireModal.tsx): tatsächliche Herstellungsabschlüsse.
- [BuildMenu](src/components/game/BuildMenu.tsx), [GameManager](src/services/phaser/GameManager.ts): Bausichtbarkeit, Platzierung, Ressourcen, Wetter, Jagd/Farm/Angeln.
- [Player-Store](src/store/playerStore.ts), [Journal-Store](src/store/journalStore.ts), [SleepModal](src/components/game/SleepModal.tsx): Wissen, Erfahrung, Tagebuch und Schlaf.
- [TechbaumModal](src/components/game/TechbaumModal.tsx): derzeitige Anzeige.
- [Ideen](src/data/ideas.ts), [Skills](src/types/skills.ts), [Haltbarkeit](src/data/toolDurability.ts), [Verderb](src/data/foodDecay.ts): Detailregeln bzw. vorhandene Daten.
