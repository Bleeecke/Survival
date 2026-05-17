import { useGameStore } from '../../store/gameStore';
import { useWorldStore } from '../../store/worldStore';
import { usePlayerStore } from '../../store/playerStore';

const ITEM_NAMES: Record<string, string> = {
  wood: 'Holz', stone: 'Stein', food: 'Beeren', sticks: 'Äste',
  pebbles: 'Bruchstein', flint: 'Feuerstein', driftwood: 'Treibholz',
  shells: 'Muscheln', palm_leaf: 'Palmenblatt', herbs: 'Kräuter',
  fiber: 'Fasern', mushroom: 'Pilze', exotic_fruit: 'Exotische Frucht',
  vine: 'Lianen', iron_ore: 'Eisenerz', berry_bush: 'Beeren',
  coconut: 'Kokosnuss', coconut_shell: 'Kokosschale', tree_resin: 'Baumharz',
  turtle_meat: 'Schildkrötenfleisch', turtle_shell: 'Schildkrötenpanzer',
  crab_meat: 'Krabbenfleisch', cooked_turtle: 'Gek. Schildkröte',
  cooked_crab: 'Gek. Krabbe', fish: 'Fisch',
};

const ITEM_ICON: Record<string, string> = {
  wood: '🪵', stone: '🪨', food: '🫐', sticks: '🌿', pebbles: '⚪',
  flint: '🔶', driftwood: '🪵', shells: '🐚', palm_leaf: '🌴',
  herbs: '🌿', fiber: '🌾', mushroom: '🍄', exotic_fruit: '🍊',
  vine: '🌿', iron_ore: '🟤', berry_bush: '🫐', coconut: '🥥',
  coconut_shell: '🥥', tree_resin: '🟡', turtle_meat: '🍖',
  turtle_shell: '🛡️', crab_meat: '🦀', cooked_turtle: '🍖',
  cooked_crab: '🦀', fish: '🐟',
};

export default function PickupMenu() {
  const pickupMenuOpen  = useGameStore(s => s.pickupMenuOpen);
  const nearbyDrops     = useGameStore(s => s.nearbyDrops);
  const closePickupMenu = useGameStore(s => s.closePickupMenu);
  const pickupDroppedItem = useWorldStore(s => s.pickupDroppedItem);
  const addToInventory  = usePlayerStore(s => s.addToInventory);

  if (!pickupMenuOpen || nearbyDrops.length === 0) return null;

  function handlePickup(id: string) {
    const item = pickupDroppedItem(id);
    if (item) {
      addToInventory(item.resourceId, item.quantity);
      // Close menu if no more drops nearby
      const remaining = nearbyDrops.filter(d => d.id !== id);
      if (remaining.length === 0) closePickupMenu();
      else useGameStore.setState({ nearbyDrops: remaining });
    }
  }

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-72">
      <div className="bg-slate-900/95 border border-amber-700/50 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <span className="text-amber-300 text-xs font-semibold tracking-wider uppercase">
            📦 Abgelegte Gegenstände
          </span>
          <button
            onClick={closePickupMenu}
            className="text-slate-500 hover:text-slate-300 text-xs"
          >
            ✕ Esc
          </button>
        </div>

        <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
          {nearbyDrops.map(drop => {
            const name = ITEM_NAMES[drop.resourceId] ?? drop.resourceId;
            const icon = ITEM_ICON[drop.resourceId] ?? '📦';

            return (
              <div
                key={drop.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800"
              >
                <span className="text-lg w-7 text-center">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{name}</div>
                </div>
                <span className="text-slate-400 text-xs">×{drop.quantity}</span>
                <button
                  onClick={() => handlePickup(drop.id)}
                  className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-700 hover:bg-amber-600 text-white transition-colors"
                >
                  Aufheben
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
