import type { Inventory, CraftingMaterial, Recipe, Equipment } from '../../types';
import { getRecipe, RECIPES } from '../../data/recipes';
import resources from '../../data/json/resources.json';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { useGameStore } from '../../store/gameStore';
import { useNotificationStore } from '../../store/notificationStore';
import { SKILL_LABELS, DEFAULT_SKILLS } from '../../types/skills';
import { craftTimeMultiplier } from '../../data/craftingBalance';
import { KNIFE_CRAFT_DAMAGE } from '../../data/toolDurability';

const ITEM_NAMES = Object.fromEntries(resources.map(r => [r.id, r.name]));
const TOOL_REQUIREMENTS: Record<string, string> = {
  any_axe: 'Eine Axt fehlt. Ein Messer reicht hierfür nicht.',
  any_knife: 'Ein Schneidwerkzeug fehlt: Messer oder Axt.',
  stone_axe: 'Eine primitive Axt oder bessere Axt fehlt.',
  stone_pickaxe: 'Eine Steinspitzhacke oder bessere Spitzhacke fehlt.',
  any_pickaxe: 'Eine Spitzhacke fehlt.',
  campfire_near: 'Gehe zu einer brennenden Feuerstelle (höchstens 2 Felder Abstand).',
  workbench_near: 'Gehe zu einer Werkbank (höchstens 2 Felder Abstand).',
  furnace_near: 'Gehe zu einem Schmelzofen (höchstens 2 Felder Abstand).',
};

export class CraftingSystem {
  getItemQuantity(inventory: Inventory, resourceId: string): number {
    return inventory.items.reduce((sum, i) => sum + (i.resourceId === resourceId ? i.quantity : 0), 0);
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
  hasRequiredTool(recipe: Pick<Recipe, 'requiresTool'>, inventory: Inventory): boolean {
    if (useGameStore.getState().freeCraft) return true;
    if (!recipe.requiresTool) return true;
    if (recipe.requiresTool === 'campfire_near') return this.isCampfireNear();
    if (recipe.requiresTool === 'workbench_near') return this.isStructureNear('workbench');
    if (recipe.requiresTool === 'furnace_near')   return this.isStructureNear('furnace');
    if (recipe.requiresTool === 'stone_pickaxe' || recipe.requiresTool === 'any_pickaxe') {
      return ['stone_pickaxe', 'improved_pickaxe', 'iron_pickaxe'].some(id => this.hasAvailableTool(id, inventory));
    }
    if (recipe.requiresTool === 'any_axe' || recipe.requiresTool === 'stone_axe') {
      const axes = ['stone_axe', 'improved_axe', 'iron_axe'];
      const eq = usePlayerStore.getState().player.equipment;
      return axes.some(a =>
        this.hasItem(inventory, a) ||
        eq?.leftHand?.resourceId === a ||
        eq?.rightHand?.resourceId === a
      );
    }
    if (recipe.requiresTool === 'any_knife') {
      const knives = ['flint_knife', 'stone_axe', 'improved_axe', 'iron_axe'];
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
    return (useWorldStore.getState().world?.structures ?? []).some(s => ['campfire', 'granite_campfire'].includes(s.type) && (s.fuel ?? 0) > 0 && Math.abs(s.x - usePlayerStore.getState().player.x) <= 2 && Math.abs(s.y - usePlayerStore.getState().player.y) <= 2);
  }

  isArbeitsplatzNear(): boolean {
    return this.isStructureNear('arbeitsplatz');
  }

  isStructureNear(type: string, radius = 2): boolean {
    const { x, y } = usePlayerStore.getState().player;
    const structures = useWorldStore.getState().world?.structures ?? [];
    return structures.some(
      s => s.type === type && Math.abs(s.x - x) <= radius && Math.abs(s.y - y) <= radius
    );
  }

  // Knowledge remains visible even when the current tool or skill is insufficient.
  isDiscovered(recipe: Recipe, _inventory: Inventory): boolean {
    void _inventory;
    if (useGameStore.getState().freeCraft) return true;
    const known = usePlayerStore.getState().knownMaterials;
    if (!recipe.inputs.some(input => known.includes(input.resourceId))) return false;
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

  hasAvailableTool(id: string, inventory: Inventory): boolean {
    const eq = usePlayerStore.getState().player.equipment;
    return this.hasItem(inventory, id) || eq.leftHand?.resourceId === id || eq.rightHand?.resourceId === id;
  }

  getCraftBlockReason(recipe: Recipe): string | null {
    const inventory = usePlayerStore.getState().player.inventory;
    if (!this.hasRequiredKnowledge(recipe)) return 'Das Verfahren ist noch unbekannt.';
    if (!this.hasRequiredSkill(recipe)) return `${SKILL_LABELS[recipe.requiresSkill!.skill]} Stufe ${recipe.requiresSkill!.level} benötigt.`;
    if (!this.hasRequiredTool(recipe, inventory)) return TOOL_REQUIREMENTS[recipe.requiresTool!] ?? `Benötigtes Werkzeug: ${RECIPES.find(r => r.outputs.some(o => o.resourceId === recipe.requiresTool))?.name ?? recipe.requiresTool}.`;
    const missing = this.getMissingMaterials(recipe.id, inventory);
    if (!useGameStore.getState().freeCraft && missing.length) return `Es fehlen: ${missing.map(i => `${i.quantity}× ${ITEM_NAMES[i.resourceId] ?? i.resourceId}`).join(', ')}.`;
    return null;
  }

  getCraftGuidance(recipe: Recipe, visited = new Set<string>()): string | null {
    const inventory = usePlayerStore.getState().player.inventory;
    if (!this.isDiscovered(recipe, inventory) || visited.has(recipe.id) || visited.size >= 4) return null;
    visited.add(recipe.id);
    if (!this.hasRequiredSkill(recipe)) return `Übe ${SKILL_LABELS[recipe.requiresSkill!.skill]} mit einfacheren bekannten Arbeiten.`;
    let ingredient: string | undefined;
    if (!this.hasRequiredTool(recipe, inventory)) {
      const tool = recipe.requiresTool!;
      if (tool.endsWith('_near')) return TOOL_REQUIREMENTS[tool] ?? null;
      ingredient = ({ any_axe: 'stone_axe', any_knife: 'flint_knife', any_pickaxe: 'stone_pickaxe' } as Record<string, string>)[tool] ?? tool;
    } else {
      ingredient = this.getMissingMaterials(recipe.id, inventory)[0]?.resourceId;
    }
    if (!ingredient) return null;
    const producer = RECIPES.find(r => r.outputs.some(o => o.resourceId === ingredient) && this.isDiscovered(r, inventory));
    if (producer) {
      const next = this.getCraftGuidance(producer, visited);
      return `Nächster Schritt: ${producer.name}.${next ? ` ${next}` : ` ${this.getCraftBlockReason(producer) ?? 'Dieses Rezept kannst du jetzt herstellen.'}`}`;
    }
    const known = usePlayerStore.getState().knownMaterials.includes(ingredient);
    return known ? `Beschaffe ${ITEM_NAMES[ingredient] ?? ingredient}; die benötigte Menge steht beim Rezept.`
      : 'Eine passende Herstellungstechnik ist noch unbekannt. Untersuche weitere Materialien und deine offenen Tagebucheinträge.';
  }

  damageToolOnCraft(recipe: Pick<Recipe, 'requiresTool'>): void {
    if (useGameStore.getState().freeCraft || !recipe.requiresTool) return;
    const inventory = usePlayerStore.getState().player.inventory;
    const candidates = recipe.requiresTool === 'any_knife' ? ['flint_knife', 'stone_axe', 'improved_axe', 'iron_axe']
      : ['any_axe', 'stone_axe'].includes(recipe.requiresTool) ? ['stone_axe', 'improved_axe', 'iron_axe']
      : ['any_pickaxe', 'stone_pickaxe'].includes(recipe.requiresTool) ? ['stone_pickaxe', 'improved_pickaxe', 'iron_pickaxe'] : [recipe.requiresTool];
    const id = candidates.find(id => this.hasAvailableTool(id, inventory));
    if (id && !id.endsWith('_near')) usePlayerStore.getState().damageTool(id, KNIFE_CRAFT_DAMAGE);
  }

  awardSkillXp(recipe: Recipe, success = true): void {
    if (!recipe.grantsSkill) return;
    const store = usePlayerStore.getState();
    const { skill, xp } = recipe.grantsSkill;
    const mult = store.getCraftXpMultiplier(recipe.id);
    const actual = Math.max(1, Math.round(xp * mult * (success ? 1 : 0.25)));
    store.recordCraft(recipe.id);
    store.gainSkillXp(skill, actual);
    useNotificationStore.getState().addNotification(
      `+${actual} ${SKILL_LABELS[skill]}${mult < 0.99 ? ' ↓' : ''}`,
      'xp'
    );
  }

  getEffectiveCraftTime(recipe: Recipe): number {
    const skillId = recipe.grantsSkill?.skill ?? recipe.requiresSkill?.skill;
    if (!skillId) return recipe.craftingTime;
    const skills = usePlayerStore.getState().player.skills ?? DEFAULT_SKILLS;
    const level = skills[skillId]?.level ?? 1;
    return Math.round(recipe.craftingTime * craftTimeMultiplier(level));
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
