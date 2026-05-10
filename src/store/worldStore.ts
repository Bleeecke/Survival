import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorldState } from '../types';

interface WorldStore {
  world: WorldState | null;

  initializeWorld: (world: WorldState) => void;
  harvestResource: (resourceId: string, quantity: number) => void;
  placeStructure: (structureId: string, x: number, y: number) => void;
  placeConstructionSite: (target: string, x: number, y: number, days: number) => void;
  updateStructure: (structureId: string, partial: Partial<import('../types').Structure>) => void;
  progressConstruction: (structureId: string, currentDay: number) => boolean;
  updateStructureStorage: (structureId: string, items: { resourceId: string; quantity: number }[]) => void;
  regenerateResources: () => void;
  getTile: (x: number, y: number) => any;
  reset: () => void;
}

export const useWorldStore = create<WorldStore>()(
  persist(
    (set, get) => ({
      world: null,

      initializeWorld: (world: WorldState) => set({ world }),

      harvestResource: (resourceId: string, quantity: number) => {
        set((state) => {
          if (!state.world) return state;

          const resource = state.world.resources.find((r) => r.id === resourceId);
          if (!resource) return state;

          resource.quantity = Math.max(0, resource.quantity - quantity);
          resource.lastHarvestedAt = Date.now();

          return { world: { ...state.world } };
        });
      },

      placeStructure: (structureId: string, x: number, y: number) => {
        set((state) => {
          if (!state.world) return state;

          state.world.structures.push({
            id: `structure-${Date.now()}`,
            type: structureId,
            x,
            y,
            health: 100,
            maxHealth: 100,
            // Campfire starts with 1 day of fuel (from the sticks used to build it)
            ...(structureId === 'campfire' ? { fuel: 1 } : {}),
          });

          return { world: { ...state.world } };
        });
      },

      placeConstructionSite: (target, x, y, days) => {
        set((state) => {
          if (!state.world) return state;
          state.world.structures.push({
            id: `structure-${Date.now()}`,
            type: 'construction_site',
            x, y,
            health: 100, maxHealth: 100,
            constructionTarget: target,
            constructionDaysLeft: days,
            lastBuildDay: -1,
          });
          return { world: { ...state.world } };
        });
      },

      progressConstruction: (structureId, currentDay) => {
        let progressed = false;
        set((state) => {
          if (!state.world) return state;
          const idx = state.world.structures.findIndex(s => s.id === structureId);
          if (idx === -1) return state;
          const s = state.world.structures[idx];
          if (!s.constructionTarget || !s.constructionDaysLeft) return state;
          if (s.lastBuildDay === currentDay) return state;

          progressed = true;
          const newDays = s.constructionDaysLeft - 1;
          if (newDays <= 0) {
            state.world.structures[idx] = {
              id: s.id, type: s.constructionTarget, x: s.x, y: s.y, health: 100, maxHealth: 100,
            };
          } else {
            state.world.structures[idx] = { ...s, constructionDaysLeft: newDays, lastBuildDay: currentDay };
          }
          return { world: { ...state.world } };
        });
        return progressed;
      },

      updateStructure: (structureId, partial) => {
        set((state) => {
          if (!state.world) return state;
          const idx = state.world.structures.findIndex(s => s.id === structureId);
          if (idx === -1) return state;
          state.world.structures[idx] = { ...state.world.structures[idx], ...partial };
          return { world: { ...state.world } };
        });
      },

      updateStructureStorage: (structureId, items) => {
        set((state) => {
          if (!state.world) return state;
          const structure = state.world.structures.find(s => s.id === structureId);
          if (!structure) return state;
          structure.storage = items;
          return { world: { ...state.world } };
        });
      },

      regenerateResources: () => {
        set((state) => {
          if (!state.world) return state;
          const now = Date.now();

          for (const resource of state.world.resources) {
            if (
              resource.regenerationTime &&
              resource.lastHarvestedAt &&
              now - resource.lastHarvestedAt > resource.regenerationTime
            ) {
              resource.quantity = resource.maxQuantity;
            }
          }

          return { world: { ...state.world } };
        });
      },

      getTile: (x: number, y: number) => {
        const { world } = get();
        if (!world || !world.tileMap[y]) return null;
        return world.tileMap[y][x] || null;
      },

      reset: () => set({ world: null }),
    }),
    {
      name: 'survival-world-save',
      // tileMap is huge (150×150) and regenerated from seed — don't persist it
      partialize: (state) => ({
        world: state.world ? {
          seed: state.world.seed,
          width: state.world.width,
          height: state.world.height,
          structures: state.world.structures,
          resources: state.world.resources,
          spawnX: state.world.spawnX,
          spawnY: state.world.spawnY,
          tileMap: [],
        } : null,
      }),
    }
  )
);
