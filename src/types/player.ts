import { Skills, DEFAULT_SKILLS } from './skills';
export type { Skills, SkillId, Skill } from './skills';

export type Direction = 'up' | 'down' | 'left' | 'right';

export type EquipSlot = 'head' | 'chest' | 'legs' | 'leftHand' | 'rightHand' | `belt${0|1|2}`;

export interface EquippedItem {
  resourceId: string;
  durability?: number; // current uses remaining; undefined = no durability tracking
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
  poisonedUntil?: number;   // real timestamp ms
  coldUntil?: number;       // real timestamp ms — Erkältung
  feverUntil?: number;      // real timestamp ms — Fieber
  parasitesUntil?: number;  // real timestamp ms — Parasiten
  bleedingUntil?: number;   // real timestamp ms — Blutung (Tierbiss)
  woundedUntil?: number;    // real timestamp ms — Schnittwunde (Feuerstein)
}

export interface InventoryItem {
  id: string;
  resourceId: string;
  quantity: number;
  slot: number;
  addedAt?: number; // game-time ms when item was first collected (for decay)
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
  skills: Skills;
  name?: string;
}

export { DEFAULT_SKILLS };
