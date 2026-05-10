import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';

const ITEM_NAMES: Record<string, string> = {
  wood: 'Holz', stone: 'Stein', food: 'Beeren', sticks: 'Äste',
  pebbles: 'Kieselsteine', flint: 'Feuerstein', driftwood: 'Treibholz',
  shells: 'Muscheln', palm_leaf: 'Palmenblatt', herbs: 'Kräuter',
  fiber: 'Fasern', mushroom: 'Pilze', exotic_fruit: 'Exotische Frucht',
  vine: 'Lianen', iron_ore: 'Eisenerz', spring: 'Quelle', palm_tree: 'Palme',
};

const ITEM_ICON: Record<string, string> = {
  wood: '🪵', stone: '🪨', food: '🫐', sticks: '🌿', pebbles: '⚪',
  flint: '🔶', driftwood: '🪵', shells: '🐚', palm_leaf: '🌴',
  herbs: '🌿', fiber: '🌾', mushroom: '🍄', exotic_fruit: '🍊',
  vine: '🌿', iron_ore: '🟤', spring: '💧', palm_tree: '🌴',
};

// Tools needed per resource — shown as hint when missing
const TOOL_REQUIRED: Record<string, string> = {
  wood:     'Axt',
  stone:    'Spitzhacke',
  iron_ore: 'Spitzhacke',
  fiber:    'Messer',
  vine:     'Messer',
};

function hasToolFor(type: string, inv: ReturnType<typeof usePlayerStore.getState>['player']['inventory'], eq: ReturnType<typeof usePlayerStore.getState>['player']['equipment']): boolean {
  const inHand = (id: string) => eq?.leftHand?.resourceId === id || eq?.rightHand?.resourceId === id;
  const anyAxe   = inHand('iron_axe')   || inHand('improved_axe')   || inHand('stone_axe');
  const anyPick  = inHand('iron_pickaxe') || inHand('improved_pickaxe') || inHand('stone_pickaxe');
  const anyKnife = inHand('flint_knife') || anyAxe;
  switch (type) {
    case 'wood':     return anyAxe;
    case 'stone':    return anyPick;
    case 'iron_ore': return anyPick;
    case 'fiber':    return anyKnife;
    case 'vine':     return anyKnife;
    default:         return true;
  }
}

export default function GatherMenu() {
  const gatherMenuOpen  = useGameStore(s => s.gatherMenuOpen);
  const nearbyResources = useGameStore(s => s.nearbyResources);
  const closeGatherMenu = useGameStore(s => s.closeGatherMenu);
  const setPendingGather = useGameStore(s => s.setPendingGather);
  const inventory  = usePlayerStore(s => s.player.inventory);
  const equipment  = usePlayerStore(s => s.player.equipment);

  if (!gatherMenuOpen || nearbyResources.length === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-72">
      <div className="bg-slate-900/95 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
          <span className="text-slate-300 text-xs font-semibold tracking-wider uppercase">In der Nähe</span>
          <button
            onClick={closeGatherMenu}
            className="text-slate-500 hover:text-slate-300 text-xs"
          >
            ✕ Esc
          </button>
        </div>

        <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
          {nearbyResources.map(res => {
            const name = ITEM_NAMES[res.type] ?? res.type;
            const icon = ITEM_ICON[res.type] ?? '📦';
            const canGather = hasToolFor(res.type, inventory, equipment);
            const toolHint = TOOL_REQUIRED[res.type];

            // Extra action: chop sticks from tree when axe is equipped
            const eq = equipment;
            const hasAxe = eq?.leftHand?.resourceId === 'stone_axe'   || eq?.rightHand?.resourceId === 'stone_axe'
                        || eq?.leftHand?.resourceId === 'improved_axe' || eq?.rightHand?.resourceId === 'improved_axe'
                        || eq?.leftHand?.resourceId === 'iron_axe'     || eq?.rightHand?.resourceId === 'iron_axe';
            const showSticksOption = res.type === 'wood' && hasAxe;

            return (
              <div
                key={res.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800"
              >
                <span className="text-lg w-7 text-center">{icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium">{name}</div>
                  {!canGather && toolHint && (
                    <div className="text-orange-400 text-xs">Benötigt {toolHint}</div>
                  )}
                </div>
                <span className="text-slate-400 text-xs">×{Math.min(res.quantity, 99)}</span>

                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => setPendingGather(res.id, null)}
                    disabled={!canGather}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                      canGather
                        ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {res.type === 'wood' ? 'Holz' : 'Sammeln'}
                  </button>
                  {showSticksOption && (
                    <button
                      onClick={() => setPendingGather(res.id, 'sticks')}
                      className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-800 hover:bg-amber-700 text-white transition-colors"
                    >
                      Äste 🌿
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
