export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
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
