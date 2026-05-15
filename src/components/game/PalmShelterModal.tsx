import { useGameStore } from '../../store/gameStore';
import { useWorldStore } from '../../store/worldStore';
import { usePlayerStore } from '../../store/playerStore';

const MAX_SLOTS   = 4;
const MAX_STACK   = 10;

// Only small/light items allowed — no wood, stone, tools, heavy gear
const ALLOWED_ITEMS = new Set([
  'food', 'sticks', 'pebbles', 'vine', 'palm_leaf', 'herbs',
  'mushroom', 'shells', 'fiber', 'exotic_fruit', 'flint',
  'fish', 'cooked_food', 'cooked_mushroom', 'cooked_fish_meal',
  'herbal_remedy', 'tree_resin', 'coconut_shell', 'water',
]);

const ITEM_NAMES: Record<string, string> = {
  food: 'Beeren', sticks: 'Äste', pebbles: 'Kieselsteine', vine: 'Lianen',
  palm_leaf: 'Palmenblatt', herbs: 'Kräuter', mushroom: 'Pilze', shells: 'Muscheln',
  fiber: 'Fasern', exotic_fruit: 'Exot. Frucht', flint: 'Feuerstein',
  fish: 'Fisch', cooked_food: 'Gek. Essen', cooked_mushroom: 'Geb. Pilze',
  cooked_fish_meal: 'Geb. Fisch', herbal_remedy: 'Kräutermittel',
  tree_resin: 'Harz', coconut_shell: 'Kokosschale', water: 'Wasser',
};

const ITEM_ICON: Record<string, string> = {
  food: '🫐', sticks: '🌿', pebbles: '⚪', vine: '🌱', palm_leaf: '🌴',
  herbs: '🌿', mushroom: '🍄', shells: '🐚', fiber: '🧵', exotic_fruit: '🍈',
  flint: '🔺', fish: '🐟', cooked_food: '🍖', cooked_mushroom: '🥘',
  cooked_fish_meal: '🍽️', herbal_remedy: '🩹', tree_resin: '🫙',
  coconut_shell: '🥥', water: '💧',
};

export default function PalmShelterModal() {
  const modalId   = useGameStore(s => s.palmShelterModalId);
  const closeModal = useGameStore(s => s.closePalmShelterModal);
  const world      = useWorldStore(s => s.world);
  const updateStorage = useWorldStore(s => s.updateStructureStorage);
  const inventory  = usePlayerStore(s => s.player.inventory);
  const addToInventory  = usePlayerStore(s => s.addToInventory);
  const removeResource  = usePlayerStore(s => s.removeResource);

  if (!modalId || !world) return null;
  const shelter = world.structures.find(s => s.id === modalId);
  if (!shelter) return null;

  const stored: { resourceId: string; quantity: number }[] = shelter.storage ?? [];

  // Items in inventory that are allowed
  const depositable = inventory.items.filter(
    i => ALLOWED_ITEMS.has(i.resourceId) && i.quantity > 0
  );

  function deposit(resourceId: string) {
    const playerQty = inventory.items.find(i => i.resourceId === resourceId)?.quantity ?? 0;
    if (playerQty <= 0) return;

    const existing = stored.find(s => s.resourceId === resourceId);
    const currentQty = existing?.quantity ?? 0;
    if (currentQty >= MAX_STACK) return; // stack full
    if (stored.length >= MAX_SLOTS && !existing) return; // no free slot

    const transfer = Math.min(1, MAX_STACK - currentQty);
    removeResource(resourceId, transfer);
    const next = stored.map(s => s.resourceId === resourceId
      ? { ...s, quantity: s.quantity + transfer }
      : s
    );
    if (!existing) next.push({ resourceId, quantity: transfer });
    updateStorage(shelter!.id, next);
  }

  function withdraw(resourceId: string) {
    const slot = stored.find(s => s.resourceId === resourceId);
    if (!slot || slot.quantity <= 0) return;
    if (!addToInventory(resourceId, 1)) return;
    const next = stored
      .map(s => s.resourceId === resourceId ? { ...s, quantity: s.quantity - 1 } : s)
      .filter(s => s.quantity > 0);
    updateStorage(shelter!.id, next);
  }

  // Build slot array — always 4 slots
  const slots: ({ resourceId: string; quantity: number } | null)[] = [
    ...stored,
    ...Array(Math.max(0, MAX_SLOTS - stored.length)).fill(null),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-[420px] overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⛺</span>
            <div>
              <h2 className="text-white font-bold">Palmendach – Lager</h2>
              <p className="text-slate-500 text-xs">{stored.length}/{MAX_SLOTS} Plätze · max. {MAX_STACK} pro Stapel · nur kleine Gegenstände</p>
            </div>
          </div>
          <button onClick={closeModal} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-5 space-y-5">

          {/* Storage slots */}
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-widest mb-3">Gelagert</div>
            <div className="grid grid-cols-4 gap-3">
              {slots.map((slot, i) => (
                <div key={i}>
                  {slot ? (
                    <button
                      onClick={() => withdraw(slot.resourceId)}
                      title={`${ITEM_NAMES[slot.resourceId] ?? slot.resourceId} – klicken zum Entnehmen`}
                      className="w-full aspect-square rounded-xl bg-slate-700 hover:bg-slate-600 border border-slate-500 hover:border-amber-500 flex flex-col items-center justify-center gap-1 transition-colors"
                    >
                      <span className="text-2xl">{ITEM_ICON[slot.resourceId] ?? '📦'}</span>
                      <span className="text-yellow-400 font-bold text-xs">×{slot.quantity}</span>
                      <span className="text-slate-400 text-xs leading-none truncate w-full text-center px-1">
                        {ITEM_NAMES[slot.resourceId] ?? slot.resourceId}
                      </span>
                      <div className="w-3/4 h-1 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${(slot.quantity / MAX_STACK) * 100}%` }}
                        />
                      </div>
                    </button>
                  ) : (
                    <div className="w-full aspect-square rounded-xl bg-slate-900 border border-dashed border-slate-700 flex items-center justify-center">
                      <span className="text-slate-700 text-xl">+</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-700" />

          {/* Inventory — depositable items */}
          <div>
            <div className="text-slate-400 text-xs uppercase tracking-widest mb-3">Inventar (einlagern)</div>
            {depositable.length === 0 ? (
              <p className="text-slate-600 text-sm text-center py-2">Keine passenden Gegenstände im Inventar</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {depositable.map(item => {
                  const existing = stored.find(s => s.resourceId === item.resourceId);
                  const storedQty = existing?.quantity ?? 0;
                  const slotFull  = storedQty >= MAX_STACK;
                  const noSlot    = stored.length >= MAX_SLOTS && !existing;
                  const disabled  = slotFull || noSlot;
                  return (
                    <button
                      key={item.resourceId}
                      onClick={() => !disabled && deposit(item.resourceId)}
                      disabled={disabled}
                      title={slotFull ? 'Stapel voll' : noSlot ? 'Kein freier Platz' : 'Einlagern'}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border transition-colors ${
                        disabled
                          ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                          : 'bg-slate-700 hover:bg-slate-600 border-slate-500 hover:border-green-500 text-white'
                      }`}
                    >
                      <span className="text-lg">{ITEM_ICON[item.resourceId] ?? '📦'}</span>
                      <span>{ITEM_NAMES[item.resourceId] ?? item.resourceId}</span>
                      <span className="text-yellow-400 font-bold">×{item.quantity}</span>
                      {storedQty > 0 && (
                        <span className="text-slate-500">({storedQty}/{MAX_STACK})</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
