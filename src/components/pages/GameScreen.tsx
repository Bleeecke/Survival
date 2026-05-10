import { useEffect } from 'react';
import GameCanvas from '../game/GameCanvas';
import GameHUD from '../game/GameHUD';
import InventoryPanel from '../game/InventoryPanel';
import CraftingModal from '../game/CraftingModal';
import SleepModal from '../game/SleepModal';
import StorageBoxModal from '../game/StorageBoxModal';
import CharacterPanel from '../game/CharacterPanel';
import IntroModal from '../game/IntroModal';
import TutorialPanel from '../game/TutorialPanel';
import PauseMenu from './PauseMenu';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { useTutorialStore } from '../../store/tutorialStore';
import { useWorldStore } from '../../store/worldStore';
import { USABLE } from '../game/InventoryPanel';

export default function GameScreen() {
  const isPaused        = useGameStore(s => s.isPaused);
  const setPaused       = useGameStore(s => s.setPaused);
  const showSleepMenu   = useGameStore(s => s.showSleepMenu);
  const gatherMenuOpen  = useGameStore(s => s.gatherMenuOpen);
  const closeGatherMenu = useGameStore(s => s.closeGatherMenu);
  const craftingOpen    = useGameStore(s => s.craftingOpen);
  const setCraftingOpen = useGameStore(s => s.setCraftingOpen);
  const storageBoxId    = useGameStore(s => s.storageBoxId);
  const closeStorageBox = useGameStore(s => s.closeStorageBox);
  const useBeltSlot     = usePlayerStore(s => s.useBeltSlot);
  const updateStats     = usePlayerStore(s => s.updateStats);

  const introDismissed  = useTutorialStore(s => s.introDismissed);
  const tutorialStep    = useTutorialStore(s => s.currentStep);
  const completeStep    = useTutorialStore(s => s.completeStep);
  const tutorialSkipped = useTutorialStore(s => s.skipped);

  // ── Tutorial step detection ──────────────────────────────────────
  // Step 1: Wasserquelle finden → wenn Wasser im Inventar (gesammelt an Quelle)
  useEffect(() => {
    if (tutorialSkipped || tutorialStep !== 1) return;
    const check = () => {
      const items = usePlayerStore.getState().player.inventory.items;
      if (items.some(i => i.resourceId === 'water' && i.quantity > 0)) completeStep(1);
    };
    return usePlayerStore.subscribe(check);
  }, [tutorialStep, tutorialSkipped, completeStep]);

  // Step 2: Äste ×5
  useEffect(() => {
    if (tutorialSkipped || tutorialStep !== 2) return;
    const check = () => {
      const items = usePlayerStore.getState().player.inventory.items;
      const count = items.find(i => i.resourceId === 'sticks')?.quantity ?? 0;
      if (count >= 5) completeStep(2);
    };
    return usePlayerStore.subscribe(check);
  }, [tutorialStep, tutorialSkipped, completeStep]);

  // Step 3: Feuersteine ×2
  useEffect(() => {
    if (tutorialSkipped || tutorialStep !== 3) return;
    const check = () => {
      const items = usePlayerStore.getState().player.inventory.items;
      const count = items.find(i => i.resourceId === 'flint')?.quantity ?? 0;
      if (count >= 2) completeStep(3);
    };
    return usePlayerStore.subscribe(check);
  }, [tutorialStep, tutorialSkipped, completeStep]);

  // Step 4: Feuersteinmesser gecraftet (flint_knife oder flint_lighter im Inventar oder Equipment)
  useEffect(() => {
    if (tutorialSkipped || tutorialStep !== 4) return;
    const check = () => {
      const player = usePlayerStore.getState().player;
      const inInv = player.inventory.items.some(
        i => (i.resourceId === 'flint_knife' || i.resourceId === 'flint_lighter') && i.quantity > 0
      );
      const eq = player.equipment;
      const inHand = eq?.leftHand?.resourceId === 'flint_knife' || eq?.rightHand?.resourceId === 'flint_knife'
                  || eq?.leftHand?.resourceId === 'flint_lighter' || eq?.rightHand?.resourceId === 'flint_lighter';
      if (inInv || inHand) completeStep(4);
    };
    return usePlayerStore.subscribe(check);
  }, [tutorialStep, tutorialSkipped, completeStep]);

  // Step 5: Lagerfeuer gebaut
  useEffect(() => {
    if (tutorialSkipped || tutorialStep !== 5) return;
    return useWorldStore.subscribe((state) => {
      if (state.world?.structures.some(s => s.type === 'campfire')) completeStep(5);
    });
  }, [tutorialStep, tutorialSkipped, completeStep]);

  // Step 6: Schlafen (SleepModal geöffnet)
  useEffect(() => {
    if (tutorialSkipped || tutorialStep !== 6) return;
    if (showSleepMenu) completeStep(6);
  }, [showSleepMenu, tutorialStep, tutorialSkipped, completeStep]);

  // Crafting-Menü öffnen triggert Tutorial-Hinweis für Step 4 (nur Feedback, kein Skip)
  useEffect(() => {
    if (tutorialSkipped || tutorialStep !== 4) return;
    // nichts: Step 4 wird durch Inventar-Check abgehakt
  }, [craftingOpen, tutorialStep, tutorialSkipped]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (useGameStore.getState().gatherMenuOpen) { closeGatherMenu(); return; }
        if (craftingOpen) { setCraftingOpen(false); return; }
        if (useGameStore.getState().storageBoxId) { closeStorageBox(); return; }
        setPaused(!useGameStore.getState().isPaused);
      }
      if ((e.key === 'c' || e.key === 'C') && !isPaused) {
        setCraftingOpen(prev => !prev);
      }

      // Belt quick-use: 1 / 2 / 3
      const beltIdx = e.key === '1' ? 0 : e.key === '2' ? 1 : e.key === '3' ? 2 : -1;
      if (beltIdx >= 0 && !isPaused) {
        const resourceId = useBeltSlot(beltIdx as 0|1|2);
        if (resourceId) {
          const def = USABLE[resourceId];
          if (def) {
            const currentStats = usePlayerStore.getState().player.stats;
            updateStats(def.effect(currentStats));
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaused, isPaused, craftingOpen, closeGatherMenu, setCraftingOpen, storageBoxId, closeStorageBox, useBeltSlot, updateStats]);

  return (
    <div className="flex w-full h-screen bg-black relative">
      {/* Game Canvas */}
      <div className="flex-1 relative" style={{ minWidth: 0 }}>
        <GameCanvas />
        {/* Character panel overlay – top-left of canvas */}
        <div className="absolute top-3 left-3 z-10 pointer-events-auto">
          <CharacterPanel />
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
        {/* Crafting button — top of sidebar */}
        <div className="px-3 pt-3 pb-2 border-b border-slate-700">
          <button
            onClick={() => setCraftingOpen(true)}
            className="w-full py-2 bg-amber-700 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>📖</span>
            <span>Crafting Buch</span>
            <span className="text-amber-300 text-xs font-normal">(C)</span>
          </button>
        </div>

        {/* Tutorial panel — shown between crafting button and HUD */}
        {!tutorialSkipped && tutorialStep > 0 && (
          <div className="px-3 pt-3">
            <TutorialPanel />
          </div>
        )}

        <GameHUD />
        <div className="flex-1 overflow-y-auto min-h-0">
          <InventoryPanel />
        </div>
      </div>

      {/* Crafting modal */}
      {craftingOpen && <CraftingModal onClose={() => setCraftingOpen(false)} />}

      {/* Storage box modal */}
      <StorageBoxModal />

      {/* Sleep modal */}
      {showSleepMenu && <SleepModal />}

      {/* Pause overlay */}
      {isPaused && <PauseMenu />}

      {/* Intro modal — shown once on first play */}
      {!introDismissed && <IntroModal />}
    </div>
  );
}
