export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.9',
    date: '31.05.2026',
    changes: [
      'Arbeitsplatz: ersetzt den Ablageplatz — 4× Bruchstein + 4× Palmblatt',
      'Crafting nur noch am Arbeitsplatz möglich (Banner + deaktivierte Buttons wenn zu weit weg)',
      'Neues Sprite: Steine mit Palmblatt-Unterlage und Kreuz-Markierung',
    ],
  },
  {
    version: '1.8',
    date: '31.05.2026',
    changes: [
      'Umgebungstiere: Eidechse, Papagei, Möwe, Schmetterling & Ratte — atmosphärisch, nicht jagdbar',
      'Möwenschreie: echte MP3-Sounds bei Annäherung auf 10 Tiles, zufällig aus 2 Clips',
      'Farn-Tau: Pflanze bleibt stehen, nur Tau-Status wird zurückgesetzt — Schale fasst max. 3',
      'Tau verdampft nach ~2 Spielstunden (offene Schale), einmaliger Hinweis beim ersten Sammeln',
      'Trinken kühlt ab: Wasser -8°, Kokoswasser -6°, Morgentau -12° (nur bei Temp > 55)',
      'Primitive Axt: 2× Seil + 2× gehärteter Ast (realistischere Bindung)',
      'Ast im Feuer härten nur noch am Lagerfeuer-Menü sichtbar, nicht mehr im Crafting',
      'Viewport-Culling für alle Tiere & Fog-Caching (Performance)',
    ],
  },
  {
    version: '1.7',
    date: '31.05.2026',
    changes: [
      'Höhensystem: Tiles haben Elevation (Strand→Gras→Wald→Hügel→Berg), Übergänge blockieren Bewegung',
      'Zelda-Klippen: Felswände auf allen 4 Seiten — dunkel & hoch = unpassierbar, hell & niedrig = Pfad',
      'Große Bäume: riesige Tropenhölzer und Banyanbäume mit Luftwurzeln & breitem Kronenschatten',
      'Tau-Mechnanik: morgens (7–9 Uhr) mit Muschel an Farnen Tauwasser sammeln',
      'Farne: neue Pflanze in Gras & Dschungel, visuell detailliertes Sprite',
      'Journal-Trigger: Ereignisbasiert statt Skill-Level (Feuerstein finden, erste Jagd, etc.)',
      'Muschelklinge entfernt, Muschel als Sammelwerkzeug neu eingeführt',
      'Baumstümpfe und Treibholz überarbeitet, Driftwood-Grafik erneuert',
      'Welt 250×250: Palmen auch auf Wiese, Kräuter reduziert, Äste nur unter Bäumen',
    ],
  },
  {
    version: '1.6',
    date: '30.05.2026',
    changes: [
      'Toasts gebündelt: Skill-XP, Level-Up & Materialentdeckungen oben mittig im Canvas',
      'Journal: neuer Tab "Entdeckungen" mit allen erstmals aufgehobenen Materialien',
      'Materialentdeckungs-Meldungen 10 Sekunden sichtbar, danach sanftes Ausblenden',
      'Kokosnuss öffnen: Kokoswasser wird sofort getrunken (Durst -20, Ausdauer +8)',
      'Erstes Kokoswasser: atmosphärischer Toast + Journal-Eintrag als Erinnerung',
      'Hunger/Durst/Müdigkeit-Balken invertiert: voll = gut, leer = kritisch',
    ],
  },
  {
    version: '1.5',
    date: '29.05.2026',
    changes: [
      'Eingebungs-Journal: Skill-Level-Ups schalten Rezept-Eingebungen frei statt Schlaf-Gate',
      'Knowledge-System: Eingebungen annehmen gewährt Wissen und entsperrt Rezepte',
      'Crafting immer erfolgreich — kein Zufallsfaktor mehr',
      'Journal-Button links unter dem Ausrüstungsbild, Hilfe-Button oben rechts',
      'DevPanel: +6 Stunden überspringen mit realistischer Stat-Abnahme',
      'Obsidian-Klinge setzt knows_tool_binding voraus (erst nach Feuersteinmesser sichtbar)',
    ],
  },
  {
    version: '1.4',
    date: '28.05.2026',
    changes: [
      'Grübel-System: Abends am Lagerfeuer über Bedürfnisse nachdenken → Rezepte organisch entdecken',
      'Knowledge-Flags: 16 Flags steuern Sichtbarkeit von Rezepten & Bauten',
      'Skill-System: 8 Skills (Lv1–10) mit XP-Balken im HUD, diminishing Returns',
      'BuildBar: Bau-Menü am unteren Bildrand mit Kategorien statt Modal',
      'Neue Crafting-Kette: Feuerstein → Scharfer Stein → Klinge → Axt/Speer',
      'Schlafplatz: provisorisches Blätterlager mit Gesundheitsmalus',
      'Lagerfeuer braucht jetzt Feuerstein als Zündhilfe',
      'Schlaf-Restriktionen: Nickerchen & Nachtschlaf nur bei Müdigkeit/Verletzung',
      'Regen gewährt Schutz- und Wasser-Erkenntnisse',
      'Verderbliche Items: Stapelung erneuert Ablaufdatum',
    ],
  },
  {
    version: '1.3',
    date: '17.05.2026',
    changes: [
      'Wildschwein mit Patrouille/Aggro/Angriff-KI und Feuer-Angst',
      'Steinspeer: Nahkampf per Mausklick mit Stoß-Animation (2 Tiles Reichweite)',
      'Gegenstände ablegen (↓) und aufheben (F) mit Pickup-Menü',
      'Karte auf 250×250 vergrößert, radiales Insel-Layout',
      'Einführungsmusik "Salz im Mund" beim Spielstart',
      'Dramatische Erwachungssequenz beim ersten Spielstart',
      'Tag-Zähler oben mittig im Spiel',
      'Feuerstein nur noch am Strand verfügbar',
    ],
  },
  {
    version: '1.2',
    date: '15.05.2026',
    changes: [
      'Krabben und Schildkröten mit Wandern/Fliehen-KI',
      'Steinspeer-Wurf (6 Tiles) und Messer-Nahkampf',
      'Rohes Schildkrötenfleisch vergiftet',
      'Pfützen nahe Spawn ersetzen Wasserquelle',
      'Prozeduraler Footstep-Sound (Sand/Gras/Wald)',
      'Sprinten mit Shift (128 px/s), 6-stufiges Müdigkeitssystem',
      'Schlafsystem: Qualität (Outdoor/Unterschlupf/Hütte) + Dauer 2–10h',
      'Palmendach: 2 Tiles breit mit Lager (4 Slots)',
    ],
  },
  {
    version: '1.1',
    date: '10.05.2026',
    changes: [
      'Musik: Tag/Nacht-Crossfade mit Howler.js',
      'Harzbaum: Baumharz sammeln, Kokosschale als Behälter',
      'Fackel: Äste + Seil + Baumharz, erhellt die Nacht',
      'Stamina-System mit Hunger- und Müdigkeitsmultiplikator',
      'Hunger-Drain zweiphasig über zwei Tage',
      'Optionen-Modal mit Lautstärkeregler',
    ],
  },
  {
    version: '1.0',
    date: '10.05.2026',
    changes: [
      'Tile-basierte Welt (150×150, prozedural generiert)',
      'Spielerbewegung, Equipment-System (Kopf/Brust/Beine/Hände/Gürtel)',
      'Nebel des Krieges: dynamische Sichtweite, Lagerfeuer & Fackel-Licht',
      'Tag/Nacht-Zyklus mit Overlay',
      'Ressourcen sammeln, Crafting, Schlafen, Lagerung',
      'Baustellen, Lagerfeuer-Brennstoffsystem, Ackerbeet, Angeln',
      'Tutorial: Intro-Modal + 6-stufiges Onboarding',
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
export const CURRENT_DATE    = CHANGELOG[0].date;
