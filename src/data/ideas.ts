/**
 * Grübel-System — Reflection / Idea progression
 *
 * Flow:
 *   Sleep ≥6h + campfire nearby → player chooses a ReflectionFocus
 *   Next day: material pickups with matching focus trigger IdeaInsights
 *   When all requiredInsights collected → idea completes → grantsKnowledge fired
 */

import type { KnowledgeFlag } from './knowledge';

export type ReflectionFocus =
  | 'water'
  | 'food'
  | 'tools'
  | 'shelter'
  | 'medicine'
  | 'fire'
  | 'hunting'
  | 'storage';

export const FOCUS_LABELS: Record<ReflectionFocus, string> = {
  water:    'Wasser & Trinken',
  food:     'Nahrung & Versorgung',
  tools:    'Werkzeuge & Verarbeitung',
  shelter:  'Unterkunft & Schutz',
  medicine: 'Gesundheit & Medizin',
  fire:     'Feuer & Wärme',
  hunting:  'Jagd & Fallen',
  storage:  'Lagerung & Ordnung',
};

export const FOCUS_ICONS: Record<ReflectionFocus, string> = {
  water:    '💧',
  food:     '🍖',
  tools:    '🪓',
  shelter:  '🏕️',
  medicine: '🌿',
  fire:     '🔥',
  hunting:  '🏹',
  storage:  '📦',
};

/** Which focuses are available from the start; others unlock via knowledge */
export const INITIAL_FOCUSES: ReflectionFocus[] = ['water', 'food', 'tools', 'shelter', 'fire'];

/**
 * Which knowledge flag unlocks each additional focus.
 * Focuses in INITIAL_FOCUSES are always available.
 */
export const FOCUS_UNLOCK_CONDITIONS: Partial<Record<ReflectionFocus, KnowledgeFlag>> = {
  medicine: 'knows_binding',       // once you know plants can bind wounds
  hunting:  'knows_basic_fire',    // fire = can roast prey, motivates hunting
  storage:  'knows_fire',          // controlled fire = you're staying a while
};

export interface IdeaInsight {
  id: string;
  /** Material pickup that triggers this insight (when focus is active) */
  triggeredBy: string;
  /** Text shown as toast when triggered */
  text: string;
}

export interface Idea {
  id: string;
  name: string;
  focus: ReflectionFocus;
  /** Ordered insight steps — player collects these materials to reveal the idea */
  insights: IdeaInsight[];
  /** Knowledge flag(s) granted when all insights are collected */
  grantsKnowledge: KnowledgeFlag[];
  /** Optional: knowledge flag that must already be known before this idea can progress */
  requiresKnowledge?: KnowledgeFlag;
}

export const IDEAS: Idea[] = [

  // ── Shelter ─────────────────────────────────────────────────────────────
  {
    id: 'idea_palm_roof',
    name: 'Palmendach',
    focus: 'shelter',
    insights: [
      {
        id: 'insight_waterproof_leaf',
        triggeredBy: 'palm_leaf',
        text: 'Das Palmblatt ist breit und lässt Wasser abperlen. Es könnte Regen abhalten. 🌴',
      },
      {
        id: 'insight_branch_frame',
        triggeredBy: 'sticks',
        text: 'Ein paar gebogene Äste könnten ein einfaches Gerüst bilden. 🪵',
      },
      {
        id: 'insight_liana_binding',
        triggeredBy: 'vine',
        text: 'Die Liane ist zäh genug, um Blätter und Äste fest zu verbinden. 🌿',
      },
    ],
    grantsKnowledge: ['knows_basic_shelter'],
  },
  {
    id: 'idea_stable_structure',
    name: 'Stabile Konstruktion',
    focus: 'shelter',
    requiresKnowledge: 'knows_basic_shelter',
    insights: [
      {
        id: 'insight_crossbeam',
        triggeredBy: 'wood',
        text: 'Dickeres Holz trägt mehr Last. Querbalken könnten ein Dach halten. 🪵',
      },
      {
        id: 'insight_lash_tight',
        triggeredBy: 'vine',
        text: 'Fest verschnürte Verbindungen machen alles stabiler. 🌿',
      },
    ],
    grantsKnowledge: ['knows_construction'],
  },

  // ── Water ────────────────────────────────────────────────────────────────
  {
    id: 'idea_rain_collector',
    name: 'Einfacher Regensammler',
    focus: 'water',
    insights: [
      {
        id: 'insight_shell_holds_water',
        triggeredBy: 'coconut_shell',
        text: 'Die Kokosschale ist wasserdicht — sie könnte Flüssigkeit sammeln. 🥥',
      },
      {
        id: 'insight_leaf_channels_water',
        triggeredBy: 'palm_leaf',
        text: 'Palmblätter leiten Regenwasser wie eine Rinne ab. 🌴',
      },
    ],
    grantsKnowledge: ['knows_rain_collection'],
  },
  {
    id: 'idea_boil_water',
    name: 'Wasser abkochen',
    focus: 'water',
    requiresKnowledge: 'knows_fire',
    insights: [
      {
        id: 'insight_murky_water',
        triggeredBy: 'water',
        text: 'Das Wasser sieht trüb aus. Kochen könnte es sicherer machen. 💧',
      },
      {
        id: 'insight_boil_kills',
        triggeredBy: 'coconut_shell',
        text: 'In einer Schale über der Flamme — das Wasser blubbert, das Schlechte verdampft. 🔥',
      },
    ],
    grantsKnowledge: ['knows_preservation'],
  },

  // ── Tools ────────────────────────────────────────────────────────────────
  {
    id: 'idea_sharp_stone',
    name: 'Scharfer Stein',
    focus: 'tools',
    insights: [
      {
        id: 'insight_flint_splits',
        triggeredBy: 'flint',
        text: 'Der Feuerstein splittert scharf. Durch gezieltes Schlagen könntest du eine Klinge formen. 🪨',
      },
    ],
    grantsKnowledge: ['knows_sharp_edges'],
  },
  {
    id: 'idea_tool_assembly',
    name: 'Klinge und Griff',
    focus: 'tools',
    requiresKnowledge: 'knows_sharp_edges',
    insights: [
      {
        id: 'insight_blade_needs_handle',
        triggeredBy: 'sharp_flint',
        text: 'Die Klinge schneidet gut — aber nur mit einem Griff lässt sich Kraft dahinter setzen. 🪨',
      },
      {
        id: 'insight_fiber_lash',
        triggeredBy: 'fiber',
        text: 'Fester gewickelt hält die Klinge am Ast — das ergibt ein echtes Werkzeug. 🌾',
      },
    ],
    grantsKnowledge: ['knows_tool_binding'],
  },
  {
    id: 'idea_fire_hardening',
    name: 'Holz im Feuer härten',
    focus: 'tools',
    requiresKnowledge: 'knows_fire',
    insights: [
      {
        id: 'insight_heat_hardens',
        triggeredBy: 'sticks',
        text: 'Ein Ast, den man langsam in der Glut dreht, wird hart und zäh wie Knochen. 🔥',
      },
    ],
    grantsKnowledge: ['knows_hardened_wood'],
  },

  // ── Fire ─────────────────────────────────────────────────────────────────
  {
    id: 'idea_campfire',
    name: 'Lagerfeuerstelle',
    focus: 'fire',
    insights: [
      {
        id: 'insight_pebbles_spark',
        triggeredBy: 'pebbles',
        text: 'Zwei Kiesel aneinander — ein Funken. Mit trockenem Zunder könnte das klappen. 🪨',
      },
      {
        id: 'insight_dry_wood_burns',
        triggeredBy: 'sticks',
        text: 'Trockene Äste brennen gut. Ein Steinring hält das Feuer sicher beisammen. 🪵',
      },
    ],
    grantsKnowledge: ['knows_basic_fire'],
  },

  // ── Food ─────────────────────────────────────────────────────────────────
  {
    id: 'idea_cooking',
    name: 'Kochen am Feuer',
    focus: 'food',
    requiresKnowledge: 'knows_fire',
    insights: [
      {
        id: 'insight_heat_safe',
        triggeredBy: 'food',
        text: 'Rohe Nahrung kann krank machen. Hitze tötet das Schlechte ab. 🍖',
      },
    ],
    grantsKnowledge: ['knows_cooking'],
  },
  {
    id: 'idea_food_preservation',
    name: 'Nahrung haltbar machen',
    focus: 'food',
    requiresKnowledge: 'knows_cooking',
    insights: [
      {
        id: 'insight_dried_meat',
        triggeredBy: 'boar_meat',
        text: 'Fleisch über dem Feuer getrocknet hält sich viel länger. 🥩',
      },
      {
        id: 'insight_herbs_preserve',
        triggeredBy: 'herbs',
        text: 'Manche Kräuter hemmen Fäulnis. Einreiben verlängert die Haltbarkeit. 🌿',
      },
    ],
    grantsKnowledge: ['knows_preservation'],
  },

  // ── Medicine ─────────────────────────────────────────────────────────────
  {
    id: 'idea_wound_herbs',
    name: 'Wunden versorgen',
    focus: 'medicine',
    insights: [
      {
        id: 'insight_herb_cooling',
        triggeredBy: 'herbs',
        text: 'Zerriebene Kräuter auf einer Wunde — die Hitze lässt nach. Das hilft. 🌿',
      },
      {
        id: 'insight_palm_bandage',
        triggeredBy: 'palm_leaf',
        text: 'Ein breites Blatt als Verband hält die Kräuter auf der Wunde. 🌴',
      },
    ],
    grantsKnowledge: ['knows_medicine'],
  },
  {
    id: 'idea_fever_treatment',
    name: 'Fieber senken',
    focus: 'medicine',
    requiresKnowledge: 'knows_medicine',
    insights: [
      {
        id: 'insight_bitter_herb',
        triggeredBy: 'herbs',
        text: 'Der bittere Geruch dieser Pflanze — dein Körper erinnert dich: das hilft gegen Fieber. 🌿',
      },
      {
        id: 'insight_tea_fever',
        triggeredBy: 'water',
        text: 'Als heißer Sud wäre das wirkungsvoller als roh. Abkochen und trinken. 💧',
      },
    ],
    grantsKnowledge: ['knows_medicine'],
  },

  // ── Hunting ──────────────────────────────────────────────────────────────
  {
    id: 'idea_primitive_weapon',
    name: 'Primitive Waffe',
    focus: 'hunting',
    requiresKnowledge: 'knows_sharp_edges',
    insights: [
      {
        id: 'insight_sharp_tip',
        triggeredBy: 'sharp_flint',
        text: 'Eine scharfe Spitze am Ende eines langen Astes — das wäre ein Speer. 🗡️',
      },
      {
        id: 'insight_long_stick_reach',
        triggeredBy: 'sticks',
        text: 'Ein gerader langer Ast gibt dem Wurfspeer Reichweite und Stabilität. 🪵',
      },
    ],
    grantsKnowledge: ['knows_basic_weapon'],
  },
  {
    id: 'idea_animal_tracks',
    name: 'Tiere beobachten',
    focus: 'hunting',
    requiresKnowledge: 'knows_basic_weapon',
    insights: [
      {
        id: 'insight_boar_hide',
        triggeredBy: 'boar_hide',
        text: 'Das Fell des Tieres — dicht und zäh. Die Herde hält sich wahrscheinlich im Dickicht auf. 🐗',
      },
      {
        id: 'insight_meat_fresh',
        triggeredBy: 'boar_meat',
        text: 'Frisches Fleisch bedeutet: das Tier war kürzlich hier. Die Jagdroute lässt sich ausnutzen. 🥩',
      },
    ],
    grantsKnowledge: ['knows_basic_weapon'],
  },

  // ── Storage ──────────────────────────────────────────────────────────────
  {
    id: 'idea_dry_cache',
    name: 'Trockenes Vorratslager',
    focus: 'storage',
    insights: [
      {
        id: 'insight_elevated_storage',
        triggeredBy: 'sticks',
        text: 'Auf erhöhten Ästen bleibt Vorrat trocken und vor Tieren sicher. 🪵',
      },
      {
        id: 'insight_palm_wrap',
        triggeredBy: 'palm_leaf',
        text: 'In Palmenblätter gewickelt hält sich alles länger. 🌴',
      },
      {
        id: 'insight_vine_seal',
        triggeredBy: 'vine',
        text: 'Fest verschnürt bleibt der Beutel dicht — kein Tier kommt rein. 🌿',
      },
    ],
    grantsKnowledge: ['knows_construction'],
  },
  {
    id: 'idea_smoke_preservation',
    name: 'Räuchern',
    focus: 'storage',
    requiresKnowledge: 'knows_fire',
    insights: [
      {
        id: 'insight_smoke_smell',
        triggeredBy: 'wood',
        text: 'Dichter Rauch vom Feuer — Fleisch darin hängen macht es haltbar. 🔥',
      },
      {
        id: 'insight_smoked_meat',
        triggeredBy: 'boar_meat',
        text: 'Geräuchertes Fleisch riecht anders, hält sich aber wochenlang. 🥩',
      },
    ],
    grantsKnowledge: ['knows_preservation'],
  },
];

/** All insight IDs that belong to a given focus */
export function getInsightsByFocus(focus: ReflectionFocus): Map<string, { idea: Idea; insight: IdeaInsight }> {
  const map = new Map<string, { idea: Idea; insight: IdeaInsight }>();
  for (const idea of IDEAS) {
    if (idea.focus !== focus) continue;
    for (const insight of idea.insights) {
      // Later ideas overwrite earlier ones for the same material — first match wins
      if (!map.has(insight.triggeredBy)) {
        map.set(insight.triggeredBy, { idea, insight });
      }
    }
  }
  return map;
}
