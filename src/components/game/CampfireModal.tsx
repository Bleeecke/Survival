import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { craftingSystem } from '../../services/game/CraftingSystem';
import { RECIPES } from '../../data/recipes';
import { useJournalStore } from '../../store/journalStore';

// 1 Spielminute = DAY_DURATION_MS / (24*60) ≈ 416ms Spielzeit
const COOKABLE: Record<string, { output: string; label: string; time: number; icon: string }> = {
  food:        { output: 'cooked_food',      label: 'Beeren/Essen', time: 8_333,  icon: '🍓' },
  mushroom:    { output: 'cooked_mushroom',  label: 'Pilze',        time: 8_333,  icon: '🍄' },
  fish:        { output: 'cooked_fish_meal', label: 'Fisch',        time: 16_667, icon: '🐟' },
  crab_meat:   { output: 'cooked_crab',      label: 'Krabbe',       time: 12_500, icon: '🦀' },
  turtle_meat: { output: 'cooked_turtle',    label: 'Schildkröte',  time: 20_833, icon: '🐢' },
  boar_meat:   { output: 'cooked_boar',      label: 'Wildschwein',  time: 16_667, icon: '🐗' },
};

// Campfire craft recipes (non-food)
const FIRE_CRAFT_IDS = ['harden_stick', 'fever_tea'];

type Tab = 'cook' | 'craft';

export default function CampfireModal() {
  const campfireId      = useGameStore(s => s.campfireModalId);
  const closeModal      = useGameStore(s => s.closeCampfireModal);
  const tickTime        = useGameStore(s => s.tickTime);
  const world           = useWorldStore(s => s.world);
  const updateStructure = useWorldStore(s => s.updateStructure);
  const inventory       = usePlayerStore(s => s.player.inventory.items);
  const knowledge       = usePlayerStore(s => s.knowledge);

  const campfire = world?.structures.find(s => s.id === campfireId);
  const fuel     = campfire?.fuel ?? 0;

  const [tab, setTab]         = useState<Tab>('cook');

  // Cook state
  const [cookSlot, setCookSlot]   = useState<string | null>(null);
  const [cooking, setCooking]     = useState(false);
  const [cookProgress, setCookProgress] = useState(0);
  const [cookDone, setCookDone]   = useState(false);
  const cookInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fire-craft state
  const [craftingId, setCraftingId]     = useState<string | null>(null);
  const [craftProgress, setCraftProgress] = useState(0);
  const [craftDone, setCraftDone]       = useState<string | null>(null); // recipeId of done item
  const craftInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Flame flicker
  const [flicker, setFlicker] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFlicker(Math.random()), 120);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => {
    if (cookInterval.current)  clearInterval(cookInterval.current);
    if (craftInterval.current) clearInterval(craftInterval.current);
  }, []);

  const sticks    = inventory.find(i => i.resourceId === 'sticks')?.quantity    ?? 0;
  const driftwood = inventory.find(i => i.resourceId === 'driftwood')?.quantity ?? 0;
  const wood      = inventory.find(i => i.resourceId === 'wood')?.quantity      ?? 0;
  const cookDef   = cookSlot ? COOKABLE[cookSlot] : null;

  const { addToInventory, removeResource } = usePlayerStore.getState();

  function handleAddFuel(type: 'sticks' | 'driftwood' | 'wood') {
    if (!campfire) return;
    const added = type === 'sticks' ? 1 : type === 'driftwood' ? 2 : 3;
    removeResource(type, 1);
    updateStructure(campfire.id, { fuel: fuel + added });
  }

  // ── Cooking ──────────────────────────────────────────────────────
  function handlePlaceCookable(resourceId: string) {
    if (cooking || cookDone) return;
    const qty = usePlayerStore.getState().player.inventory.items.find(i => i.resourceId === resourceId)?.quantity ?? 0;
    if (qty < 1) return;
    usePlayerStore.getState().removeResource(resourceId, 1);
    setCookSlot(resourceId);
    setCookProgress(0);
    setCookDone(false);
  }

  function handleStartCooking() {
    if (!cookSlot || !cookDef || cooking || cookDone || fuel < 1) return;
    setCooking(true);
    const steps = 40;
    const stepTime = cookDef.time / steps;
    let step = 0;
    cookInterval.current = setInterval(() => {
      step++;
      setCookProgress(step / steps);
      tickTime(stepTime);
      if (step >= steps) {
        clearInterval(cookInterval.current!);
        setCooking(false);
        setCookDone(true);
      }
    }, 80);
  }

  function handleCollectCooked() {
    if (!cookDef || !cookDone) return;
    usePlayerStore.getState().addToInventory(cookDef.output, 1);
    useJournalStore.getState().triggerJournalEvent('first_cook');
    setCookSlot(null);
    setCookProgress(0);
    setCookDone(false);
  }

  function handleRemoveCookable() {
    if (cooking || !cookSlot) return;
    usePlayerStore.getState().addToInventory(cookSlot, 1);
    setCookSlot(null);
    setCookProgress(0);
  }

  // ── Fire Crafting ─────────────────────────────────────────────────
  const fireCraftRecipes = FIRE_CRAFT_IDS
    .map(id => RECIPES.find(r => r.id === id))
    .filter(Boolean) as typeof RECIPES;

  function canFireCraft(recipe: typeof RECIPES[0]) {
    if (fuel < 1) return false;
    if (!craftingSystem.hasRequiredKnowledge(recipe)) return false;
    return craftingSystem.canCraft(recipe.id, usePlayerStore.getState().player.inventory);
  }

  function startFireCraft(recipe: typeof RECIPES[0]) {
    if (craftingId || !canFireCraft(recipe)) return;
    // consume inputs
    if (!useGameStore.getState().freeCraft) {
      for (const input of recipe.inputs) {
        usePlayerStore.getState().removeResource(input.resourceId, input.quantity);
      }
    }
    setCraftingId(recipe.id);
    setCraftProgress(0);
    setCraftDone(null);
    const steps = 40;
    const stepTime = recipe.craftingTime / steps;
    let step = 0;
    craftInterval.current = setInterval(() => {
      step++;
      setCraftProgress(step / steps);
      tickTime(stepTime / steps);
      if (step >= steps) {
        clearInterval(craftInterval.current!);
        setCraftingId(null);
        setCraftDone(recipe.id);
        craftingSystem.awardSkillXp(recipe);
        craftingSystem.grantKnowledge(recipe);
      }
    }, 80);
  }

  function collectFireCraft(recipe: typeof RECIPES[0]) {
    for (const output of recipe.outputs) {
      usePlayerStore.getState().addToInventory(output.resourceId, output.quantity);
    }
    if (recipe.id === 'harden_stick') useJournalStore.getState().triggerJournalEvent('first_harden');
    setCraftDone(null);
    setCraftProgress(0);
  }

  if (!campfire) return null;

  const cookableInInventory = Object.keys(COOKABLE).filter(
    id => (inventory.find(i => i.resourceId === id)?.quantity ?? 0) > 0
  );

  const flameH  = 18 + flicker * 8;
  const flameH2 = 14 + (1 - flicker) * 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(2px)' }}
         onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>

      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-[520px] overflow-hidden">

        {/* Header */}
        <div className="bg-slate-900 px-6 py-3 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white">🔥 Lagerfeuer</span>
            <div className="flex gap-1">
              <TabBtn active={tab === 'cook'}  onClick={() => setTab('cook')}>🍖 Kochen</TabBtn>
              <TabBtn active={tab === 'craft'} onClick={() => setTab('craft')}>🔨 Am Feuer</TabBtn>
            </div>
          </div>
          <button onClick={closeModal} className="text-slate-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-5 flex gap-5">

          {/* Left: Fire visual + fuel (always visible) */}
          <div className="flex flex-col items-center gap-3 w-36">
            <div className="relative w-24 h-24 flex items-end justify-center">
              {fuel > 0 ? (
                <>
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2"
                       style={{ width: 22, height: flameH, background: 'radial-gradient(ellipse at 50% 100%, #ff6600, #ff3300 60%, transparent)', borderRadius: '50% 50% 40% 40%', transition: 'height 0.1s' }} />
                  <div className="absolute bottom-5 left-1/2 -translate-x-[40%]"
                       style={{ width: 16, height: flameH2, background: 'radial-gradient(ellipse at 50% 100%, #ffaa00, #ff6600 60%, transparent)', borderRadius: '50% 50% 40% 40%', transition: 'height 0.12s' }} />
                  <div className="absolute bottom-6 left-1/2 -translate-x-[60%]"
                       style={{ width: 12, height: flameH2 * 0.8, background: 'radial-gradient(ellipse at 50% 100%, #ffdd44, #ffaa00 60%, transparent)', borderRadius: '50% 50% 40% 40%', transition: 'height 0.09s' }} />
                </>
              ) : (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: `rgba(200,50,0,${0.4 + flicker * 0.4})` }} />
                  <div className="w-2 h-2 rounded-full" style={{ background: `rgba(180,40,0,${0.3 + (1-flicker) * 0.4})` }} />
                </div>
              )}
              <div className="absolute bottom-2 w-16 h-3 bg-amber-900 rounded" style={{ opacity: 0.9 }} />
              <div className="absolute bottom-1 left-3 w-4 h-4 bg-slate-500 rounded-full" />
              <div className="absolute bottom-1 right-3 w-4 h-4 bg-slate-500 rounded-full" />
            </div>

            <div className="text-center">
              <div className="text-slate-400 text-xs mb-1">Brenndauer</div>
              <div className="flex gap-1 justify-center mb-2 flex-wrap max-w-[80px]">
                {Array.from({ length: Math.max(5, fuel) }).map((_, i) => (
                  <div key={i} className={`w-3 h-3 rounded-sm ${i < fuel ? 'bg-orange-500' : 'bg-slate-700'}`} />
                ))}
              </div>
              <div className="text-slate-300 text-xs">{fuel} {fuel === 1 ? 'Tag' : 'Tage'}</div>
            </div>

            <div className="flex flex-col gap-1 w-full">
              <FuelBtn onClick={() => handleAddFuel('sticks')}    disabled={sticks < 1}    label="Ast +1"      count={sticks}    color="bg-amber-700 hover:bg-amber-600" />
              <FuelBtn onClick={() => handleAddFuel('driftwood')} disabled={driftwood < 1} label="Treibholz +2" count={driftwood}  color="bg-stone-600 hover:bg-stone-500" />
              <FuelBtn onClick={() => handleAddFuel('wood')}      disabled={wood < 1}      label="Holz +3"     count={wood}       color="bg-amber-900 hover:bg-amber-800" />
            </div>
          </div>

          {/* Divider */}
          <div className="w-px bg-slate-700" />

          {/* Right: tab content */}
          <div className="flex-1 flex flex-col gap-3 min-w-0">

            {tab === 'cook' && (
              <>
                <div className="text-slate-400 text-xs uppercase tracking-widest">Kochen</div>
                {fuel < 1 && <NoFuelWarning />}

                {/* Cook slot */}
                <div className="flex items-center gap-3">
                  <div
                    onClick={cookDone ? handleCollectCooked : (!cookSlot || cooking ? undefined : handleRemoveCookable)}
                    className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-2xl cursor-pointer transition-colors ${
                      cookDone      ? 'border-green-500 bg-green-900 animate-pulse'
                      : cookSlot    ? 'border-amber-500 bg-slate-700 hover:bg-slate-600'
                      : 'border-slate-600 bg-slate-900'
                    }`}
                  >
                    {cookDone
                      ? ({ cooked_food: '🍖', cooked_mushroom: '🥘', cooked_fish_meal: '🍽️', cooked_crab: '🦀', cooked_turtle: '🐢', cooked_boar: '🥩' } as Record<string,string>)[cookDef!.output] ?? '✅'
                      : cookSlot
                        ? (COOKABLE[cookSlot]?.icon ?? '🥘')
                        : <span className="text-slate-600 text-sm">leer</span>
                    }
                  </div>

                  <div className="flex-1">
                    {(cooking || cookDone) && (
                      <div className="mb-2">
                        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 transition-all duration-75 rounded-full" style={{ width: `${Math.round(cookProgress * 100)}%` }} />
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {cookDone ? '✅ Fertig! Klicken zum Einsammeln' : `Kocht… ${Math.round(cookProgress * 100)}%`}
                        </div>
                      </div>
                    )}
                    {cookSlot && !cooking && !cookDone && (
                      <button onClick={handleStartCooking} disabled={fuel < 1}
                        className={`w-full py-2 rounded-lg text-sm font-bold transition-colors ${fuel > 0 ? 'bg-orange-700 hover:bg-orange-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                        🔥 Kochen starten
                      </button>
                    )}
                    {!cookSlot && !cooking && (
                      <div className="text-slate-500 text-xs">Wähle unten ein Lebensmittel aus</div>
                    )}
                  </div>
                </div>

                {/* Cookable inventory items */}
                {cookableInInventory.length > 0 && !cookSlot && !cooking && (
                  <div>
                    <div className="text-slate-500 text-xs mb-2">Im Inventar:</div>
                    <div className="flex gap-2 flex-wrap">
                      {cookableInInventory.map(id => {
                        const qty = inventory.find(i => i.resourceId === id)?.quantity ?? 0;
                        return (
                          <button key={id} onClick={() => handlePlaceCookable(id)}
                            className="flex flex-col items-center px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs transition-colors">
                            <span className="text-xl">{COOKABLE[id].icon}</span>
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
              </>
            )}

            {tab === 'craft' && (
              <>
                <div className="text-slate-400 text-xs uppercase tracking-widest">Am Feuer herstellen</div>
                {fuel < 1 && <NoFuelWarning />}

                <div className="space-y-2">
                  {fireCraftRecipes.map(recipe => {
                    const canCraft  = canFireCraft(recipe);
                    const isRunning = craftingId === recipe.id;
                    const isDone    = craftDone === recipe.id;
                    const missingKnowledge = !craftingSystem.hasRequiredKnowledge(recipe);

                    return (
                      <div key={recipe.id} className={`rounded-xl border p-3 ${isDone ? 'border-green-600 bg-green-950/40' : 'border-slate-700 bg-slate-900/60'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{recipe.icon}</span>
                              <span className="text-white text-sm font-semibold">{recipe.name}</span>
                            </div>
                            <div className="text-slate-500 text-xs mt-0.5">
                              {recipe.inputs.map(i => `${i.quantity}× ${i.resourceId}`).join(' + ')} → {recipe.outputs.map(o => `${o.quantity}× ${o.resourceId}`).join(', ')}
                            </div>
                            {missingKnowledge && (
                              <div className="text-amber-600 text-xs mt-0.5">Noch nicht entdeckt</div>
                            )}
                          </div>

                          {isDone ? (
                            <button onClick={() => collectFireCraft(recipe)}
                              className="px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-bold rounded-lg transition-colors shrink-0">
                              ✅ Einsammeln
                            </button>
                          ) : isRunning ? (
                            <span className="text-orange-400 text-xs shrink-0 mt-1">läuft…</span>
                          ) : (
                            <button
                              onClick={() => startFireCraft(recipe)}
                              disabled={!canCraft || !!craftingId}
                              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shrink-0 ${
                                canCraft && !craftingId
                                  ? 'bg-amber-700 hover:bg-amber-600 text-white'
                                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                              }`}
                            >
                              Herstellen
                            </button>
                          )}
                        </div>

                        {isRunning && (
                          <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 transition-all duration-75 rounded-full" style={{ width: `${Math.round(craftProgress * 100)}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${active ? 'bg-amber-700 text-white' : 'text-slate-400 hover:text-white'}`}>
      {children}
    </button>
  );
}

function FuelBtn({ onClick, disabled, label, count, color }: { onClick: () => void; disabled: boolean; label: string; count: number; color: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${disabled ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : `${color} text-white`}`}>
      🪵 {label} {!disabled && <span className="opacity-70">({count})</span>}
    </button>
  );
}

function NoFuelWarning() {
  return (
    <div className="text-orange-400 text-xs bg-orange-950/60 border border-orange-800/50 rounded-lg px-3 py-2">
      Kein Brennstoff — lege Äste, Treibholz oder Holz nach
    </div>
  );
}
