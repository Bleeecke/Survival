import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorldState, DroppedItem } from '../types';

interface WorldStore {
  world: WorldState | null;

  initializeWorld: (world: WorldState) => void;
  harvestResource: (resourceId: string, quantity: number) => void;
  dropItem: (resourceId: string, quantity: number, playerTileX: number, playerTileY: number) => boolean;
  pickupDroppedItem: (id: string) => DroppedItem | null;
  placeStructure: (structureId: string, x: number, y: number) => void;
  placeConstructionSite: (target: string, x: number, y: number, days: number) => void;
  updateStructure: (structureId: string, partial: Partial<import('../types').Structure>) => void;
  progressConstruction: (structureId: string, currentDay: number) => boolean;
  updateStructureStorage: (structureId: string, items: { resourceId: string; quantity: number }[]) => void;
  regenerateResources: () => void;
  getTile: (x: number, y: number) => any;
  reset: () => void;
}

// Tile offsets checked in order: center first, then 8 neighbors
const DROP_OFFSETS = [
  [0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1],
];

export const useWorldStore = create<WorldStore>()(
  persist(
    (set, get) => ({
      world: null,

      initializeWorld: (world: WorldState) => set({ world: { ...world, droppedItems: world.droppedItems ?? [] } }),

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

      dropItem: (resourceId, quantity, playerTileX, playerTileY) => {
        let placed = false;
        set((state) => {
          if (!state.world) return state;
          const { tileMap, structures } = state.world;
          const droppedItems = state.world.droppedItems ?? [];

          for (const [dx, dy] of DROP_OFFSETS) {
            const tx = playerTileX + dx;
            const ty = playerTileY + dy;
            const tile = tileMap[ty]?.[tx];
            if (!tile?.walkable) continue;
            if (structures.some(s => s.x === tx && s.y === ty)) continue;
            if (droppedItems.some(d => d.x === tx && d.y === ty)) continue;

            placed = true;
            const newDrop: DroppedItem = {
              id: `drop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              resourceId,
              quantity,
              x: tx,
              y: ty,
            };
            return { world: { ...state.world, droppedItems: [...droppedItems, newDrop] } };
          }
          return state;
        });
        return placed;
      },

      pickupDroppedItem: (id) => {
        let found: DroppedItem | null = null;
        set((state) => {
          if (!state.world) return state;
          const drops = state.world.droppedItems ?? [];
          const item = drops.find(d => d.id === id);
          if (!item) return state;
          found = item;
          return { world: { ...state.world, droppedItems: drops.filter(d => d.id !== id) } };
        });
        return found;
      },

      placeStructure: (structureId: string, x: number, y: number) => {
        set((state) => {
          if (!state.world) return state;

          const STRUCTURE_WIDTHS: Record<string, number> = { palm_shelter: 2 };
          state.world.structures.push({
            id: `structure-${Date.now()}`,
            type: structureId,
            x,
            y,
            health: 100,
            maxHealth: 100,
            ...(structureId === 'campfire' ? { fuel: 1 } : {}),
            ...(structureId === 'water_container' ? { fuel: 0 } : {}),
            ...(STRUCTURE_WIDTHS[structureId] ? { width: STRUCTURE_WIDTHS[structureId] } : {}),
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
              resource.quantity < resource.maxQuantity &&
              now - resource.lastHarvestedAt > resource.regenerationTime
            ) {
              if (resource.regenStep) {
                resource.quantity = Math.min(resource.maxQuantity, resource.quantity + resource.regenStep);
                resource.lastHarvestedAt = now;
              } else {
                resource.quantity = resource.maxQuantity;
              }
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
      onRehydrateStorage: () => (state) => {
        if (state?.world && !state.world.droppedItems) {
          state.world.droppedItems = [];
        }
      },
      partialize: (state) => ({
        world: state.world ? {
          seed: state.world.seed,
          width: state.world.width,
          height: state.world.height,
          structures: state.world.structures,
          resources: state.world.resources,
          droppedItems: state.world.droppedItems ?? [],
          spawnX: state.world.spawnX,
          spawnY: state.world.spawnY,
          tileMap: [],
        } : null,
      }),
    }
  )
);
