/**
 * Knowledge flags — what the player has understood through experience.
 * Never shown as abstract strings. Each flag shows an "Aha-Moment" toast once.
 *
 * Source of truth: src/data/json/knowledgeDefinitions.json
 */

import rawKnowledge from './json/knowledgeDefinitions.json';

export const KNOWLEDGE_FLAGS = {
  knows_basic_rest:      'knows_basic_rest',
  knows_basic_storage:   'knows_basic_storage',
  knows_basic_fire:      'knows_basic_fire',
  knows_sharp_edges:     'knows_sharp_edges',
  knows_hardened_wood:   'knows_hardened_wood',
  knows_binding:         'knows_binding',
  knows_tool_binding:    'knows_tool_binding',
  knows_basic_weapon:    'knows_basic_weapon',
  knows_basic_shelter:   'knows_basic_shelter',
  knows_rain_collection: 'knows_rain_collection',
  knows_fire:            'knows_fire',
  knows_cooking:         'knows_cooking',
  knows_preservation:    'knows_preservation',
  knows_construction:    'knows_construction',
  knows_medicine:        'knows_medicine',
  knows_metal:           'knows_metal',
} as const;

export type KnowledgeFlag = typeof KNOWLEDGE_FLAGS[keyof typeof KNOWLEDGE_FLAGS];

const flagDefs = rawKnowledge.flags as Record<string, { label: string; insight: string; source: string }>;

export const KNOWLEDGE_INSIGHTS: Record<KnowledgeFlag, string> = Object.fromEntries(
  Object.entries(flagDefs).map(([k, v]) => [k, v.insight])
) as Record<KnowledgeFlag, string>;

export const KNOWLEDGE_LABELS: Record<KnowledgeFlag, string> = Object.fromEntries(
  Object.entries(flagDefs).map(([k, v]) => [k, v.label])
) as Record<KnowledgeFlag, string>;

export const DEFAULT_KNOWLEDGE: Record<KnowledgeFlag, boolean> = Object.fromEntries(
  Object.keys(flagDefs).map(k => [
    k,
    (rawKnowledge.startingKnowledge as string[]).includes(k),
  ])
) as Record<KnowledgeFlag, boolean>;

export const MATERIAL_KNOWLEDGE_GRANTS: Partial<Record<string, KnowledgeFlag>> =
  rawKnowledge.materialGrants as Partial<Record<string, KnowledgeFlag>>;

export const RAIN_KNOWLEDGE_GRANTS: { flag: KnowledgeFlag; needsAny: string[] }[] =
  rawKnowledge.rainGrants as { flag: KnowledgeFlag; needsAny: string[] }[];
