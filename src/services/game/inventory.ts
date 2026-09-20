import { createId } from './createId';
import type { Inventory, ItemCondition } from '../../types/player';
import type { CraftingMaterial } from '../../types/crafting';
import type { StoredItem } from '../../types/world';
import { calcWeight, MAX_CARRY_KG } from '../../data/weights';
import { TOOL_MAX_DURABILITY } from '../../data/toolDurability';
import { QUALITY_DURABILITY } from '../../data/craftingBalance';

export function itemCondition(item: ItemCondition): ItemCondition {
  return { quality: item.quality, durability: item.durability, maxDurability: item.maxDurability, addedAt: item.addedAt };
}

export function normalizeCondition(resourceId: string, condition: ItemCondition = {}): ItemCondition {
  const base = TOOL_MAX_DURABILITY[resourceId];
  if (!base) return itemCondition(condition);
  const quality = condition.quality ?? 'standard';
  const maxDurability = condition.maxDurability ?? Math.round(base * QUALITY_DURABILITY[quality]);
  return { ...itemCondition(condition), quality, maxDurability, durability: condition.durability ?? maxDurability };
}

export function sameCondition(a: ItemCondition, b: ItemCondition) {
  return a.quality === b.quality && a.durability === b.durability && a.maxDurability === b.maxDurability;
}

// Plan first, then commit once: a full inventory must never eat crafting inputs.
export function exchangeInventory(inventory: Inventory, inputs: CraftingMaterial[], outputs: StoredItem[]): Inventory | null {
  const items = inventory.items.map(i => ({ ...i }));
  for (const input of inputs) {
    let remaining = input.quantity;
    for (const item of items) {
      if (item.resourceId !== input.resourceId) continue;
      const taken = Math.min(item.quantity, remaining);
      item.quantity -= taken;
      remaining -= taken;
    }
    if (remaining > 0) return null;
  }
  const result = items.filter(i => i.quantity > 0);
  for (const output of outputs) {
    const condition = normalizeCondition(output.resourceId, output);
    if (TOOL_MAX_DURABILITY[output.resourceId]) {
      for (let n = 0; n < output.quantity; n++) result.push({ id: createId(), resourceId: output.resourceId, quantity: 1, slot: result.length, ...condition });
      continue;
    }
    const existing = result.find(i => i.resourceId === output.resourceId && sameCondition(i, condition));
    if (existing) {
      existing.quantity += output.quantity;
      if (condition.addedAt !== undefined) existing.addedAt = Math.min(existing.addedAt ?? condition.addedAt, condition.addedAt);
    } else {
      result.push({ id: createId(), resourceId: output.resourceId, quantity: output.quantity, slot: result.length, ...condition });
    }
  }
  if (result.length > inventory.maxSlots || calcWeight(result) > MAX_CARRY_KG) return null;
  return { ...inventory, items: result.map((item, slot) => ({ ...item, slot })) };
}
