import type { SkillId } from '../types/skills';
import type { KnowledgeFlag } from './knowledge';

export type BuildCategory =
  | 'survival' | 'fire' | 'shelter' | 'storage'
  | 'water' | 'food' | 'workstation' | 'hunting' | 'medicine';

export interface BuildMaterial { item: string; amount: number; }
export interface BuildSkillReq  { skill: SkillId; level: number; }

export interface PlacementRules {
  blockedTerrain?: string[];
  requiresOpenSky?: boolean;   // e.g. rain collector
  requiresNearbyFire?: boolean;
  noOverlap?: boolean;
}

export interface BuildDefinition {
  id: string;
  name: string;
  icon: string;
  category: BuildCategory;
  description: string;
  effects: string[];           // Human-readable effect lines shown in UI
  requiredMaterials: BuildMaterial[];
  requiredTools: string[];
  requiredSkills: BuildSkillReq[];
  requiredKnowledge: KnowledgeFlag[];
  /** Materials the player must have SEEN (any one of them) for the entry to be visible at all */
  visibleWhenSeen: string[];
  buildTime: number;           // seconds
  /** Knowledge flags granted when this structure is placed */
  grantsKnowledge?: KnowledgeFlag[];
  placementRules?: PlacementRules;
}

const B = (def: BuildDefinition): BuildDefinition => def;

// ── Überleben ────────────────────────────────────────────────────────
const storageSpot = B({
  id: 'storage_spot',
  name: 'Ablageplatz',
  icon: '🟫',
  category: 'survival',
  description: 'Ein markierter Bodenbereich – keine Kiste, nur eine Zone. Sofort nutzbar, aber völlig ungeschützt: Regen beschädigt Nahrung, Tiere können stehlen, Sturm verstreut Gegenstände.',
  effects: ['Sofort baubar, keine Materialien', 'Kleine Kapazität', '⚠ Kein Regenschutz', '⚠ Tiere können stehlen', '⚠ Sturm verstreut Gegenstände'],
  requiredMaterials: [],
  requiredTools: [],
  requiredSkills: [],
  requiredKnowledge: ['knows_basic_storage'],
  visibleWhenSeen: [],
  buildTime: 2,
});

const campfire = B({
  id: 'campfire',
  name: 'Lagerfeuerstelle',
  icon: '🔥',
  category: 'fire',
  description: 'Steine als Ring, Äste als Brennholz – Wärme, Licht und Kochen. Regen und Wind können das Feuer löschen.',
  effects: ['Wärme & Licht', 'Kochen möglich', 'Hält Tiere fern', 'Risiko: Regen & Wind'],
  requiredMaterials: [{ item: 'sticks', amount: 5 }, { item: 'pebbles', amount: 3 }, { item: 'flint', amount: 1 }],
  requiredTools: [],
  requiredSkills: [{ skill: 'firemaking', level: 1 }],
  requiredKnowledge: ['knows_basic_fire'],
  visibleWhenSeen: ['sticks', 'pebbles', 'flint'],
  buildTime: 8,
  grantsKnowledge: ['knows_fire'],
});

const rainCollector = B({
  id: 'water_container',
  name: 'Einfacher Regensammler',
  icon: '🥥',
  category: 'water',
  description: 'Kokosschale unter freiem Himmel aufstellen – fängt bei Regen kleine Mengen Wasser auf. Trocken: leer.',
  effects: [
    'Sammelt Regenwasser passiv',
    'Kapazität: 2 Schluck',
    'Nur bei Regen aktiv',
    'Muss unter freiem Himmel stehen',
    'Tipp: Kokosschale braucht Axt oder Messer',
  ],
  requiredMaterials: [{ item: 'coconut_shell', amount: 1 }, { item: 'palm_leaf', amount: 1 }],
  requiredTools: [],
  requiredSkills: [],
  requiredKnowledge: ['knows_rain_collection'],
  visibleWhenSeen: ['coconut_shell', 'coconut'],
  buildTime: 10,
  placementRules: { requiresOpenSky: true },
  grantsKnowledge: [],
});

const sleepingSpot = B({
  id: 'sleeping_spot',
  name: 'Schlafplatz',
  icon: '🌿',
  category: 'survival',
  description: 'Ein paar Palmblätter auf dem Boden – provisorisch. Schützt kaum, aber besser als nichts.',
  effects: ['Schlafen möglich', 'Schlechte Erholung', 'Leichter Gesundheitsmalus', 'Kein Schutz gegen Regen oder Kälte'],
  requiredMaterials: [{ item: 'palm_leaf', amount: 4 }],
  requiredTools: [],
  requiredSkills: [],
  requiredKnowledge: ['knows_basic_rest'],
  visibleWhenSeen: ['palm_leaf'],
  buildTime: 5,
});

// ── Schutz ──────────────────────────────────────────────────────────
const palmShelter = B({
  id: 'palm_shelter',
  name: 'Palmendach',
  icon: '🌴',
  category: 'shelter',
  description: 'Äste als Gestell, Palmblätter als Dach, Lianen als Bindung. Schützt vor leichtem Regen – bei Sturm instabil.',
  effects: [
    'Schutz vor leichtem Regen',
    'Besserer Schlaf (⛺ Qualität)',
    'Hält Nässe von Lagerplatz fern',
    'Nachteil: sturmanfällig',
    'Messer in der Hand: kürzere Bauzeit',
  ],
  requiredMaterials: [
    { item: 'sticks', amount: 8 },
    { item: 'palm_leaf', amount: 6 },
    { item: 'vine', amount: 3 },
  ],
  requiredTools: [],
  requiredSkills: [{ skill: 'shelterbuilding', level: 1 }],
  requiredKnowledge: ['knows_basic_shelter'],
  visibleWhenSeen: ['palm_leaf', 'vine', 'sticks'],
  buildTime: 40,
  grantsKnowledge: ['knows_construction'],
});

const woodenShelter = B({
  id: 'wooden_shelter',
  name: 'Holzunterkunft',
  icon: '🏠',
  category: 'shelter',
  description: 'Stabilere Unterkunft – braucht 2 Tage Arbeit nach dem Aufstellen.',
  effects: ['+80% Regenprotection', '+30% Schlafqualität', 'Schutz vor Kälte'],
  requiredMaterials: [{ item: 'wood', amount: 20 }, { item: 'stone', amount: 5 }],
  requiredTools: ['stone_axe'],
  requiredSkills: [{ skill: 'shelterbuilding', level: 2 }, { skill: 'woodworking', level: 1 }],
  requiredKnowledge: ['knows_construction'],
  visibleWhenSeen: ['wood', 'stone'],
  buildTime: 120,
});

const logCabin = B({
  id: 'log_cabin',
  name: 'Blockhütte',
  icon: '🏡',
  category: 'shelter',
  description: 'Feste Unterkunft – 4 Tage Arbeit, viel Holz und Steine nötig.',
  effects: ['Vollschutz gegen Regen & Kälte', '+60% Schlafqualität', 'Permanenter Heimatpunkt'],
  requiredMaterials: [
    { item: 'wood', amount: 40 },
    { item: 'stone', amount: 20 },
    { item: 'plank', amount: 10 },
  ],
  requiredTools: ['stone_axe'],
  requiredSkills: [{ skill: 'shelterbuilding', level: 3 }, { skill: 'woodworking', level: 3 }],
  requiredKnowledge: ['knows_construction'],
  visibleWhenSeen: ['plank'],
  buildTime: 300,
});

const bed = B({
  id: 'bed',
  name: 'Bett',
  icon: '🛏️',
  category: 'shelter',
  description: 'Bretter und Palmblätter – erholt viel schneller.',
  effects: ['+35% Schlafqualität', '+20% Erholungsrate', 'Setzt Schlafpunkt'],
  requiredMaterials: [{ item: 'plank', amount: 8 }, { item: 'palm_leaf', amount: 10 }],
  requiredTools: [],
  requiredSkills: [{ skill: 'shelterbuilding', level: 3 }, { skill: 'woodworking', level: 3 }],
  requiredKnowledge: ['knows_construction'],
  visibleWhenSeen: ['plank'],
  buildTime: 90,
  placementRules: { requiresNearbyFire: false },
});

// ── Lager ───────────────────────────────────────────────────────────
const storageBox = B({
  id: 'storage_box',
  name: 'Lagerbox',
  icon: '📦',
  category: 'storage',
  description: 'Holz und Seil – lagert bis zu 20 Slot Materialien.',
  effects: ['20 Lagerslots', 'Schützt Inhalt vor Regen (20%)'],
  requiredMaterials: [{ item: 'wood', amount: 8 }, { item: 'rope', amount: 2 }],
  requiredTools: ['stone_axe'],
  requiredSkills: [{ skill: 'woodworking', level: 2 }],
  requiredKnowledge: ['knows_construction'],
  visibleWhenSeen: ['wood', 'rope'],
  buildTime: 60,
});

// ── Feuer ───────────────────────────────────────────────────────────
const graniteCampfire = B({
  id: 'granite_campfire',
  name: 'Granit-Feuerstelle',
  icon: '🔥',
  category: 'fire',
  description: 'Feuerstelle aus Granit – hält doppelt so lange wie normales Lagerfeuer.',
  effects: ['2× längere Brenndauer', 'Bessere Wärmeabgabe'],
  requiredMaterials: [{ item: 'granite', amount: 6 }, { item: 'sticks', amount: 4 }],
  requiredTools: ['stone_pickaxe'],
  requiredSkills: [{ skill: 'firemaking', level: 2 }],
  requiredKnowledge: ['knows_fire'],
  visibleWhenSeen: ['granite'],
  buildTime: 45,
});

const torch = B({
  id: 'torch',
  name: 'Fackelhalter',
  icon: '🔦',
  category: 'fire',
  description: 'Befestigte Fackel – leuchtet dauerhaft an einem Platz.',
  effects: ['+3 Sichtweite in der Nacht', 'Markiert wichtige Orte'],
  requiredMaterials: [
    { item: 'sticks', amount: 2 },
    { item: 'rope', amount: 1 },
    { item: 'tree_resin', amount: 2 },
  ],
  requiredTools: [],
  requiredSkills: [],
  requiredKnowledge: ['knows_fire'],
  visibleWhenSeen: ['tree_resin'],
  buildTime: 20,
});

// ── Nahrung ─────────────────────────────────────────────────────────
const dryingRack = B({
  id: 'drying_rack',
  name: 'Trockengestell',
  icon: '🍊',
  category: 'food',
  description: 'Äste und Seil – trocknet Nahrung in der Sonne ohne Feuer.',
  effects: ['Fisch & Früchte trocknen ohne Lagerfeuer', 'Bis zu 10 Tage Haltbarkeit'],
  requiredMaterials: [{ item: 'sticks', amount: 6 }, { item: 'rope', amount: 2 }],
  requiredTools: [],
  requiredSkills: [{ skill: 'cooking', level: 2 }],
  requiredKnowledge: ['knows_preservation'],
  visibleWhenSeen: ['fish', 'boar_meat', 'exotic_fruit'],
  buildTime: 50,
  placementRules: { requiresOpenSky: true },
});

const smokingRack = B({
  id: 'smoking_rack',
  name: 'Räucherstelle',
  icon: '🥩',
  category: 'food',
  description: 'Holz, Seil und Palmblatt über Feuer – räuchert Fleisch für lange Haltbarkeit.',
  effects: ['Räuchert Fleisch & Fisch', '+50% Haltbarkeit gegenüber getrocknet'],
  requiredMaterials: [
    { item: 'wood', amount: 8 },
    { item: 'rope', amount: 4 },
    { item: 'palm_leaf', amount: 2 },
  ],
  requiredTools: [],
  requiredSkills: [{ skill: 'firemaking', level: 3 }, { skill: 'cooking', level: 2 }],
  requiredKnowledge: ['knows_preservation', 'knows_fire'],
  visibleWhenSeen: ['boar_meat', 'fish'],
  buildTime: 80,
  placementRules: { requiresNearbyFire: true },
});

// ── Werkstätten ──────────────────────────────────────────────────────
const workbench = B({
  id: 'workbench',
  name: 'Werkbank',
  icon: '🪚',
  category: 'workstation',
  description: 'Schaltet fortgeschrittenes Handwerk frei – Bretter, bessere Werkzeuge, Strukturen.',
  effects: ['Fortgeschrittenes Crafting', '-10% Fehlschlagchance', 'Mehr Rezepte sichtbar'],
  requiredMaterials: [{ item: 'wood', amount: 15 }, { item: 'stone', amount: 10 }],
  requiredTools: ['stone_axe'],
  requiredSkills: [{ skill: 'woodworking', level: 2 }],
  requiredKnowledge: ['knows_construction'],
  visibleWhenSeen: ['wood', 'stone'],
  buildTime: 90,
});

const furnace = B({
  id: 'furnace',
  name: 'Schmelzofen',
  icon: '🏭',
  category: 'workstation',
  description: 'Schmilzt Eisenerz zu Barren – Tor zur Metalltechnik.',
  effects: ['Eisenerz → Eisenbarren', 'Schaltet Eisenwerkzeuge frei'],
  requiredMaterials: [
    { item: 'wood', amount: 20 },
    { item: 'stone', amount: 15 },
    { item: 'plank', amount: 10 },
  ],
  requiredTools: ['stone_axe'],
  requiredSkills: [{ skill: 'firemaking', level: 4 }, { skill: 'woodworking', level: 4 }],
  requiredKnowledge: ['knows_metal', 'knows_fire'],
  visibleWhenSeen: ['iron_ore'],
  buildTime: 180,
});

const farmPlot = B({
  id: 'farm_plot',
  name: 'Ackerbeet',
  icon: '🌾',
  category: 'food',
  description: 'Bretter und Steine – produziert passiv Nahrung alle 40 Sek.',
  effects: ['Passiv: 1× Nahrung alle 40s'],
  requiredMaterials: [{ item: 'plank', amount: 10 }, { item: 'stone', amount: 5 }],
  requiredTools: [],
  requiredSkills: [{ skill: 'foraging', level: 3 }],
  requiredKnowledge: ['knows_construction'],
  visibleWhenSeen: ['plank'],
  buildTime: 120,
});

// ── Medizin ──────────────────────────────────────────────────────────
const herbDryingRack = B({
  id: 'herb_drying_rack',
  name: 'Kräutergestell',
  icon: '🌿',
  category: 'medicine',
  description: 'Trocknet Kräuter – stärker als frische Kräuter in Heilmitteln.',
  effects: ['+25% Heilwirkung bei Kräutermitteln'],
  requiredMaterials: [{ item: 'sticks', amount: 4 }, { item: 'vine', amount: 2 }],
  requiredTools: [],
  requiredSkills: [{ skill: 'foraging', level: 2 }],
  requiredKnowledge: ['knows_medicine'],
  visibleWhenSeen: ['herbs'],
  buildTime: 30,
  placementRules: { requiresOpenSky: true },
});

// ── Jagd ─────────────────────────────────────────────────────────────
const snare = B({
  id: 'snare_trap',
  name: 'Schlinge',
  icon: '🪤',
  category: 'hunting',
  description: 'Einfache Falle aus Seil – fängt kleinere Tiere passiv.',
  effects: ['Fängt Kleintiere passiv', 'Muss täglich kontrolliert werden'],
  requiredMaterials: [{ item: 'rope', amount: 2 }, { item: 'sticks', amount: 3 }],
  requiredTools: [],
  requiredSkills: [{ skill: 'hunting', level: 2 }],
  requiredKnowledge: ['knows_basic_weapon'],
  visibleWhenSeen: ['rope'],
  buildTime: 20,
});

export const BUILD_DEFINITIONS: BuildDefinition[] = [
  storageSpot, campfire, rainCollector, sleepingSpot,
  palmShelter, woodenShelter, logCabin, bed,
  storageBox,
  graniteCampfire, torch,
  dryingRack, smokingRack, farmPlot,
  workbench, furnace,
  herbDryingRack,
  snare,
];

export const BUILD_CATEGORY_LABELS: Record<BuildCategory, { label: string; icon: string }> = {
  survival:    { label: 'Überleben',    icon: '🏕️' },
  fire:        { label: 'Feuer',        icon: '🔥' },
  shelter:     { label: 'Schutz',       icon: '🏠' },
  storage:     { label: 'Lager',        icon: '📦' },
  water:       { label: 'Wasser',       icon: '💧' },
  food:        { label: 'Nahrung',      icon: '🍖' },
  workstation: { label: 'Werkstätten',  icon: '🪚' },
  hunting:     { label: 'Jagd',         icon: '🏹' },
  medicine:    { label: 'Medizin',      icon: '🌿' },
};

export function getBuildDefinition(id: string): BuildDefinition | undefined {
  return BUILD_DEFINITIONS.find(d => d.id === id);
}
