// Weight in kg per single item
export const ITEM_WEIGHTS: Record<string, number> = {
  // Very light – herbs, small finds
  herbs:            0.1,
  shells:           0.1,
  palm_leaf:        0.1,
  food:             0.1,
  fiber:            0.1,
  mushroom:         0.2,
  exotic_fruit:     0.2,
  vine:             0.2,
  flint:            0.3,
  herbal_remedy:    0.1,
  cooked_mushroom:  0.2,
  cooked_food:      0.2,
  cooked_fish_meal: 0.3,

  // Light – sticks, water, small tools
  sticks:           0.3,
  water:            0.3,
  fish:             0.3,
  rope:             0.3,
  torch:            0.2,
  flint_knife:      0.3,
  water_container:  0.5,
  driftwood:        0.5,
  fishing_rod:      0.5,

  // Medium – pebbles, planks, small tools
  pebbles:          0.5,
  plank:            0.8,
  stone_axe:        0.8,
  stone_spear:      0.7,
  stone_pickaxe:    1.0,
  improved_axe:     1.2,
  improved_pickaxe: 1.3,

  // Heavy – wood, stone, iron
  wood:             1.5,
  iron_bar:         2.0,
  iron_axe:         1.5,
  iron_pickaxe:     1.6,
  stone:            2.5,
  iron_ore:         3.0,
};

export const MAX_CARRY_KG = 20;

export function calcWeight(items: { resourceId: string; quantity: number }[]): number {
  return items.reduce((sum, i) => {
    const w = ITEM_WEIGHTS[i.resourceId] ?? 0.5;
    return sum + w * i.quantity;
  }, 0);
}
