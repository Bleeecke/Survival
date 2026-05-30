import type { Inventory, CraftingMaterial, Recipe, Equipment } from '../../types';
import { getRecipe } from '../../data/recipes';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { useGameStore } from '../../store/gameStore';
import { useNotificationStore } from '../../store/notificationStore';
import { SKILL_LABELS, DEFAULT_SKILLS } from '../../types/skills';
import { KNIFE_CRAFT_DAMAGE } from '../../data/toolDurability';

export class CraftingSystem {
  getItemQuantity(inventory: Inventory, resourceId: string): number {
    return inventory.items.find(i => i.resourceId === resourceId)?.quantity ?? 0;
  }

  hasItem(inventory: Inventory, itemId: string): boolean {
    return this.getItemQuantity(inventory, itemId) > 0;
  }

  canCraft(recipeId: string, inventory: Inventory): boolean {
    if (useGameStore.getState().freeCraft) return true;
    const recipe = getRecipe(recipeId);
    if (!recipe) return false;
    return recipe.inputs.every(
      input => this.getItemQuantity(inventory, input.resourceId) >= input.quantity
    );
  }

  /** Whether the player has unlocked the ability to craft this (tool requirement) */
  hasRequiredTool(recipe: Recipe, inventory: Inventory): boolean {
    if (useGameStore.getState().freeCraft) return true;
    if (!recipe.requiresTool) return true;
    if (recipe.requiresTool === 'campfire_near') return this.isCampfireNear();
    if (recipe.requiresTool === 'workbench_near') return this.isStructureNear('workbench');
    if (recipe.requiresTool === 'furnace_near')   return this.isStructureNear('furnace');
    if (recipe.requiresTool === 'any_axe') {
      const axes = ['stone_axe', 'improved_axe', 'iron_axe'];
      const eq = usePlayerStore.getState().player.equipment;
      return axes.some(a =>
        this.hasItem(inventory, a) ||
        eq?.leftHand?.resourceId === a ||
        eq?.rightHand?.resourceId === a
      );
    }
    if (recipe.requiresTool === 'any_knife') {
      const knives = ['shell_knife', 'flint_knife', 'stone_axe', 'improved_axe', 'iron_axe'];
      const eq = usePlayerStore.getState().player.equipment;
      return knives.some(k =>
        this.hasItem(inventory, k) ||
        eq?.leftHand?.resourceId === k ||
        eq?.rightHand?.resourceId === k
      );
    }
    // Check inventory AND equipped hand slots
    if (this.hasItem(inventory, recipe.requiresTool)) return true;
    const eq: Equipment | undefined = usePlayerStore.getState().player.equipment;
    if (!eq) return false;
    const toolId = recipe.requiresTool;
    return eq.leftHand?.resourceId === toolId || eq.rightHand?.resourceId === toolId;
  }

  isCampfireNear(): boolean {
    return this.isStructureNear('campfire');
  }

  isStructureNear(type: string, radius = 2): boolean {
    const { x, y } = usePlayerStore.getState().player;
    const structures = useWorldStore.getState().world?.structures ?? [];
    return structures.some(
      s => s.type === type && Math.abs(s.x - x) <= radius && Math.abs(s.y - y) <= radius
    );
  }

  /**
   * A recipe appears ONLY when all conditions are met:
   * 1. Player has seen at least one input material (ever picked up)
   * 2. Required tool is available (inventory / equipped / nearby structure)
   * 3. Skill level is high enough
   * 4. Knowledge flags are unlocked (if any required)
   */
  isDiscovered(recipe: Recipe, inventory: Inventory): boolean {
    if (useGameStore.getState().freeCraft) return true;
    const known = usePlayerStore.getState().knownMaterials;
    if (!recipe.inputs.some(input => known.includes(input.resourceId))) return false;
    if (!this.hasRequiredSkill(recipe)) return false;
    if (!this.hasRequiredTool(recipe, inventory)) return false;
    if (!this.hasRequiredKnowledge(recipe)) return false;
    return true;
  }

  hasRequiredKnowledge(recipe: Recipe): boolean {
    if (useGameStore.getState().freeCraft) return true;
    if (!recipe.requiredKnowledge?.length) return true;
    const knowledge = usePlayerStore.getState().knowledge;
    return recipe.requiredKnowledge.every(flag => knowledge[flag]);
  }

  grantKnowledge(recipe: Recipe): void {
    if (!recipe.grantsKnowledge?.length) return;
    for (const flag of recipe.grantsKnowledge) {
      usePlayerStore.getState().learnKnowledge(flag);
    }
  }

  hasRequiredSkill(recipe: Recipe): boolean {
    if (useGameStore.getState().freeCraft) return true;
    if (!recipe.requiresSkill) return true;
    const skills = usePlayerStore.getState().player.skills ?? DEFAULT_SKILLS;
    const skill = skills[recipe.requiresSkill.skill];
    return skill ? skill.level >= recipe.requiresSkill.level : false;
  }

  damageToolOnCraft(recipe: Recipe): void {
    if (!recipe.requiresTool) return;
    const toolsThatWear = ['flint_knife', 'stone_axe', 'improved_axe', 'iron_axe',
                           'stone_pickaxe', 'improved_pickaxe', 'iron_pickaxe', 'fishing_rod'];
    if (toolsThatWear.includes(recipe.requiresTool)) {
      usePlayerStore.getState().damageTool(recipe.requiresTool, KNIFE_CRAFT_DAMAGE);
    }
  }

  awardSkillXp(recipe: Recipe): void {
    if (!recipe.grantsSkill) return;
    const store = usePlayerStore.getState();
    const { skill, xp } = recipe.grantsSkill;
    const mult = store.getCraftXpMultiplier(recipe.id);
    const actual = Math.max(1, Math.round(xp * mult));
    store.recordCraft(recipe.id);
    store.gainSkillXp(skill, actual);
    useNotificationStore.getState().addNotification(
      `+${actual} ${SKILL_LABELS[skill]}${mult < 0.99 ? ' ↓' : ''}`,
      'xp'
    );
  }

  /** Returns success chance [0–1] for skill-based recipes. Always 1.0 for normal recipes. */
  getSuccessChance(recipe: Recipe): number {
    if (!recipe.skillBasedSuccess) return 1;
    if (useGameStore.getState().freeCraft) return 1;
    const { skill, baseChance, bonusPerLevel } = recipe.skillBasedSuccess;
    const skills = usePlayerStore.getState().player.skills ?? DEFAULT_SKILLS;
    const level = skills[skill]?.level ?? 1;
    return Math.min(1, baseChance + (level - 1) * bonusPerLevel);
  }

  getEffectiveCraftTime(recipe: Recipe): number {
    const skillId = recipe.grantsSkill?.skill ?? recipe.requiresSkill?.skill;
    if (!skillId) return recipe.craftingTime;
    const skills = usePlayerStore.getState().player.skills ?? DEFAULT_SKILLS;
    const level = skills[skillId]?.level ?? 1;
    const reduction = Math.min(0.45, (level - 1) * 0.05);
    return Math.round(recipe.craftingTime * (1 - reduction));
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
