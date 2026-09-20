import { createId } from '../services/game/createId';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useGameStore } from './gameStore';
import type { Player, PlayerStats, Direction, Equipment, EquipSlot } from '../types';
import { DEFAULT_SKILLS, type SkillId } from '../types/skills';
import { PERISHABLE_IDS } from '../data/foodDecay';
import { DEFAULT_KNOWLEDGE, MATERIAL_KNOWLEDGE_GRANTS, type KnowledgeFlag, KNOWLEDGE_INSIGHTS } from '../data/knowledge';
import type { ItemCondition, EquippedItem } from '../types/player';
import type { CraftingMaterial } from '../types/crafting';
import type { StoredItem } from '../types/world';
import { exchangeInventory, normalizeCondition } from '../services/game/inventory';
import rawMaterialToasts from '../data/json/materialToasts.json';

interface PlayerStore {
  player: Player;
  knownMaterials: string[];          // every resourceId ever picked up
  learnMaterial: (id: string) => void;
  knowledge: Record<KnowledgeFlag, boolean>;
  learnKnowledge: (flag: KnowledgeFlag) => void;
  craftCounts: Record<string, number>;  // recipeId → times crafted
  recordCraft: (recipeId: string) => void;
  getCraftXpMultiplier: (recipeId: string) => number;

  initPlayer: (name: string) => void;
  movePlayer: (x: number, y: number) => void;
  setDirection: (direction: Direction) => void;
  updateStats: (partial: Partial<PlayerStats>) => void;
  addToInventory: (resourceId: string, quantity: number, condition?: ItemCondition) => boolean;
  exchangeItems: (inputs: CraftingMaterial[], outputs: StoredItem[]) => boolean;
  removeFromInventory: (slot: number, quantity: number) => void;
  removeResource: (resourceId: string, quantity: number) => void;
  getInventorySpace: () => number;
  equip: (slot: EquipSlot, resourceId: string, itemId?: string) => boolean;
  unequip: (slot: EquipSlot) => void;
  useBeltSlot: (index: 0 | 1 | 2) => string | null;
  gainSkillXp: (skillId: SkillId, xp: number) => void;
  damageTool: (resourceId: string, damage: number) => void;
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
    temperature: 50, // comfortable on arrival
  },
  inventory: {
    items: [],
    maxSlots: 20,
  },
  equipment: { ...defaultEquipment, belt: [null, null, null] },
  skills: { ...DEFAULT_SKILLS },
};

export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      player: defaultPlayer,
      knownMaterials: [],
      knowledge: { ...DEFAULT_KNOWLEDGE },
      craftCounts: {},

      learnMaterial: (id: string) => {
        if (get().knownMaterials.includes(id)) return;
        set(s => ({ knownMaterials: [...s.knownMaterials, id] }));
        // Material knowledge grants (instant)
        const flag = MATERIAL_KNOWLEDGE_GRANTS[id];
        if (flag) get().learnKnowledge(flag);
        // Atmospheric toast on first pickup
        const toastText = (rawMaterialToasts as Record<string, string>)[id];
        if (toastText) {
          import('../store/notificationStore').then(({ useNotificationStore }) => {
            useNotificationStore.getState().addMaterialNotification(id, toastText);
          });
          import('../store/journalStore').then(({ useJournalStore }) => {
            useJournalStore.getState().addDiscovery(id, toastText);
          });
        }
        // Journal event triggers
        const MATERIAL_EVENTS: Partial<Record<string, string>> = {
          flint: 'first_flint',
          fiber: 'first_fiber',
          herbs: 'first_herbs',
          iron_ore: 'first_iron_ore',
        };
        const eventId = MATERIAL_EVENTS[id];
        if (eventId) {
          import('../store/journalStore').then(({ useJournalStore }) => {
            useJournalStore.getState().triggerJournalEvent(eventId);
          });
        }
      },

      recordCraft: (recipeId: string) => {
        set(s => ({ craftCounts: { ...s.craftCounts, [recipeId]: (s.craftCounts[recipeId] ?? 0) + 1 } }));
      },

      getCraftXpMultiplier: (recipeId: string) => {
        const count = get().craftCounts[recipeId] ?? 0;
        // 1st craft = 100%, then diminishes: 1/√n, floor at 10%
        return Math.max(0.1, 1 / Math.sqrt(count + 1));
      },

      learnKnowledge: (flag: KnowledgeFlag) => {
        if (get().knowledge[flag]) return;
        set(s => ({ knowledge: { ...s.knowledge, [flag]: true } }));
        import('../store/notificationStore').then(({ useNotificationStore }) => {
          useNotificationStore.getState().addNotification(KNOWLEDGE_INSIGHTS[flag], 'levelup');
        });
      },

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

      exchangeItems: (inputs, outputs) => {
        const inventory = exchangeInventory(get().player.inventory, inputs, outputs);
        if (!inventory) return false;
        set(s => ({ player: { ...s.player, inventory } }));
        for (const output of outputs) get().learnMaterial(output.resourceId);
        return true;
      },

      addToInventory: (resourceId, quantity, condition = {}) => {
        if (quantity <= 0) return false;
        return get().exchangeItems([], [{ resourceId, quantity, ...condition,
          addedAt: condition.addedAt ?? (PERISHABLE_IDS.has(resourceId) ? useGameStore.getState().elapsedTime : undefined),
        }]);
      },

      removeFromInventory: (slot: number, quantity: number) => {
        set((state) => {
          const items = state.player.inventory.items.map(i => ({ ...i }));
          const item = items[slot];
          if (!item) return state;

          item.quantity -= quantity;
          if (item.quantity <= 0) {
            items.splice(slot, 1);
          }
          return { player: { ...state.player, inventory: { ...state.player.inventory, items: items.map((i, slot) => ({ ...i, slot })) } } };
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

      equip: (slot, resourceId, itemId) => {
        const state = get();
        const selected = state.player.inventory.items.find(i => i.resourceId === resourceId && i.quantity > 0 && (!itemId || i.id === itemId));
        if (!selected) return false;
        const eq = { ...state.player.equipment, belt: [...state.player.equipment.belt] as Equipment['belt'] };
        const previous = slot.startsWith('belt') ? eq.belt[Number(slot.slice(4)) as 0|1|2] : eq[slot as keyof Omit<Equipment, 'belt'>];
        const items = state.player.inventory.items.map(i => i.id === selected.id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0);
        const inventory = exchangeInventory({ ...state.player.inventory, items }, [], previous ? [{ resourceId: previous.resourceId, quantity: 1, ...normalizeCondition(previous.resourceId, previous) }] : []);
        if (!inventory) return false;
        const equipped = { resourceId, ...normalizeCondition(resourceId, selected) };
        if (slot.startsWith('belt')) eq.belt[Number(slot.slice(4)) as 0|1|2] = equipped;
        else eq[slot as keyof Omit<Equipment, 'belt'>] = equipped;
        set({ player: { ...state.player, equipment: eq, inventory } });
        return true;
      },

      unequip: (slot) => {
        const state = get();
        const eq = { ...state.player.equipment, belt: [...state.player.equipment.belt] as Equipment['belt'] };
        const item: EquippedItem | null = slot.startsWith('belt') ? eq.belt[Number(slot.slice(4)) as 0|1|2] : eq[slot as keyof Omit<Equipment, 'belt'>];
        if (!item) return;
        const inventory = exchangeInventory(state.player.inventory, [], [{ resourceId: item.resourceId, quantity: 1, ...normalizeCondition(item.resourceId, item) }]);
        if (!inventory) return;
        if (slot.startsWith('belt')) eq.belt[Number(slot.slice(4)) as 0|1|2] = null;
        else eq[slot as keyof Omit<Equipment, 'belt'>] = null;
        set({ player: { ...state.player, inventory, equipment: eq } });
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

      gainSkillXp: (skillId, xp) => {
        const levelsBefore = get().player.skills?.[skillId]?.level ?? 1;
        set((state) => {
          const MAX_LEVEL = 10;
          const skills = { ...(state.player.skills ?? DEFAULT_SKILLS) };
          const skill = { ...skills[skillId] };
          skill.xp += xp;
          while (skill.level < MAX_LEVEL && skill.xp >= skill.level * 20) {
            skill.xp -= skill.level * 20;
            skill.level += 1;
          }
          if (skill.level >= MAX_LEVEL) skill.xp = Math.min(skill.xp, MAX_LEVEL * 20);
          skills[skillId] = skill;
          return { player: { ...state.player, skills } };
        });
        const levelsAfter = get().player.skills?.[skillId]?.level ?? 1;
        if (levelsAfter > levelsBefore) {
          import('./notificationStore').then(({ useNotificationStore }) => {
            import('../types/skills').then(({ SKILL_LABELS }) => {
              for (let lvl = levelsBefore + 1; lvl <= levelsAfter; lvl++) {
                useNotificationStore.getState().addNotification(
                  `⬆ ${SKILL_LABELS[skillId]} Stufe ${lvl}`,
                  'levelup'
                );
              }
            });
          });
        }
      },

      damageTool: (resourceId, damage) => {
        set((state) => {
          const eq = { ...state.player.equipment, belt: [...state.player.equipment.belt] as Equipment['belt'] };
          let broke = false;
          let brokenName = resourceId;

          for (const slot of ['leftHand', 'rightHand'] as const) {
            const item = eq[slot];
            if (!item || item.resourceId !== resourceId || item.durability === undefined) continue;
            const newDur = item.durability - damage;
            if (newDur <= 0) {
              eq[slot] = null;
              broke = true;
              brokenName = resourceId;
            } else {
              eq[slot] = { ...item, durability: newDur };
            }
            break;
          }

          const held = ['leftHand', 'rightHand'].some(slot => state.player.equipment[slot as 'leftHand' | 'rightHand']?.resourceId === resourceId);
          let inventory = state.player.inventory;
          if (!held) {
            const tool = inventory.items.find(i => i.resourceId === resourceId && i.quantity > 0);
            if (tool) {
              const condition = normalizeCondition(resourceId, tool);
              const remaining = (condition.durability ?? 0) - damage;
              const items = inventory.items.map(i => i.id === tool.id ? { ...i, quantity: i.quantity - 1 } : i).filter(i => i.quantity > 0);
              if (remaining > 0) items.push({ ...tool, ...condition, id: createId(), quantity: 1, durability: remaining });
              else broke = true;
              inventory = { ...inventory, items: items.map((i, slot) => ({ ...i, slot })) };
            }
          }

          if (broke) {
            import('../store/notificationStore').then(({ useNotificationStore }) => {
              useNotificationStore.getState().addNotification(`${brokenName} ist zerbrochen! ⚒️`, 'levelup');
            });
          }

          return { player: { ...state.player, equipment: eq, inventory } };
        });
      },

      reset: () => {
        set({ player: { ...defaultPlayer, stats: { ...defaultPlayer.stats }, inventory: { items: [], maxSlots: 20 }, equipment: { ...defaultEquipment, belt: [null, null, null] }, skills: { ...DEFAULT_SKILLS } }, knownMaterials: [], knowledge: { ...DEFAULT_KNOWLEDGE }, craftCounts: {} });
        import('./journalStore').then(({ useJournalStore }) => useJournalStore.getState().reset());
      },
    }),
    {
      name: 'survival-player-save',
      onRehydrateStorage: () => (state) => {
        if (state?.player && !state.player.skills) {
          state.player.skills = { ...DEFAULT_SKILLS };
        }
        // Migrate old skill IDs to new system
        if (state?.player?.skills) {
          const s = state.player.skills as Record<string, { level: number; xp: number }>;
          const oldToNew: Record<string, string> = {
            flintknapping: 'crafting', woodworking: 'crafting', cordage: 'crafting',
            firemaking: 'survival', foraging: 'naturelore', shelterbuilding: 'building',
          };
          for (const [old, neo] of Object.entries(oldToNew)) {
            if (s[old]) {
              if (!s[neo] || s[neo].level === 1) s[neo] = s[old];
              delete s[old];
            }
          }
          if (!s['medicine']) s['medicine'] = { level: 1, xp: 0 };
          if (!s['body']) s['body'] = { level: 1, xp: 0 };
          state.player.skills = s as unknown as typeof DEFAULT_SKILLS;
        }
        if (state && !state.knownMaterials) {
          state.knownMaterials = state.player?.inventory?.items?.map(i => i.resourceId) ?? [];
        }
        if (state && !state.knowledge) {
          state.knowledge = { ...DEFAULT_KNOWLEDGE };
        }
        if (state && !state.craftCounts) {
          state.craftCounts = {};
        }
        // Clean up old grübel state if present
        if (state && 'collectedInsights' in state) delete (state as Record<string, unknown>).collectedInsights;
        if (state && 'reflectionFocus' in state) delete (state as Record<string, unknown>).reflectionFocus;
        if (state && 'unlockedFocuses' in state) delete (state as Record<string, unknown>).unlockedFocuses;
      },
    }
  )
);
