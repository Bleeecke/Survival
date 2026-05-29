export type SkillId =
  | 'flintknapping'
  | 'woodworking'
  | 'cordage'
  | 'firemaking'
  | 'foraging'
  | 'cooking'
  | 'hunting'
  | 'shelterbuilding';

export interface Skill {
  level: number; // 1–10
  xp: number;    // 0 bis (level * 20), dann Level-up
}

export type Skills = Record<SkillId, Skill>;

export const SKILL_LABELS: Record<SkillId, string> = {
  flintknapping:   'Feuersteinklopfen',
  woodworking:     'Holzbearbeitung',
  cordage:         'Kordel & Seile',
  firemaking:      'Feuermachen',
  foraging:        'Sammeln',
  cooking:         'Kochen',
  hunting:         'Jagen',
  shelterbuilding: 'Unterkunftsbau',
};

export const SKILL_IDS: SkillId[] = [
  'flintknapping', 'woodworking', 'cordage', 'firemaking',
  'foraging', 'cooking', 'hunting', 'shelterbuilding',
];

export const DEFAULT_SKILLS: Skills = {
  flintknapping:   { level: 1, xp: 0 },
  woodworking:     { level: 1, xp: 0 },
  cordage:         { level: 1, xp: 0 },
  firemaking:      { level: 1, xp: 0 },
  foraging:        { level: 1, xp: 0 },
  cooking:         { level: 1, xp: 0 },
  hunting:         { level: 1, xp: 0 },
  shelterbuilding: { level: 1, xp: 0 },
};

// XP pro Ressourcentyp beim Sammeln
export const GATHER_SKILL_XP: Partial<Record<string, { skill: SkillId; xp: number }>> = {
  // flint + pebbles geben kein XP — Erfahrung kommt nur durch aktives Klopfen
  wood:         { skill: 'woodworking',   xp: 5 },
  fiber:        { skill: 'cordage',       xp: 5 },
  vine:         { skill: 'cordage',       xp: 5 },
  herbs:        { skill: 'foraging',      xp: 8 },
  mushroom:     { skill: 'foraging',      xp: 6 },
  exotic_fruit: { skill: 'foraging',      xp: 8 },
  food:         { skill: 'foraging',      xp: 4 },
  fish:         { skill: 'hunting',       xp: 6 },
  boar_meat:    { skill: 'hunting',       xp: 10 },
  turtle_meat:  { skill: 'hunting',       xp: 8 },
  crab_meat:    { skill: 'hunting',       xp: 6 },
};
