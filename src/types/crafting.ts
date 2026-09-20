import type { SkillId } from './skills';
import type { KnowledgeFlag } from '../data/knowledge';

export interface CraftingMaterial {
  resourceId: string;
  quantity: number;
}

export type RecipeCategory = 'tool' | 'shelter' | 'food' | 'weapon' | 'utility' | 'resource' | 'medicine';

export interface Recipe {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: RecipeCategory;
  tier: 0 | 1 | 2 | 3 | 4 | 5;
  inputs: CraftingMaterial[];
  outputs: CraftingMaterial[];
  craftingTime: number;
  /** Item that must be in inventory to craft */
  requiresTool?: string;
  /** Tier-1 = always visible; higher tiers shown as ??? until player has any input */
  unlocked?: boolean;
  /** Minimum skill level required to craft */
  requiresSkill?: { skill: SkillId; level: number };
  /** Skill XP awarded on successful craft */
  grantsSkill?: { skill: SkillId; xp: number };
  /** Knowledge flags required to see/craft this recipe */
  requiredKnowledge?: KnowledgeFlag[];
  /** Knowledge flags granted when this recipe is crafted */
  grantsKnowledge?: KnowledgeFlag[];
  /** Uses the shared skill/quality outcome model (also enabled for durable tool outputs). */
  qualityBased?: boolean;

}

export interface CraftRequest {
  id: string;
  recipeId: string;
  quantity: number;
  status: 'pending' | 'in-progress' | 'complete' | 'failed';
  timeElapsed?: number;
  startedAt?: number;
}

export interface CraftJob {
  recipeId: string;
  duration: number;
  elapsed: number;
  playerId: string;
  building?: { x: number; y: number; seed: number; siteId?: string };
  outcome?: import('./player').ItemQuality | 'failed';
}
