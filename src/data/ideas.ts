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

/** Which focuses are available from the start; others unlock later */
export const INITIAL_FOCUSES: ReflectionFocus[] = ['water', 'food', 'tools', 'shelter'];

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
    id: 'idea_sleeping_spot',
    name: 'Einfacher Schlafplatz',
    focus: 'shelter',
    insights: [
      {
        id: 'insight_soft_ground',
        triggeredBy: 'palm_leaf',
        text: 'Aufgeschichtete Blätter wären weicher als blanker Boden. 🍃',
      },
    ],
    grantsKnowledge: ['knows_basic_rest'],
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
];

/** All insight IDs that belong to a given focus */
export function getInsightsByFocus(focus: ReflectionFocus): Map<string, { idea: Idea; insight: IdeaInsight }> {
  const map = new Map<string, { idea: Idea; insight: IdeaInsight }>();
  for (const idea of IDEAS) {
    if (idea.focus !== focus) continue;
    for (const insight of idea.insights) {
      map.set(insight.triggeredBy, { idea, insight });
    }
  }
  return map;
}
