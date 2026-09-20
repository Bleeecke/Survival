import type { ItemCondition } from './player';
import type { IslandGeneration } from './generation';

export interface StoredItem extends ItemCondition {
  resourceId: string;
  quantity: number;
}

export interface Tile {
  id: string;
  type: string;
  walkable: boolean;
  x: number;
  y: number;
  spriteIndex: number;
  elevation: number; // 0=water, 1=beach/grassland, 2=forest/plateau, 3=hills/mountain, 4=peaks
  isRamp?: boolean;  // bidirectional traversal point between elevation tiers
  rampDir?: 'n' | 's' | 'e' | 'w'; // direction the ramp exits downhill
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
  storage?: StoredItem[];
  // Construction site progress
  constructionTarget?: string;
  constructionDaysLeft?: number;
  lastBuildDay?: number;
  // Campfire fuel (game-days remaining)
  fuel?: number;
  coldFuel?: number;
  coolingUntil?: number;
  // Multi-tile width (default 1)
  width?: number;
}

export interface ShipwreckPiece {
  x: number; y: number;          // tile coords
  type: 'hull' | 'plank' | 'mast' | 'hull_small';
  rotation: number;              // radians, visual only
  scale: number;                 // 0.6–1.4
}

export interface DroppedItem extends ItemCondition {
  id: string;
  resourceId: string;
  quantity: number;
  x: number;
  y: number;
}

export interface WorldState {
  constructionSites?: ConstructionSite[];
  buildReservations?: BuildReservation[];
  generation?: IslandGeneration;
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
  constructionSites?: ConstructionSite[];
  buildReservations?: BuildReservation[];
  generation?: IslandGeneration;
  seed: number;
  width: number;
  height: number;
  structures: Structure[];
  resources: WorldResource[];
  spawnX: number;
  spawnY: number;
}

export interface ConstructionSite {
  id: string;
  version: 1;
  target: string;
  x: number;
  y: number;
  width: number;
  work: number;
  completed: number;
  materials: { item: string; amount: number }[];
  supplied: boolean;
  delivered?: Record<string, number>;
  sourceId?: string;
  mode: 'build' | 'upgrade' | 'move';
  phase: 'build' | 'pack' | 'carry';
  cargo?: Structure;
  cargoX?: number;
  cargoY?: number;
}
export interface BuildReservation { ownerId: string; x: number; y: number; width: number; }
