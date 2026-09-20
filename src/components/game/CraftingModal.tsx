import { useEffect } from 'react';
import CraftingPanel from './CraftingPanel';

export default function CraftingModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="workplace-crafting-title" className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-xl border border-slate-600 bg-slate-900 p-5 shadow-2xl">
      <div className="mb-2 flex items-center justify-between text-white"><h2 id="workplace-crafting-title" className="text-lg font-bold">Arbeitsplatz · Herstellen</h2><button autoFocus className="rounded bg-slate-700 px-3 py-1 hover:bg-slate-600" onClick={onClose}>Schließen</button></div>
      <p className="mb-4 text-sm text-slate-400">Wähle ein bekanntes Rezept. Materialien, Werkzeuge und Fortschritt findest du direkt beim Auftrag.</p>
      <CraftingPanel />
    </section>
  </div>;
}
