import type { Inventory, CraftingMaterial, Recipe, Equipment } from '../../types';
import { getRecipe } from '../../data/recipes';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';

export class CraftingSystem {
  getItemQuantity(inventory: Inventory, resourceId: string): number {
    return inventory.items.find(i => i.resourceId === resourceId)?.quantity ?? 0;
  }

  hasItem(inventory: Inventory, itemId: string): boolean {
    return this.getItemQuantity(inventory, itemId) > 0;
  }

  canCraft(recipeId: string, inventory: Inventory): boolean {
    const recipe = getRecipe(recipeId);
    if (!recipe) return false;
    return recipe.inputs.every(
      input => this.getItemQuantity(inventory, input.resourceId) >= input.quantity
    );
  }

  /** Whether the player has unlocked the ability to craft this (tool requirement) */
  hasRequiredTool(recipe: Recipe, inventory: Inventory): boolean {
    if (!recipe.requiresTool) return true;
    if (recipe.requiresTool === 'campfire_near') return this.isCampfireNear();
    // Check inventory AND equipped hand slots
    if (this.hasItem(inventory, recipe.requiresTool)) return true;
    const eq: Equipment | undefined = usePlayerStore.getState().player.equipment;
    if (!eq) return false;
    const toolId = recipe.requiresTool;
    return eq.leftHand?.resourceId === toolId || eq.rightHand?.resourceId === toolId;
  }

  isCampfireNear(): boolean {
    const { x, y } = usePlayerStore.getState().player;
    const structures = useWorldStore.getState().world?.structures ?? [];
    return structures.some(
      s => s.type === 'campfire' && Math.abs(s.x - x) <= 2 && Math.abs(s.y - y) <= 2
    );
  }

  /**
   * A recipe is "discovered" (shown in full) when:
   * - Tier 1: always
   * - Tier 2+: player has at least one input material in inventory
   */
  isDiscovered(recipe: Recipe, inventory: Inventory): boolean {
    if (recipe.tier <= 1) return true;
    return recipe.inputs.some(
      input => this.getItemQuantity(inventory, input.resourceId) > 0
    );
  }

  getMissingMaterials(recipeId: string, inventory: Inventory): CraftingMaterial[] {
    const recipe = getRecipe(recipeId);
    if (!recipe) return [];
    return recipe.inputs
      .filter(input => this.getItemQuantity(inventory, input.resourceId) < input.quantity)
      .map(input => ({
        resourceId: input.resourceId,
        quantity: input.quantity - this.getItemQuantity(inventory, input.resourceId),
      }));
  }
}

export const craftingSystem = new CraftingSystem();
