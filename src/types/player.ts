export type Direction = 'up' | 'down' | 'left' | 'right';

export type EquipSlot = 'head' | 'chest' | 'legs' | 'leftHand' | 'rightHand' | `belt${0|1|2}`;

export interface EquippedItem {
  resourceId: string;
}

export interface Equipment {
  head:      EquippedItem | null;
  chest:     EquippedItem | null;
  legs:      EquippedItem | null;
  leftHand:  EquippedItem | null;
  rightHand: EquippedItem | null;
  belt:      [EquippedItem | null, EquippedItem | null, EquippedItem | null];
}

export interface PlayerStats {
  health: number;   // 0-100
  hunger: number;   // 0-100  (0 = Satt, 100 = Verhungernd)
  thirst: number;   // 0-100  (0 = Hydriert, 100 = Verdurstend)
  stamina: number;  // 0-100
  fatigue: number;  // 0-100  (0 = Frisch, 100 = Erschöpft)
  poisonedUntil?: number; // real timestamp ms — health drain while active
}

export interface InventoryItem {
  id: string;
  resourceId: string;
  quantity: number;
  slot: number;
}

export interface Inventory {
  items: InventoryItem[];
  maxSlots: number;
}

export interface Player {
  id: string;
  x: number;
  y: number;
  direction: Direction;
  stats: PlayerStats;
  inventory: Inventory;
  equipment: Equipment;
  name?: string;
}
