import { useGameStore } from '../../store/gameStore';
import { useWorldStore } from '../../store/worldStore';
import { usePlayerStore } from '../../store/playerStore';
import { calcWeight, ITEM_WEIGHTS } from '../../data/weights';

const MAX_STORAGE_KG = 150;

const ITEM_NAMES: Record<string, string> = {
  wood: 'Holz', stone: 'Stein', food: 'Beeren', water: 'Wasser',
  sticks: 'Äste', pebbles: 'Kieselsteine',
  rope: 'Seil', plank: 'Holzbretter', iron_ore: 'Eisenerz', iron_bar: 'Eisenbarren',
  flint: 'Feuerstein', driftwood: 'Treibholz', shells: 'Muscheln',
  palm_leaf: 'Palmenblatt', herbs: 'Kräuter', fiber: 'Fasern',
  mushroom: 'Pilze', exotic_fruit: 'Exot. Frucht', vine: 'Lianen',
  flint_knife: 'Feuersteinmesser', stone_axe: 'Steinaxt', stone_pickaxe: 'Steinspitzhacke',
  stone_spear: 'Steinspeer', improved_axe: 'Verb. Axt', improved_pickaxe: 'Verb. Spitzhacke',
  fishing_rod: 'Angelrute', torch: 'Fackel',
  iron_axe: 'Eisenaxt', iron_pickaxe: 'Eisenspitzhacke',
  cooked_food: 'Gek. Essen', water_container: 'Wassercontainer',
  cooked_fish_meal: 'Geb. Fisch', herbal_remedy: 'Kräutermittel',
  cooked_mushroom: 'Geb. Pilze', fish: 'Fisch',
};

const ITEM_ICON: Record<string, string> = {
  wood: '🪵', stone: '🪨', food: '🫐', water: '💧', sticks: '🌿', pebbles: '⚪',
  rope: '🪢', plank: '🪵', iron_ore: '🟤', iron_bar: '🔩',
  flint: '🪨', driftwood: '🪵', shells: '🐚', palm_leaf: '🌿', herbs: '🌱',
  fiber: '🧵', mushroom: '🍄', exotic_fruit: '🍊', vine: '🌿',
  cooked_food: '🍖', water_container: '🪣', fish: '🐟', cooked_fish_meal: '🐟',
  stone_axe: '🪓', stone_pickaxe: '⛏️', improved_axe: '🪓', improved_pickaxe: '⛏️',
  iron_axe: '🪓', iron_pickaxe: '⛏️', fishing_rod: '🎣', torch: '🕯️',
};

function calcStorageWeight(items: { resourceId: string; quantity: number }[]) {
  return items.reduce((s, i) => s + (ITEM_WEIGHTS[i.resourceId] ?? 0.5) * i.quantity, 0);
}

export default function StorageBoxModal() {
  const storageBoxId  = useGameStore(s => s.storageBoxId);
  const closeStorageBox = useGameStore(s => s.closeStorageBox);
  const world         = useWorldStore(s => s.world);
  const updateStorage = useWorldStore(s => s.updateStructureStorage);
  const inventory     = usePlayerStore(s => s.player.inventory);
  const addToInventory   = usePlayerStore(s => s.addToInventory);
  const removeResource   = usePlayerStore(s => s.removeResource);

  if (!storageBoxId || !world) return null;

  const box = world.structures.find(s => s.id === storageBoxId);
  if (!box) return null;

  const boxItems: { resourceId: string; quantity: number }[] = box.storage ?? [];
  const boxWeight    = calcStorageWeight(boxItems);
  const boxWeightPct = Math.min(100, (boxWeight / MAX_STORAGE_KG) * 100);
  const playerWeight = calcWeight(inventory.items);

  function deposit(resourceId: string) {
    const playerItem = inventory.items.find(i => i.resourceId === resourceId);
    if (!playerItem || playerItem.quantity <= 0) return;

    const itemWeight = ITEM_WEIGHTS[resourceId] ?? 0.5;
    if (boxWeight + itemWeight > MAX_STORAGE_KG) return;

    removeResource(resourceId, 1);
    const newItems = [...boxItems];
    const existing = newItems.find(i => i.resourceId === resourceId);
    if (existing) existing.quantity += 1;
    else newItems.push({ resourceId, quantity: 1 });
    updateStorage(storageBoxId!, newItems);
  }

  function withdraw(resourceId: string) {
    const boxItem = boxItems.find(i => i.resourceId === resourceId);
    if (!boxItem || boxItem.quantity <= 0) return;

    if (addToInventory(resourceId, 1)) {
      const newItems = boxItems
        .map(i => i.resourceId === resourceId ? { ...i, quantity: i.quantity - 1 } : i)
        .filter(i => i.quantity > 0);
      updateStorage(storageBoxId!, newItems);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) closeStorageBox(); }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl flex flex-col"
           style={{ width: 'min(760px, 95vw)', height: 'min(520px, 88vh)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">📦 Lagerbox</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {boxWeight.toFixed(1)} / {MAX_STORAGE_KG} kg belegt
            </p>
          </div>
          <button onClick={closeStorageBox}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors text-lg">
            ✕
          </button>
        </div>

        {/* Weight bar */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-700 flex-shrink-0">
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                boxWeightPct > 95 ? 'bg-red-500' : boxWeightPct > 80 ? 'bg-orange-500' : 'bg-amber-500'
              }`}
              style={{ width: `${boxWeightPct}%` }}
            />
          </div>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-1 overflow-hidden">

          {/* Box contents */}
          <div className="flex-1 flex flex-col border-r border-slate-700 overflow-hidden">
            <div className="px-4 py-2 bg-slate-900/40 text-xs text-slate-400 font-semibold flex-shrink-0">
              IN DER BOX
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {boxItems.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Leer</p>
              ) : (
                boxItems.map(item => (
                  <div key={item.resourceId} className="bg-slate-700 rounded-lg px-3 py-2 flex items-center gap-2">
                    <span className="text-lg w-6 text-center">{ITEM_ICON[item.resourceId] ?? '📦'}</span>
                    <span className="flex-1 text-white text-sm">{ITEM_NAMES[item.resourceId] ?? item.resourceId}</span>
                    <span className="text-yellow-400 font-bold text-sm">×{item.quantity}</span>
                    <button
                      onClick={() => withdraw(item.resourceId)}
                      className="px-2 py-1 text-xs font-bold rounded-lg text-white bg-sky-700 hover:bg-sky-600 transition-colors"
                    >
                      Nehmen
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Player inventory */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-slate-900/40 text-xs text-slate-400 font-semibold flex-shrink-0">
              INVENTAR ({playerWeight.toFixed(1)} kg)
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {inventory.items.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">Leer</p>
              ) : (
                inventory.items.map(item => {
                  const full = boxWeight + (ITEM_WEIGHTS[item.resourceId] ?? 0.5) > MAX_STORAGE_KG;
                  return (
                    <div key={item.id} className="bg-slate-700 rounded-lg px-3 py-2 flex items-center gap-2">
                      <span className="text-lg w-6 text-center">{ITEM_ICON[item.resourceId] ?? '📦'}</span>
                      <span className="flex-1 text-white text-sm">{ITEM_NAMES[item.resourceId] ?? item.resourceId}</span>
                      <span className="text-yellow-400 font-bold text-sm">×{item.quantity}</span>
                      <button
                        onClick={() => deposit(item.resourceId)}
                        disabled={full}
                        className={`px-2 py-1 text-xs font-bold rounded-lg text-white transition-colors ${
                          full ? 'bg-slate-600 cursor-not-allowed text-slate-400' : 'bg-amber-700 hover:bg-amber-600'
                        }`}
                      >
                        {full ? 'Voll' : 'Einlagern'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-slate-700 flex-shrink-0 text-xs text-slate-500">
          F / Klick außen → schließen
        </div>
      </div>
    </div>
  );
}
