import { usePlayerStore } from '../../store/playerStore';
import type { EquipSlot } from '../../types';
import { TOOL_MAX_DURABILITY } from '../../data/toolDurability';

// Which items go in which slot (ordered by preference)
export const EQUIPPABLE: Record<string, EquipSlot[]> = {
  // Both hands possible for tools
  shell_knife:       ['rightHand', 'leftHand'],
  flint_knife:       ['rightHand', 'leftHand'],
  stone_axe:         ['rightHand', 'leftHand'],
  stone_pickaxe:     ['rightHand', 'leftHand'],
  stone_spear:       ['rightHand', 'leftHand'],
  improved_axe:      ['rightHand', 'leftHand'],
  improved_pickaxe:  ['rightHand', 'leftHand'],
  iron_axe:          ['rightHand', 'leftHand'],
  iron_pickaxe:      ['rightHand', 'leftHand'],
  torch:             ['leftHand', 'rightHand'],
  fishing_rod:       ['rightHand', 'leftHand'],
  // Belt (consumables for quick access)
  water:             ['belt0', 'belt1', 'belt2'],
  water_container:   ['belt0', 'belt1', 'belt2'],
  herbal_remedy:     ['belt0', 'belt1', 'belt2'],
  cooked_food:       ['belt0', 'belt1', 'belt2'],
  cooked_fish_meal:  ['belt0', 'belt1', 'belt2'],
  cooked_mushroom:   ['belt0', 'belt1', 'belt2'],
  exotic_fruit:      ['belt0', 'belt1', 'belt2'],
  mushroom:          ['belt0', 'belt1', 'belt2'],
  food:              ['belt0', 'belt1', 'belt2'],
};

// Returns the first free slot from the preference list
export function getDefaultSlot(resourceId: string, equipment?: any): EquipSlot | null {
  const slots = EQUIPPABLE[resourceId];
  if (!slots || slots.length === 0) return null;
  if (!equipment) return slots[0];

  for (const slot of slots) {
    if (slot.startsWith('belt')) {
      const idx = parseInt(slot.replace('belt', ''));
      if (!equipment.belt?.[idx]) return slot;
    } else {
      if (!equipment[slot]) return slot;
    }
  }
  // All preferred slots full — return first (will swap out existing)
  return slots[0];
}

const ITEM_ICON: Record<string, string> = {
  shell_knife: '🐚', flint_knife: '🔪', stone_axe: '🪓', stone_pickaxe: '⛏️', stone_spear: '🗡️',
  improved_axe: '🪓', improved_pickaxe: '⛏️', iron_axe: '🪓', iron_pickaxe: '⛏️',
  torch: '🕯️', fishing_rod: '🎣',
  water: '💧', water_container: '🪣', herbal_remedy: '🌿',
  cooked_food: '🍖', cooked_fish_meal: '🐟', cooked_mushroom: '🍄',
  exotic_fruit: '🍊', mushroom: '🍄', food: '🫐',
};

const ITEM_NAMES: Record<string, string> = {
  shell_knife: 'Muschelklinge', flint_knife: 'Messer', stone_axe: 'Steinaxt', stone_pickaxe: 'Spitzhacke',
  stone_spear: 'Speer', improved_axe: 'Verb. Axt', improved_pickaxe: 'Verb. Hacke',
  iron_axe: 'Eisenaxt', iron_pickaxe: 'Eisenhacke', torch: 'Fackel',
  fishing_rod: 'Angel', water: 'Wasser', water_container: 'Wasserbehälter',
  herbal_remedy: 'Kräuter', cooked_food: 'Essen', cooked_fish_meal: 'Fisch',
  cooked_mushroom: 'Pilze', exotic_fruit: 'Frucht', mushroom: 'Pilze', food: 'Beeren',
};

function SlotBox({
  label, item, slotKey, keybind, locked = false,
  onUnequip,
}: {
  label: string;
  item: { resourceId: string } | null;
  slotKey: EquipSlot;
  keybind?: string;
  locked?: boolean;
  onUnequip: (slot: EquipSlot) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-slate-500 text-[9px] uppercase tracking-wider leading-none">{label}</span>
      <div
        onClick={() => !locked && item && onUnequip(slotKey)}
        title={item ? `${ITEM_NAMES[item.resourceId] ?? item.resourceId} – klicken zum Ablegen` : locked ? 'Noch nicht verfügbar' : 'Leer'}
        className={`w-10 h-10 rounded-lg border flex items-center justify-center text-lg relative select-none transition-colors ${
          locked
            ? 'border-slate-700 bg-slate-800/30 cursor-not-allowed opacity-40'
            : item
              ? 'border-amber-600 bg-amber-900/30 cursor-pointer hover:bg-amber-900/50'
              : 'border-slate-600 bg-slate-800/60 cursor-default'
        }`}
      >
        {item ? (
          <span>{ITEM_ICON[item.resourceId] ?? '?'}</span>
        ) : (
          <span className="text-slate-600 text-xs">{locked ? '🔒' : '—'}</span>
        )}
        {keybind && (
          <span className="absolute -bottom-1 -right-1 bg-slate-700 text-slate-300 text-[8px] font-bold rounded px-0.5 leading-tight">
            {keybind}
          </span>
        )}
        {/* Durability bar */}
        {item && item.durability !== undefined && (() => {
          const max = TOOL_MAX_DURABILITY[item.resourceId] ?? 1;
          const pct = Math.max(0, item.durability / max) * 100;
          const color = pct > 60 ? 'bg-green-500' : pct > 25 ? 'bg-yellow-500' : 'bg-red-500';
          return (
            <div className="absolute bottom-0.5 left-1 right-1 h-1 bg-slate-900 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${color} transition-all duration-200`} style={{ width: `${pct}%` }} />
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default function CharacterPanel() {
  const equipment = usePlayerStore(s => s.player.equipment);
  const unequip   = usePlayerStore(s => s.unequip);

  // Guard for saves without equipment field
  const eq = equipment ?? { head: null, chest: null, legs: null, leftHand: null, rightHand: null, belt: [null, null, null] };

  return (
    <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-2.5 w-36 select-none backdrop-blur-sm">
      <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-2 text-center">Ausrüstung</div>

      {/* Head */}
      <div className="flex justify-center mb-1.5">
        <SlotBox label="Kopf" item={eq.head} slotKey="head" locked onUnequip={unequip} />
      </div>

      {/* Hands + Torso row */}
      <div className="flex items-center justify-between mb-1.5 gap-1">
        <SlotBox label="L. Hand" item={eq.leftHand} slotKey="leftHand" onUnequip={unequip} />

        {/* Body slots stacked */}
        <div className="flex flex-col gap-1 items-center">
          <SlotBox label="Oberk." item={eq.chest} slotKey="chest" locked onUnequip={unequip} />
          <SlotBox label="Unterk." item={eq.legs} slotKey="legs" locked onUnequip={unequip} />
        </div>

        <SlotBox label="R. Hand" item={eq.rightHand} slotKey="rightHand" onUnequip={unequip} />
      </div>

      {/* Belt */}
      <div className="border-t border-slate-700 pt-2 mt-0.5">
        <div className="text-slate-500 text-[9px] uppercase tracking-wider text-center mb-1">Gürtel</div>
        <div className="flex justify-between gap-1">
          {([0, 1, 2] as const).map(i => (
            <SlotBox
              key={i}
              label=""
              item={eq.belt[i]}
              slotKey={`belt${i}` as EquipSlot}
              keybind={String(i + 1)}
              onUnequip={unequip}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
