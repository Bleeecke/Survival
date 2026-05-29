// Maximum durability per tool (uses before breaking)
export const TOOL_MAX_DURABILITY: Record<string, number> = {
  shell_knife:       15, // very fragile
  flint_knife:       30,
  stone_axe:         50,
  stone_pickaxe:     50,
  stone_spear:       40,
  improved_axe:      100,
  improved_pickaxe:  100,
  iron_axe:          200,
  iron_pickaxe:      200,
  fishing_rod:       25,
};

// Damage dealt to the active tool per resource-gather action
// key = resource type, value = { toolId: damage }
export const TOOL_DAMAGE_ON_GATHER: Record<string, Partial<Record<string, number>>> = {
  wood:       { stone_axe: 2, improved_axe: 1, iron_axe: 1 },
  stone:      { stone_pickaxe: 2, improved_pickaxe: 1, iron_pickaxe: 1 },
  iron_ore:   { stone_pickaxe: 3, improved_pickaxe: 2, iron_pickaxe: 1 },
  fiber:      { flint_knife: 1, shell_knife: 2 },
  vine:       { flint_knife: 1, shell_knife: 2 },
  palm_tree:  { flint_knife: 1, shell_knife: 2 },
  resin_tree: { stone_axe: 1, improved_axe: 1, iron_axe: 1 },
  fish:       { fishing_rod: 1 },
};

// Damage to spear per melee hit on an animal
export const SPEAR_DAMAGE_PER_HIT = 5;
// Damage to knife when used as a crafting requirement
export const KNIFE_CRAFT_DAMAGE = 2;
