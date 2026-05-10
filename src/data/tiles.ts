import type { TileType } from '../types';

export const TILE_TYPES: Record<string, TileType> = {
  // ── Legacy (kept for old saves) ───────────────────────────────────
  sand: {
    id: 'sand', name: 'Sand', walkable: true, spriteIndex: 4, movementCost: 1.2,
  },
  forest: {
    id: 'forest', name: 'Forest', walkable: true, spriteIndex: 2, movementCost: 1.5,
  },
  rock: {
    id: 'rock', name: 'Rock', walkable: false, spriteIndex: 3,
  },

  // ── Active biomes ─────────────────────────────────────────────────
  water: {
    id: 'water', name: 'Wasser', walkable: false, spriteIndex: 1,
  },
  beach: {
    id: 'beach', name: 'Strand', walkable: true, spriteIndex: 4, movementCost: 1.2,
  },
  grass: {
    id: 'grass', name: 'Wiese', walkable: true, spriteIndex: 0, movementCost: 1.0,
  },
  tall_grass: {
    id: 'tall_grass', name: 'Hohes Gras', walkable: true, spriteIndex: 5, movementCost: 1.3,
  },
  sparse_forest: {
    id: 'sparse_forest', name: 'Lichter Wald', walkable: true, spriteIndex: 6, movementCost: 1.2,
  },
  dense_jungle: {
    id: 'dense_jungle', name: 'Dichter Dschungel', walkable: true, spriteIndex: 7, movementCost: 1.7,
  },
  hills: {
    id: 'hills', name: 'Hügel', walkable: true, spriteIndex: 8, movementCost: 1.4,
  },
  mountain: {
    id: 'mountain', name: 'Berge', walkable: true, spriteIndex: 9, movementCost: 1.9,
  },
  impassable: {
    id: 'impassable', name: 'Unpassierbar', walkable: false, spriteIndex: 10,
  },
};
