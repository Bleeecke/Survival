import { usePlayerStore } from '../../store/playerStore';
import type { PlayerStats } from '../../types';
import { calcWeight, MAX_CARRY_KG } from '../../data/weights';
import { getDefaultSlot } from './CharacterPanel';

// Items that can be used from the inventory
export const USABLE: Record<string, {
  label: string;
  color: string;
  effect: (s: PlayerStats) => Partial<PlayerStats>;
  tooltip: string;
}> = {
  food: {
    label: 'Essen',
    color: 'bg-green-700 hover:bg-green-600',
    effect: s => ({
      hunger: Math.max(0, s.hunger - 25),
      health: Math.min(100, s.health + 3),
    }),
    tooltip: 'Hunger -25, Gesundheit +3',
  },
  cooked_food: {
    label: 'Essen',
    color: 'bg-green-700 hover:bg-green-600',
    effect: s => ({
      hunger: Math.max(0, s.hunger - 55),
      health: Math.min(100, s.health + 15),
    }),
    tooltip: 'Hunger -55, Gesundheit +15',
  },
  water: {
    label: 'Trinken',
    color: 'bg-sky-700 hover:bg-sky-600',
    effect: s => ({
      thirst:  Math.max(0, (s.thirst ?? 0) - 30),
      stamina: Math.min(100, s.stamina + 10),
    }),
    tooltip: 'Durst -30, Ausdauer +10',
  },
  water_container: {
    label: 'Trinken',
    color: 'bg-sky-700 hover:bg-sky-600',
    effect: s => ({
      thirst:  Math.max(0, (s.thirst ?? 0) - 60),
      stamina: Math.min(100, s.stamina + 25),
      health:  Math.min(100, s.health + 5),
    }),
    tooltip: 'Durst -60, Ausdauer +25, Gesundheit +5',
  },
  cooked_fish_meal: {
    label: 'Essen',
    color: 'bg-green-700 hover:bg-green-600',
    effect: s => ({
      hunger: Math.max(0, s.hunger - 70),
      health: Math.min(100, s.health + 20),
    }),
    tooltip: 'Hunger -70, Gesundheit +20',
  },
  mushroom: {
    label: 'Essen',
    color: 'bg-yellow-700 hover:bg-yellow-600',
    effect: s => ({
      hunger: Math.max(0, s.hunger - 20),
      health: Math.min(100, s.health + 5),
    }),
    tooltip: 'Hunger -20, Gesundheit +5 (roh)',
  },
  cooked_mushroom: {
    label: 'Essen',
    color: 'bg-yellow-700 hover:bg-yellow-600',
    effect: s => ({
      hunger: Math.max(0, s.hunger - 40),
      health: Math.min(100, s.health + 12),
    }),
    tooltip: 'Hunger -40, Gesundheit +12',
  },
  exotic_fruit: {
    label: 'Essen',
    color: 'bg-orange-700 hover:bg-orange-600',
    effect: s => ({
      hunger: Math.max(0, s.hunger - 50),
      stamina: Math.min(100, s.stamina + 20),
      health: Math.min(100, s.health + 8),
    }),
    tooltip: 'Hunger -50, Ausdauer +20, Gesundheit +8',
  },
  herbal_remedy: {
    label: 'Heilen',
    color: 'bg-emerald-700 hover:bg-emerald-600',
    effect: s => ({
      health: Math.min(100, s.health + 35),
      fatigue: Math.max(0, (s.fatigue ?? 0) - 10),
    }),
    tooltip: 'Gesundheit +35, Müdigkeit -10',
  },
  turtle_meat: {
    label: '⚠️ Roh essen',
    color: 'bg-red-800 hover:bg-red-700',
    effect: s => ({
      hunger: Math.max(0, s.hunger - 30),
      poisonedUntil: Date.now() + 3 * 60_000,
    }),
    tooltip: '⚠️ Hunger -30 aber Vergiftung für 3 Min!',
  },
  cooked_turtle: {
    label: 'Essen',
    color: 'bg-green-700 hover:bg-green-600',
    effect: s => ({
      hunger: Math.max(0, s.hunger - 65),
      health: Math.min(100, s.health + 20),
    }),
    tooltip: 'Hunger -65, Gesundheit +20',
  },
  crab_meat: {
    label: 'Essen',
    color: 'bg-orange-700 hover:bg-orange-600',
    effect: s => ({
      hunger: Math.max(0, s.hunger - 20),
      health: Math.min(100, s.health + 3),
    }),
    tooltip: 'Hunger -20, Gesundheit +3 (roh)',
  },
  cooked_crab: {
    label: 'Essen',
    color: 'bg-orange-700 hover:bg-orange-600',
    effect: s => ({
      hunger: Math.max(0, s.hunger - 55),
      health: Math.min(100, s.health + 18),
      stamina: Math.min(100, s.stamina + 15),
    }),
    tooltip: 'Hunger -55, Gesundheit +18, Ausdauer +15',
  },
};

const ITEM_NAMES: Record<string, string> = {
  wood: 'Holz', stone: 'Stein', food: 'Beeren', water: 'Wasser',
  sticks: 'Äste', pebbles: 'Kieselsteine', spring: 'Quelle',
  rope: 'Seil', plank: 'Holzbretter', iron_ore: 'Eisenerz', iron_bar: 'Eisenbarren',
  // New resources
  flint: 'Feuerstein', driftwood: 'Treibholz', shells: 'Muscheln',
  palm_leaf: 'Palmenblatt', herbs: 'Kräuter', fiber: 'Fasern',
  mushroom: 'Pilze', exotic_fruit: 'Exotische Frucht', vine: 'Lianen',
  // Tools
  flint_knife: 'Feuersteinmesser',
  stone_axe: 'Steinaxt', stone_pickaxe: 'Steinspitzhacke', stone_spear: 'Steinspeer',
  improved_axe: 'Verbesserte Axt', improved_pickaxe: 'Verbesserte Spitzhacke',
  fishing_rod: 'Angelrute', torch: 'Fackel',
  iron_axe: 'Eisenaxt', iron_pickaxe: 'Eisenspitzhacke',
  // Consumables
  turtle_meat: 'Schildkrötenfleisch', turtle_shell: 'Schildkrötenpanzer', cooked_turtle: 'Gek. Schildkröte',
  crab_meat: 'Krabbenfleisch', cooked_crab: 'Gek. Krabbe',
  cooked_food: 'Gekochtes Essen', water_container: 'Wassercontainer',
  cooked_fish_meal: 'Gebratener Fisch', herbal_remedy: 'Kräutermittel',
  cooked_mushroom: 'Geb. Pilze', fish: 'Fisch',
  // Structures
  palm_tree: 'Palme', campfire: 'Lagerfeuer', palm_shelter: 'Palmendach',
  wooden_shelter: 'Holzunterkunft', workbench: 'Werkbank',
  log_cabin: 'Blockhütte', bed: 'Bett', farm_plot: 'Ackerbeet', furnace: 'Schmelzofen',
  storage_box: 'Lagerbox',
};

const PASSIVE_DESC: Record<string, string> = {
  // Tools
  flint_knife:      'Werkzeug – Fasern sammeln & bessere Erträge',
  stone_axe:        'Werkzeug – schnelleres Holzfällen',
  stone_pickaxe:    'Werkzeug – schnellerer Steinabbau',
  stone_spear:      'Waffe – Jagd und Verteidigung',
  improved_axe:     'Werkzeug – 4× Holz-Ertrag',
  improved_pickaxe: 'Werkzeug – 4× Stein-Ertrag',
  iron_axe:         'Werkzeug – 5× Holz-Ertrag',
  iron_pickaxe:     'Werkzeug – 5× Stein-Ertrag',
  fishing_rod:      'Werkzeug – Fischen an Gewässern',
  torch:            'Erhöht Sichtweite in der Nacht',
  storage_box:      'Struktur – lagert bis 150 kg; mit F öffnen',
  // Materials
  turtle_shell: 'Material – für späteres Crafting',
  wood: 'Material', stone: 'Material', sticks: 'Material', pebbles: 'Material',
  rope: 'Material', plank: 'Material', iron_ore: 'Erz',
  iron_bar: 'Material', flint: 'Material', driftwood: 'Material',
  shells: 'Material', palm_leaf: 'Material', herbs: 'Heilkraut – roh nutzbar',
  fiber: 'Material', vine: 'Material', mushroom: 'Nahrung – roh nutzbar',
};

export default function InventoryPanel() {
  const inventory      = usePlayerStore(s => s.player.inventory);
  const equipment      = usePlayerStore(s => s.player.equipment);
  const stats          = usePlayerStore(s => s.player.stats);
  const updateStats    = usePlayerStore(s => s.updateStats);
  const removeResource = usePlayerStore(s => s.removeResource);
  const equip          = usePlayerStore(s => s.equip);

  const currentWeight = calcWeight(inventory.items);
  const weightPct     = Math.min(100, (currentWeight / MAX_CARRY_KG) * 100);
  const weightFull    = currentWeight >= MAX_CARRY_KG * 0.95;
  const weightWarn    = currentWeight >= MAX_CARRY_KG * 0.80;

  function useItem(resourceId: string) {
    const def = USABLE[resourceId];
    if (!def) return;
    const newStats = def.effect(stats);
    updateStats(newStats);
    removeResource(resourceId, 1);
  }

  return (
    <div className="p-4">
      <h3 className="text-base font-bold text-white mb-2">Inventar</h3>

      {/* Weight bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className={weightWarn ? 'text-orange-400 font-semibold' : 'text-slate-400'}>
            Tragelast
          </span>
          <span className={weightFull ? 'text-red-400 font-bold' : weightWarn ? 'text-orange-400' : 'text-slate-500'}>
            {currentWeight.toFixed(1)} / {MAX_CARRY_KG} kg
            {weightFull && ' – Voll!'}
          </span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              weightFull ? 'bg-red-500' : weightWarn ? 'bg-orange-500' : 'bg-amber-500'
            }`}
            style={{ width: `${weightPct}%` }}
          />
        </div>
      </div>

      {inventory.items.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">Empty – press Space to gather</p>
      ) : (
        <div className="space-y-1.5">
          {inventory.items.map(item => {
            const usable = USABLE[item.resourceId];
            const passive = PASSIVE_DESC[item.resourceId];
            const name = ITEM_NAMES[item.resourceId] ?? item.resourceId.replace(/_/g, ' ');

            return (
              <div
                key={item.id}
                className="bg-slate-700 rounded-lg px-3 py-2 flex items-center gap-2"
              >
                {/* Icon placeholder */}
                <span className="text-lg w-6 text-center select-none">
                  {ITEM_ICON[item.resourceId] ?? '📦'}
                </span>

                {/* Name + description */}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium capitalize">{name}</div>
                  {usable && (
                    <div className="text-slate-400 text-xs">{usable.tooltip}</div>
                  )}
                  {passive && !usable && (
                    <div className="text-slate-500 text-xs">{passive}</div>
                  )}
                </div>

                {/* Quantity */}
                <span className="text-yellow-400 font-bold text-sm">×{item.quantity}</span>

                {/* Use button */}
                {usable && (
                  <button
                    onClick={() => useItem(item.resourceId)}
                    className={`px-2 py-1 text-xs font-bold rounded-lg text-white transition-colors ${usable.color}`}
                  >
                    {usable.label}
                  </button>
                )}

                {/* Equip button */}
                {(() => {
                  const slot = getDefaultSlot(item.resourceId, equipment);
                  if (!slot) return null;
                  const eq = equipment ?? { leftHand: null, rightHand: null, belt: [null, null, null] };
                  const isEquipped =
                    slot === 'leftHand'  ? eq.leftHand?.resourceId  === item.resourceId :
                    slot === 'rightHand' ? eq.rightHand?.resourceId === item.resourceId :
                    slot.startsWith('belt') ? eq.belt.some(b => b?.resourceId === item.resourceId) :
                    false;
                  if (isEquipped) return null;
                  return (
                    <button
                      onClick={() => equip(slot, item.resourceId)}
                      className="px-2 py-1 text-xs font-bold rounded-lg text-white bg-violet-700 hover:bg-violet-600 transition-colors"
                    >
                      Anlegen
                    </button>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-3 text-xs text-slate-600">
        {inventory.items.length}/{inventory.maxSlots} slots used
      </div>
    </div>
  );
}

const ITEM_ICON: Record<string, string> = {
  // Materialien
  wood:             '🪵',
  stone:            '🪨',
  sticks:           '🌿',
  pebbles:          '⚪',
  leaves:           '🍃',
  flint:            '🔺',
  driftwood:        '🪵',
  shells:           '🐚',
  palm_leaf:        '🌴',
  fiber:            '🧵',
  vine:             '🌱',
  rope:             '🪢',
  plank:            '🪵',
  iron_ore:         '🟤',
  iron_bar:         '🔩',
  tree_resin:       '🫙',
  coconut_shell:    '🥥',
  // Essen & Trinken
  food:             '🫐',
  water:            '💧',
  fish:             '🐟',
  mushroom:         '🍄',
  exotic_fruit:     '🍈',
  herbs:            '🌿',
  turtle_meat:      '🐢',
  turtle_shell:     '🐚',
  cooked_turtle:    '🍖',
  crab_meat:        '🦀',
  cooked_crab:      '🦀',
  cooked_food:      '🍖',
  cooked_fish_meal: '🍽️',
  cooked_mushroom:  '🥘',
  herbal_remedy:    '🩹',
  // Werkzeuge
  flint_knife:      '🔪',
  stone_axe:        '🪓',
  stone_pickaxe:    '⛏️',
  stone_spear:      '🗡️',
  improved_axe:     '🪓',
  improved_pickaxe: '⛏️',
  iron_axe:         '🪓',
  iron_pickaxe:     '⛏️',
  fishing_rod:      '🎣',
  torch:            '🔦',
  water_container:  '🪣',
  // Strukturen (im Inventar vor dem Platzieren)
  campfire:         '🔥',
  palm_shelter:     '⛺',
  wooden_shelter:   '🏠',
  workbench:        '🪚',
  log_cabin:        '🏡',
  bed:              '🛏️',
  storage_box:      '📦',
  farm_plot:        '🌾',
  furnace:          '🏭',
};
