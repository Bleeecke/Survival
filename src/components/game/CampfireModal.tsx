import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';

// 1 Spielminute = DAY_DURATION_MS / (24*60) ≈ 416ms Spielzeit
const COOKABLE: Record<string, { output: string; label: string; time: number }> = {
  mushroom:  { output: 'cooked_mushroom',  label: 'Pilze',     time: 8_333  }, // 20 Spielminuten
  fish:      { output: 'cooked_fish_meal', label: 'Fisch',     time: 16_667 }, // 40 Spielminuten
  crab_meat:   { output: 'cooked_crab',    label: 'Krabbe',      time: 12_500 }, // 30 Spielminuten
  turtle_meat: { output: 'cooked_turtle', label: 'Schildkröte', time: 20_833 }, // 50 Spielminuten
};

export default function CampfireModal() {
  const campfireId    = useGameStore(s => s.campfireModalId);
  const closeModal    = useGameStore(s => s.closeCampfireModal);
  const tickTime      = useGameStore(s => s.tickTime);
  const world         = useWorldStore(s => s.world);
  const updateStructure = useWorldStore(s => s.updateStructure);
  const { addToInventory, removeResource } = usePlayerStore.getState();
  const inventory     = usePlayerStore(s => s.player.inventory.items);

  const campfire = world?.structures.find(s => s.id === campfireId);
  const fuel = campfire?.fuel ?? 0;

  // Cooking state
  const [cookSlot, setCookSlot] = useState<string | null>(null);   // resourceId in slot
  const [cooking, setCooking]   = useState(false);
  const [progress, setProgress] = useState(0);                     // 0–1
  const [done, setDone]         = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sticks    = inventory.find(i => i.resourceId === 'sticks')?.quantity    ?? 0;
  const driftwood = inventory.find(i => i.resourceId === 'driftwood')?.quantity ?? 0;
  const wood      = inventory.find(i => i.resourceId === 'wood')?.quantity      ?? 0;
  const cookDef = cookSlot ? COOKABLE[cookSlot] : null;

  // Flame flicker animation
  const [flicker, setFlicker] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFlicker(Math.random()), 120);
    return () => clearInterval(id);
  }, []);

  function handleAddFuel(type: 'sticks' | 'driftwood' | 'wood') {
    if (!campfire) return;
    const fuelAdded = type === 'sticks' ? 1 : type === 'driftwood' ? 2 : 3;
    removeResource(type, 1);
    updateStructure(campfire.id, { fuel: fuel + fuelAdded });
  }

  function handlePlaceCookable(resourceId: string) {
    if (cooking || done) return;
    if (!COOKABLE[resourceId]) return;
    const qty = usePlayerStore.getState().player.inventory.items.find(i => i.resourceId === resourceId)?.quantity ?? 0;
    if (qty < 1) return;
    removeResource(resourceId, 1);
    setCookSlot(resourceId);
    setProgress(0);
    setDone(false);
  }

  function handleStartCooking() {
    if (!cookSlot || !cookDef || cooking || done || fuel < 1) return;
    setCooking(true);
    const steps = 40;
    const stepTime = cookDef.time / steps;
    let step = 0;
    intervalRef.current = setInterval(() => {
      step++;
      setProgress(step / steps);
      tickTime(stepTime);
      if (step >= steps) {
        clearInterval(intervalRef.current!);
        setCooking(false);
        setDone(true);
      }
    }, 80); // real-time: fast animation, game-time advances
  }

  function handleCollect() {
    if (!cookDef || !done) return;
    addToInventory(cookDef.output, 1);
    setCookSlot(null);
    setProgress(0);
    setDone(false);
  }

  function handleRemoveCookable() {
    if (cooking || !cookSlot) return;
    addToInventory(cookSlot, 1);
    setCookSlot(null);
    setProgress(0);
  }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  if (!campfire) return null;

  const cookableInInventory = Object.keys(COOKABLE).filter(
    id => (inventory.find(i => i.resourceId === id)?.quantity ?? 0) > 0
  );

  const flameH = 18 + flicker * 8;
  const flameH2 = 14 + (1 - flicker) * 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(2px)' }}
         onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>

      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-[480px] overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <h2 className="text-lg font-bold text-white">🔥 Lagerfeuer</h2>
          <button onClick={closeModal} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-5 flex gap-5">

          {/* Left: Fire visual + fuel */}
          <div className="flex flex-col items-center gap-3 w-40">

            {/* Animated fire */}
            <div className="relative w-24 h-24 flex items-end justify-center">
              {fuel > 0 ? (
                <>
                  {/* Flame layers */}
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2"
                       style={{ width: 22, height: flameH, background: 'radial-gradient(ellipse at 50% 100%, #ff6600, #ff3300 60%, transparent)', borderRadius: '50% 50% 40% 40%', transition: 'height 0.1s' }} />
                  <div className="absolute bottom-5 left-1/2 -translate-x-[40%]"
                       style={{ width: 16, height: flameH2, background: 'radial-gradient(ellipse at 50% 100%, #ffaa00, #ff6600 60%, transparent)', borderRadius: '50% 50% 40% 40%', transition: 'height 0.12s' }} />
                  <div className="absolute bottom-6 left-1/2 -translate-x-[60%]"
                       style={{ width: 12, height: flameH2 * 0.8, background: 'radial-gradient(ellipse at 50% 100%, #ffdd44, #ffaa00 60%, transparent)', borderRadius: '50% 50% 40% 40%', transition: 'height 0.09s' }} />
                </>
              ) : (
                // Embers only
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: `rgba(200,50,0,${0.4 + flicker * 0.4})` }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: `rgba(180,40,0,${0.3 + (1-flicker) * 0.4})` }} />
                </div>
              )}
              {/* Logs + stones */}
              <div className="absolute bottom-2 w-16 h-3 bg-amber-900 rounded" style={{ opacity: 0.9 }} />
              <div className="absolute bottom-1 left-3 w-4 h-4 bg-slate-500 rounded-full" />
              <div className="absolute bottom-1 right-3 w-4 h-4 bg-slate-500 rounded-full" />
            </div>

            {/* Fuel display */}
            <div className="text-center">
              <div className="text-slate-400 text-xs mb-1">Brenndauer</div>
              <div className="flex gap-1 justify-center mb-2">
                {Array.from({ length: Math.max(5, fuel) }).map((_, i) => (
                  <div key={i} className={`w-3 h-3 rounded-sm ${i < fuel ? 'bg-orange-500' : 'bg-slate-700'}`} />
                ))}
              </div>
              <div className="text-slate-300 text-xs">{fuel} {fuel === 1 ? 'Tag' : 'Tage'}</div>
            </div>

            {/* Add fuel buttons */}
            <div className="flex flex-col gap-1 w-full">
              <button onClick={() => handleAddFuel('sticks')} disabled={sticks < 1}
                className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${sticks > 0 ? 'bg-amber-700 hover:bg-amber-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                🪵 Ast +1 {sticks > 0 && <span className="text-amber-300">({sticks})</span>}
              </button>
              <button onClick={() => handleAddFuel('driftwood')} disabled={driftwood < 1}
                className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${driftwood > 0 ? 'bg-stone-600 hover:bg-stone-500 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                🪵 Treibholz +2 {driftwood > 0 && <span className="text-stone-300">({driftwood})</span>}
              </button>
              <button onClick={() => handleAddFuel('wood')} disabled={wood < 1}
                className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${wood > 0 ? 'bg-amber-900 hover:bg-amber-800 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                🪵 Holz +3 {wood > 0 && <span className="text-amber-200">({wood})</span>}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-slate-700" />

          {/* Right: Cooking */}
          <div className="flex-1 flex flex-col gap-3">
            <div className="text-slate-400 text-xs uppercase tracking-widest">Kochen</div>

            {fuel < 1 && (
              <div className="text-orange-400 text-xs bg-orange-950 rounded-lg px-3 py-2">
                Kein Brennstoff — lege Äste, Treibholz oder Holz nach
              </div>
            )}

            {/* Cook slot */}
            <div className="flex items-center gap-3">
              {/* Slot */}
              <div
                onClick={done ? handleCollect : (!cookSlot && !cooking ? undefined : handleRemoveCookable)}
                className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl cursor-pointer transition-colors ${
                  done          ? 'border-green-500 bg-green-900 animate-pulse'
                  : cookSlot    ? 'border-amber-500 bg-slate-700 hover:bg-slate-600'
                  : 'border-slate-600 bg-slate-900'
                }`}
              >
                {done
                  ? ({ cooked_food: '🍖', cooked_mushroom: '🥘', cooked_fish_meal: '🍽️', cooked_crab: '🦀', cooked_turtle: '🐢' } as Record<string,string>)[cookDef!.output] ?? '✅'
                  : cookSlot
                    ? ({ food: '🍓', mushroom: '🍄', fish: '🐟', crab_meat: '🦀', turtle_meat: '🐢' } as Record<string,string>)[cookSlot] ?? '🥘'
                    : <span className="text-slate-600 text-sm">leer</span>
                }
              </div>

              <div className="flex-1">
                {/* Progress bar */}
                {(cooking || done) && (
                  <div className="mb-2">
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all duration-75 rounded-full"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {done ? '✅ Fertig! Klicken zum Einsammeln' : `Kocht… ${Math.round(progress * 100)}%`}
                    </div>
                  </div>
                )}

                {/* Cook button */}
                {cookSlot && !cooking && !done && (
                  <button
                    onClick={handleStartCooking}
                    disabled={fuel < 1}
                    className={`w-full py-2 rounded-lg text-sm font-bold transition-colors ${
                      fuel > 0
                        ? 'bg-orange-700 hover:bg-orange-600 text-white'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    🔥 Kochen starten
                  </button>
                )}

                {!cookSlot && !cooking && (
                  <div className="text-slate-500 text-xs">Wähle unten ein Lebensmittel aus</div>
                )}
              </div>
            </div>

            {/* Cookable items from inventory */}
            {cookableInInventory.length > 0 && !cookSlot && !cooking && (
              <div>
                <div className="text-slate-500 text-xs mb-2">Im Inventar:</div>
                <div className="flex gap-2">
                  {cookableInInventory.map(id => {
                    const qty = inventory.find(i => i.resourceId === id)?.quantity ?? 0;
                    const icons: Record<string, string> = { food: '🍓', mushroom: '🍄', fish: '🐟' };
                    return (
                      <button
                        key={id}
                        onClick={() => handlePlaceCookable(id)}
                        className="flex flex-col items-center px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs transition-colors"
                      >
                        <span className="text-xl">{icons[id] ?? '🥘'}</span>
                        <span className="text-slate-300 mt-0.5">{COOKABLE[id].label}</span>
                        <span className="text-slate-500">×{qty}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {cookableInInventory.length === 0 && !cookSlot && (
              <div className="text-slate-600 text-xs">Kein kochbares Essen im Inventar</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
