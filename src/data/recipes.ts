import type { Recipe } from '../types';
import rawRecipes from './json/recipes.json';

export const RECIPES: Recipe[] = rawRecipes as Recipe[];

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES.find(r => r.id === id);
}

export function getRecipesByCategory(category: Recipe['category']): Recipe[] {
  return RECIPES.filter(r => r.category === category);
}
