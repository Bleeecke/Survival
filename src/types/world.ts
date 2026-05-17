export interface Tile {
  id: string;
  type: string;
  walkable: boolean;
  x: number;
  y: number;
  spriteIndex: number;
}

export interface TileType {
  id: string;
  name: string;
  walkable: boolean;
  spriteIndex: number;
  movementCost?: number;
}

export interface WorldResource {
  id: string;
  type: string;
  x: number;
  y: number;
  quantity: number;
  maxQuantity: number;
  regenerationTime?: number;
  lastHarvestedAt?: number;
  regenStep?: number; // units restored per regen tick (default: full restore)
}

export interface Structure {
  id: string;
  type: string;
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  // Storage box contents
  storage?: { resourceId: string; quantity: number }[];
  // Construction site progress
  constructionTarget?: string;
  constructionDaysLeft?: number;
  lastBuildDay?: number;
  // Campfire fuel (game-days remaining)
  fuel?: number;
  // Multi-tile width (default 1)
  width?: number;
}

export interface ShipwreckPiece {
  x: number; y: number;          // tile coords
  type: 'hull' | 'plank' | 'mast' | 'hull_small';
  rotation: number;              // radians, visual only
  scale: number;                 // 0.6–1.4
}

export interface DroppedItem {
  id: string;
  resourceId: string;
  quantity: number;
  x: number;
  y: number;
}

export interface WorldState {
  seed: number;
  width: number;
  height: number;
  tileMap: Tile[][];
  resources: WorldResource[];
  structures: Structure[];
  droppedItems: DroppedItem[];
  spawnX: number;
  spawnY: number;
  shipwreck?: ShipwreckPiece[];
}

export interface WorldSnapshot {
  seed: number;
  width: number;
  height: number;
  structures: Structure[];
  resources: WorldResource[];
  spawnX: number;
  spawnY: number;
}
