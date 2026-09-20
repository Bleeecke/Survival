import { createId } from '../services/game/createId';
import type { ItemCondition } from '../types/player';
import { migrateConstruction, buildWidth } from '../services/game/constructionMigration';
import type { StoredItem } from '../types/world';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorldState, DroppedItem } from '../types';

interface WorldStore {
  world: WorldState | null;

  initializeWorld: (world: WorldState) => void;
  harvestResource: (resourceId: string, quantity: number) => void;
  dropItem: (resourceId: string, quantity: number, playerTileX: number, playerTileY: number, condition?: ItemCondition) => boolean;
  pickupDroppedItem: (id: string) => DroppedItem | null;
  placeStructure: (structureId: string, x: number, y: number) => void;
  updateStructure: (structureId: string, partial: Partial<import('../types').Structure>) => void;
  updateStructureStorage: (structureId: string, items: StoredItem[]) => void;
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

      initializeWorld: (world: WorldState) => set({ world: migrateConstruction({ ...world, droppedItems: world.droppedItems ?? [] }) }),

      harvestResource: (resourceId: string, quantity: number) => {
        set((state) => {
          if (!state.world) return state;

          const resource = state.world.resources.find((r) => r.id === resourceId);
          if (!resource) return state;

          resource.quantity = Math.max(0, resource.quantity - quantity);
          resource.lastHarvestedAt = Date.now();

          return { world: { ...state.world, resources: [...state.world.resources] } };
        });
      },

      dropItem: (resourceId, quantity, playerTileX, playerTileY, condition = {}) => {
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
              ...condition,
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

          state.world.structures.push({
            id: `structure-${createId()}`,
            type: structureId,
            x,
            y,
            health: 100,
            maxHealth: 100,
            ...(structureId === 'campfire' ? { fuel: 1 } : {}),
            ...(structureId === 'water_container' ? { fuel: 0 } : {}),
            width: buildWidth(structureId),
          });

          return { world: { ...state.world, structures: [...state.world.structures] } };
        });
      },

      updateStructure: (structureId, partial) => {
        set((state) => {
          if (!state.world) return state;
          const idx = state.world.structures.findIndex(s => s.id === structureId);
          if (idx === -1) return state;
          state.world.structures[idx] = { ...state.world.structures[idx], ...partial };
          return { world: { ...state.world, structures: [...state.world.structures] } };
        });
      },

      updateStructureStorage: (structureId, items) => {
        set((state) => {
          if (!state.world) return state;
          const structure = state.world.structures.find(s => s.id === structureId);
          if (!structure) return state;
          structure.storage = items;
          return { world: { ...state.world, structures: [...state.world.structures] } };
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

          return { world: { ...state.world, resources: [...state.world.resources] } };
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
          generation: state.world.generation,
          width: state.world.width,
          height: state.world.height,
          structures: state.world.structures,
          constructionSites: state.world.constructionSites ?? [],
          buildReservations: state.world.buildReservations ?? [],
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
