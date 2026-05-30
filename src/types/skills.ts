export type SkillId =
  | 'survival'
  | 'crafting'
  | 'building'
  | 'naturelore'
  | 'hunting'
  | 'cooking'
  | 'medicine'
  | 'body';

export interface Skill {
  level: number; // 1–10
  xp: number;    // 0 bis (level * 20), dann Level-up
}

export type Skills = Record<SkillId, Skill>;

export const SKILL_LABELS: Record<SkillId, string> = {
  survival:   'Überleben',
  crafting:   'Handwerk',
  building:   'Bauen',
  naturelore: 'Naturkunde',
  hunting:    'Jagen',
  cooking:    'Kochen',
  medicine:   'Medizin',
  body:       'Körperbeherrschung',
};

export const SKILL_DESCRIPTIONS: Record<SkillId, string> = {
  survival:   'Feuer, Wasser, Wetter, Schlaf, Grundroutinen',
  crafting:   'Werkzeuge, Seile, Stein, einfache Verarbeitung',
  building:   'Unterstände, Lager, Werkbank, Palisaden',
  naturelore: 'Pflanzen, Kräuter, Pilze, Ressourcen erkennen',
  hunting:    'Tiere, Speere, Fallen, Zerlegen',
  cooking:    'Nahrung sicher machen, haltbar machen, Wasser abkochen',
  medicine:   'Wunden, Krankheit, Salben, Gegengift',
  body:       'Ausdauer, Tragen, Schleichen, Bewegung im Gelände',
};

export const SKILL_IDS: SkillId[] = [
  'survival', 'crafting', 'building', 'naturelore',
  'hunting', 'cooking', 'medicine', 'body',
];

export const DEFAULT_SKILLS: Skills = {
  survival:   { level: 1, xp: 0 },
  crafting:   { level: 1, xp: 0 },
  building:   { level: 1, xp: 0 },
  naturelore: { level: 1, xp: 0 },
  hunting:    { level: 1, xp: 0 },
  cooking:    { level: 1, xp: 0 },
  medicine:   { level: 1, xp: 0 },
  body:       { level: 1, xp: 0 },
};

// XP pro Ressourcentyp beim Sammeln
export const GATHER_SKILL_XP: Partial<Record<string, { skill: SkillId; xp: number }>> = {
  flint:        { skill: 'crafting',   xp: 4 },
  pebbles:      { skill: 'survival',   xp: 3 },
  wood:         { skill: 'crafting',   xp: 5 },
  sticks:       { skill: 'crafting',   xp: 3 },
  fiber:        { skill: 'crafting',   xp: 4 },
  vine:         { skill: 'crafting',   xp: 4 },
  herbs:        { skill: 'naturelore', xp: 8 },
  mushroom:     { skill: 'naturelore', xp: 6 },
  exotic_fruit: { skill: 'naturelore', xp: 8 },
  food:         { skill: 'naturelore', xp: 4 },
  palm_leaf:    { skill: 'naturelore', xp: 3 },
  fish:         { skill: 'hunting',    xp: 6 },
  boar_meat:    { skill: 'hunting',    xp: 10 },
  boar_hide:    { skill: 'hunting',    xp: 8 },
  turtle_meat:  { skill: 'hunting',    xp: 8 },
  crab_meat:    { skill: 'hunting',    xp: 6 },
  iron_ore:     { skill: 'crafting',   xp: 6 },
  stone:        { skill: 'building',   xp: 3 },
  granite:      { skill: 'building',   xp: 4 },
};
