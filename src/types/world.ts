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
}

export interface WorldState {
  seed: number;
  width: number;
  height: number;
  tileMap: Tile[][];
  resources: WorldResource[];
  structures: Structure[];
  spawnX: number;
  spawnY: number;
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
