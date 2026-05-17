import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Player, PlayerStats, Direction, Equipment, EquipSlot } from '../types';
import { ITEM_WEIGHTS, MAX_CARRY_KG, calcWeight } from '../data/weights';

interface PlayerStore {
  player: Player;

  initPlayer: (name: string) => void;
  movePlayer: (x: number, y: number) => void;
  setDirection: (direction: Direction) => void;
  updateStats: (partial: Partial<PlayerStats>) => void;
  addToInventory: (resourceId: string, quantity: number) => boolean;
  removeFromInventory: (slot: number, quantity: number) => void;
  removeResource: (resourceId: string, quantity: number) => void;
  getInventorySpace: () => number;
  equip: (slot: EquipSlot, resourceId: string) => boolean;
  unequip: (slot: EquipSlot) => void;
  useBeltSlot: (index: 0 | 1 | 2) => string | null;
  reset: () => void;
}

const defaultEquipment: Equipment = {
  head: null, chest: null, legs: null,
  leftHand: null, rightHand: null,
  belt: [null, null, null],
};

const defaultPlayer: Player = {
  id: '',
  name: '',
  x: 32,
  y: 32,
  direction: 'down',
  stats: {
    health: 68,   // injured from shipwreck
    hunger: 28,   // hours in the water, starving
    thirst: 42,   // salt water doesn't help
    stamina: 22,  // exhausted
    fatigue: 58,  // barely conscious
  },
  inventory: {
    items: [],
    maxSlots: 20,
  },
  equipment: { ...defaultEquipment, belt: [null, null, null] },
};

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      player: defaultPlayer,

      initPlayer: (name: string) =>
        set((state) => ({
          player: {
            ...state.player,
            name,
            id: `player-${Date.now()}`,
          },
        })),

      movePlayer: (x: number, y: number) =>
        set((state) => ({
          player: { ...state.player, x, y },
        })),

      setDirection: (direction: Direction) =>
        set((state) => ({
          player: { ...state.player, direction },
        })),

      updateStats: (partial) =>
        set((state) => ({
          player: {
            ...state.player,
            stats: { ...state.player.stats, ...partial },
          },
        })),

      addToInventory: (resourceId: string, quantity: number) => {
        const state = get();
        const { items, maxSlots } = state.player.inventory;

        // Weight check
        const addedWeight = (ITEM_WEIGHTS[resourceId] ?? 0.5) * quantity;
        const currentWeight = calcWeight(items);
        if (currentWeight + addedWeight > MAX_CARRY_KG) return false;

        const existing = items.find((item) => item.resourceId === resourceId);
        if (existing) {
          existing.quantity += quantity;
          set((s) => ({ player: { ...s.player } }));
          return true;
        } else if (items.length < maxSlots) {
          items.push({
            id: `${resourceId}-${Date.now()}`,
            resourceId,
            quantity,
            slot: items.length,
          });
          set((s) => ({ player: { ...s.player } }));
          return true;
        }
        return false;
      },

      removeFromInventory: (slot: number, quantity: number) => {
        set((state) => {
          const item = state.player.inventory.items[slot];
          if (!item) return state;

          item.quantity -= quantity;
          if (item.quantity <= 0) {
            state.player.inventory.items.splice(slot, 1);
          }
          return { player: { ...state.player } };
        });
      },

      removeResource: (resourceId: string, quantity: number) => {
        set((state) => {
          const items = state.player.inventory.items.map(i => ({ ...i }));
          let remaining = quantity;

          for (let i = items.length - 1; i >= 0 && remaining > 0; i--) {
            if (items[i].resourceId === resourceId) {
              if (items[i].quantity <= remaining) {
                remaining -= items[i].quantity;
                items.splice(i, 1);
              } else {
                items[i].quantity -= remaining;
                remaining = 0;
              }
            }
          }

          return {
            player: {
              ...state.player,
              inventory: { ...state.player.inventory, items },
            },
          };
        });
      },

      getInventorySpace: () => {
        const { inventory } = get().player;
        return inventory.maxSlots - inventory.items.length;
      },

      equip: (slot, resourceId) => {
        const state = get();
        const hasItem = state.player.inventory.items.some(i => i.resourceId === resourceId && i.quantity > 0);
        if (!hasItem) return false;

        set((s) => {
          const base = s.player.equipment ?? { head: null, chest: null, legs: null, leftHand: null, rightHand: null, belt: [null, null, null] as Equipment['belt'] };
          const eq = { ...base, belt: [...(base.belt ?? [null, null, null])] as Equipment['belt'] };

          // Unequip whatever was previously in the slot (return to inventory)
          const prevSlotItem = slot.startsWith('belt')
            ? eq.belt[parseInt(slot.replace('belt', '')) as 0|1|2]
            : eq[slot as keyof Omit<Equipment, 'belt'>];
          if (prevSlotItem) {
            // Return to inventory handled outside — just clear for now
          }

          // Set new slot
          if (slot.startsWith('belt')) {
            const idx = parseInt(slot.replace('belt', '')) as 0|1|2;
            eq.belt[idx] = { resourceId };
          } else {
            (eq as any)[slot] = { resourceId };
          }

          // Remove 1 from inventory
          const items = s.player.inventory.items.map(i => ({ ...i }));
          for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].resourceId === resourceId && items[i].quantity > 0) {
              items[i].quantity -= 1;
              if (items[i].quantity <= 0) items.splice(i, 1);
              break;
            }
          }

          // Return previous item to inventory if there was one
          if (prevSlotItem) {
            const existing = items.find(i => i.resourceId === prevSlotItem.resourceId);
            if (existing) existing.quantity += 1;
            else items.push({ id: `${prevSlotItem.resourceId}-${Date.now()}`, resourceId: prevSlotItem.resourceId, quantity: 1, slot: items.length });
          }

          return { player: { ...s.player, equipment: eq, inventory: { ...s.player.inventory, items } } };
        });
        return true;
      },

      unequip: (slot) => {
        set((s) => {
          const base = s.player.equipment ?? { head: null, chest: null, legs: null, leftHand: null, rightHand: null, belt: [null, null, null] as Equipment['belt'] };
          const eq = { ...base, belt: [...(base.belt ?? [null, null, null])] as Equipment['belt'] };
          let item: { resourceId: string } | null = null;

          if (slot.startsWith('belt')) {
            const idx = parseInt(slot.replace('belt', '')) as 0|1|2;
            item = eq.belt[idx];
            eq.belt[idx] = null;
          } else {
            item = eq[slot as keyof Omit<Equipment, 'belt'>];
            (eq as any)[slot] = null;
          }

          if (!item) return s;

          const items = s.player.inventory.items.map(i => ({ ...i }));
          const existing = items.find(i => i.resourceId === item!.resourceId);
          if (existing) existing.quantity += 1;
          else items.push({ id: `${item.resourceId}-${Date.now()}`, resourceId: item.resourceId, quantity: 1, slot: items.length });

          return { player: { ...s.player, equipment: eq, inventory: { ...s.player.inventory, items } } };
        });
      },

      // Returns resourceId of used item, or null
      useBeltSlot: (index) => {
        const state = get();
        const item = state.player.equipment.belt[index];
        if (!item) return null;

        set((s) => {
          const belt = [...s.player.equipment.belt] as Equipment['belt'];
          belt[index] = null;
          return { player: { ...s.player, equipment: { ...s.player.equipment, belt } } };
        });
        return item.resourceId;
      },

      reset: () => set({ player: { ...defaultPlayer, equipment: { ...defaultEquipment, belt: [null, null, null] } } }),
    }),
    {
      name: 'survival-player-save',
    }
  )
);
