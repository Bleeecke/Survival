/**
 * Grübel-System — Reflection / Idea progression
 *
 * Flow:
 *   Sleep ≥6h + campfire nearby → player chooses a ReflectionFocus
 *   Next day: material pickups with matching focus trigger IdeaInsights
 *   When all requiredInsights collected → idea completes → grantsKnowledge fired
 */

import type { KnowledgeFlag } from './knowledge';
import rawIdeas from './json/ideas.json';

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
export const INITIAL_FOCUSES: ReflectionFocus[] = ['water', 'tools', 'shelter'];

/**
 * Which knowledge flag unlocks each additional focus.
 * Focuses in INITIAL_FOCUSES are always available.
 */
export const FOCUS_UNLOCK_CONDITIONS: Partial<Record<ReflectionFocus, KnowledgeFlag>> = {
  fire:     'knows_basic_fire',
  food:     'knows_fire',
  medicine: 'knows_binding',
  hunting:  'knows_basic_fire',
  storage:  'knows_fire',
};

export interface IdeaInsight {
  id: string;
  triggeredBy: string;
  text: string;
}

export interface Idea {
  id: string;
  name: string;
  focus: ReflectionFocus;
  insights: IdeaInsight[];
  grantsKnowledge: KnowledgeFlag[];
  requiresKnowledge?: KnowledgeFlag;
}

export const IDEAS: Idea[] = rawIdeas as Idea[];

/** All insight IDs that belong to a given focus */
export function getInsightsByFocus(focus: ReflectionFocus): Map<string, { idea: Idea; insight: IdeaInsight }> {
  const map = new Map<string, { idea: Idea; insight: IdeaInsight }>();
  for (const idea of IDEAS) {
    if (idea.focus !== focus) continue;
    for (const insight of idea.insights) {
      if (!map.has(insight.triggeredBy)) {
        map.set(insight.triggeredBy, { idea, insight });
      }
    }
  }
  return map;
}
