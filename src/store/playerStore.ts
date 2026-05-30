import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useGameStore } from './gameStore';
import type { Player, PlayerStats, Direction, Equipment, EquipSlot } from '../types';
import { ITEM_WEIGHTS, MAX_CARRY_KG, calcWeight } from '../data/weights';
import { DEFAULT_SKILLS, type SkillId } from '../types/skills';
import { TOOL_MAX_DURABILITY } from '../data/toolDurability';
import { PERISHABLE_IDS } from '../data/foodDecay';
import { DEFAULT_KNOWLEDGE, MATERIAL_KNOWLEDGE_GRANTS, type KnowledgeFlag, KNOWLEDGE_INSIGHTS } from '../data/knowledge';
import { getInsightsByFocus, INITIAL_FOCUSES, FOCUS_UNLOCK_CONDITIONS, type ReflectionFocus } from '../data/ideas';

interface PlayerStore {
  player: Player;
  knownMaterials: string[];          // every resourceId ever picked up
  learnMaterial: (id: string) => void;
  knowledge: Record<KnowledgeFlag, boolean>;
  learnKnowledge: (flag: KnowledgeFlag) => void;
  craftCounts: Record<string, number>;  // recipeId → times crafted
  recordCraft: (recipeId: string) => void;
  getCraftXpMultiplier: (recipeId: string) => number;

  // Grübel-System
  reflectionFocus: ReflectionFocus | null;
  collectedInsights: string[];       // insight IDs gathered so far
  unlockedFocuses: ReflectionFocus[];
  setReflectionFocus: (focus: ReflectionFocus | null) => void;
  checkInsight: (materialId: string) => void; // call on material pickup

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
      reflectionFocus: null,
      collectedInsights: [],
      unlockedFocuses: [...INITIAL_FOCUSES],

      learnMaterial: (id: string) => {
        if (get().knownMaterials.includes(id)) return;
        set(s => ({ knownMaterials: [...s.knownMaterials, id] }));
        const flag = MATERIAL_KNOWLEDGE_GRANTS[id];
        if (flag) get().learnKnowledge(flag);
        get().checkInsight(id);
      },

      setReflectionFocus: (focus) => set({ reflectionFocus: focus }),

      checkInsight: (materialId: string) => {
        const state = get();
        if (!state.reflectionFocus) return;
        const insightMap = getInsightsByFocus(state.reflectionFocus);
        const entry = insightMap.get(materialId);
        if (!entry) return;
        const { idea, insight } = entry;
        if (state.collectedInsights.includes(insight.id)) return;
        // Check requiresKnowledge gate
        if (idea.requiresKnowledge && !state.knowledge[idea.requiresKnowledge]) return;

        const newInsights = [...state.collectedInsights, insight.id];
        set({ collectedInsights: newInsights });

        // Show insight toast
        import('../store/notificationStore').then(({ useNotificationStore }) => {
          const allCollected = idea.insights.every(i => newInsights.includes(i.id));
          useNotificationStore.getState().addNotification(insight.text, 'xp');
          if (allCollected) {
            setTimeout(() => {
              useNotificationStore.getState().addNotification(
                `💡 Idee verstanden: ${idea.name}`,
                'levelup'
              );
            }, 800);
            for (const flag of idea.grantsKnowledge) {
              get().learnKnowledge(flag);
            }
          } else {
            const done = idea.insights.filter(i => newInsights.includes(i.id)).length;
            useNotificationStore.getState().addNotification(
              `Idee: ${idea.name} — ${done}/${idea.insights.length}`,
              'xp'
            );
          }
        });
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
        // Unlock new reflection focuses if this flag is the condition
        const state = get();
        for (const [focus, requiredFlag] of Object.entries(FOCUS_UNLOCK_CONDITIONS) as [ReflectionFocus, KnowledgeFlag][]) {
          if (requiredFlag === flag && !state.unlockedFocuses.includes(focus)) {
            set(s => ({ unlockedFocuses: [...s.unlockedFocuses, focus] }));
          }
        }
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

      addToInventory: (resourceId: string, quantity: number) => {
        get().learnMaterial(resourceId);
        // checkInsight fires on every pickup (learnMaterial skips known materials)
        if (get().knownMaterials.includes(resourceId)) get().checkInsight(resourceId);
        const state = get();
        const { items, maxSlots } = state.player.inventory;

        // Weight check
        const addedWeight = (ITEM_WEIGHTS[resourceId] ?? 0.5) * quantity;
        const currentWeight = calcWeight(items);
        if (currentWeight + addedWeight > MAX_CARRY_KG) return false;

        const gameElapsed = (() => {
          try { return useGameStore.getState().elapsedTime; } catch { return 0; }
        })();

        const existing = items.find((item) => item.resourceId === resourceId);
        if (existing) {
          existing.quantity += quantity;
          // Refresh addedAt when stacking perishables so new items don't inherit an old timestamp
          if (PERISHABLE_IDS.has(resourceId) && existing.addedAt !== undefined) {
            existing.addedAt = gameElapsed;
          }
          set((s) => ({ player: { ...s.player } }));
          return true;
        } else if (items.length < maxSlots) {
          items.push({
            id: `${resourceId}-${Date.now()}`,
            resourceId,
            quantity,
            slot: items.length,
            addedAt: PERISHABLE_IDS.has(resourceId) ? gameElapsed : undefined,
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

          // Set new slot (include initial durability for tools)
          const initialDurability = TOOL_MAX_DURABILITY[resourceId];
          const newItem = initialDurability !== undefined
            ? { resourceId, durability: initialDurability }
            : { resourceId };
          if (slot.startsWith('belt')) {
            const idx = parseInt(slot.replace('belt', '')) as 0|1|2;
            eq.belt[idx] = newItem;
          } else {
            (eq as any)[slot] = newItem;
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

      gainSkillXp: (skillId, xp) => {
        set((state) => {
          const MAX_LEVEL = 10;
          const skills = { ...(state.player.skills ?? DEFAULT_SKILLS) };
          const skill = { ...skills[skillId] };
          skill.xp += xp;
          while (skill.level < MAX_LEVEL && skill.xp >= skill.level * 20) {
            skill.xp -= skill.level * 20;
            skill.level += 1;
            // Lazy import to avoid circular dependency
            import('../store/notificationStore').then(({ useNotificationStore }) => {
              useNotificationStore.getState().addNotification(
                `${skillId}:levelup:${skill.level}`,
                'levelup'
              );
            });
          }
          if (skill.level >= MAX_LEVEL) skill.xp = Math.min(skill.xp, MAX_LEVEL * 20);
          skills[skillId] = skill;
          return { player: { ...state.player, skills } };
        });
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

          if (broke) {
            import('../store/notificationStore').then(({ useNotificationStore }) => {
              useNotificationStore.getState().addNotification(`${brokenName} ist zerbrochen! ⚒️`, 'levelup');
            });
          }

          return { player: { ...state.player, equipment: eq } };
        });
      },

      reset: () => set({ player: { ...defaultPlayer, equipment: { ...defaultEquipment, belt: [null, null, null] }, skills: { ...DEFAULT_SKILLS } }, knownMaterials: [], knowledge: { ...DEFAULT_KNOWLEDGE }, craftCounts: {}, reflectionFocus: null, collectedInsights: [], unlockedFocuses: [...INITIAL_FOCUSES] }),
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
        if (state && !state.collectedInsights) {
          state.collectedInsights = [];
        }
        if (state && !state.unlockedFocuses) {
          state.unlockedFocuses = [...INITIAL_FOCUSES];
        }
      },
    }
  )
);
