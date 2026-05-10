export interface CraftingMaterial {
  resourceId: string;
  quantity: number;
}

export type RecipeCategory = 'tool' | 'shelter' | 'food' | 'weapon' | 'utility' | 'resource';

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
}

export interface CraftRequest {
  id: string;
  recipeId: string;
  quantity: number;
  status: 'pending' | 'in-progress' | 'complete' | 'failed';
  timeElapsed?: number;
  startedAt?: number;
}
