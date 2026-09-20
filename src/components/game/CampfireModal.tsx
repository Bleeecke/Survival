import { useGameStore } from '../../store/gameStore';
import { useWorldStore } from '../../store/worldStore';
import { usePlayerStore } from '../../store/playerStore';
import CraftingPanel from './CraftingPanel';

export default function CampfireModal() {
  const id = useGameStore(s => s.campfireModalId);
  const close = useGameStore(s => s.closeCampfireModal);
  const world = useWorldStore(s => s.world);
  const inventory = usePlayerStore(s => s.player.inventory);
  const fire = world?.structures.find(s => s.id === id);
  if (!fire) return null;
  function addFuel(resourceId: string, amount: number) {
    const current = useWorldStore.getState().world?.structures.find(s => s.id === id);
    if (!current || !usePlayerStore.getState().exchangeItems([{ resourceId, quantity: 1 }], [])) return;
    useWorldStore.getState().updateStructure(current.id, { fuel: (current.fuel ?? 0) + amount });
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <section role="dialog" aria-modal="true" aria-label="Lagerfeuer" className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-xl bg-slate-900 p-5">
      <div className="mb-3 flex justify-between text-white"><h2>Lagerfeuer</h2><button onClick={close}>Schliessen</button></div>
      <p className="mb-2 text-sm text-amber-200">Brennstoff: {(fire.fuel ?? 0).toFixed(1)}</p>
      <div className="mb-4 flex gap-2">
        {([{ id: 'sticks', label: 'Ast', amount: 1 }, { id: 'driftwood', label: 'Treibholz', amount: 2 }, { id: 'wood', label: 'Holz', amount: 3 }]).map(f => <button key={f.id} onClick={() => addFuel(f.id, f.amount)} disabled={!inventory.items.some(i => i.resourceId === f.id && i.quantity > 0)} className="rounded bg-amber-800 px-2 py-1 text-xs text-white disabled:opacity-40">+ {f.label}</button>)}
      </div>
      <CraftingPanel mode="fire" />
    </section>
  </div>;
}
