import { useEffect, useCallback } from 'react';
import GameCanvas from '../game/GameCanvas';
import GameHUD from '../game/GameHUD';
import InventoryPanel from '../game/InventoryPanel';
import CraftingModal from '../game/CraftingModal';
import CampfireModal from '../game/CampfireModal';
import PalmShelterModal from '../game/PalmShelterModal';
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
  const fatigue         = usePlayerStore(s => s.player.stats.fatigue ?? 0);
  const placementMode   = useGameStore(s => s.placementMode);
  const exitPlacement   = useGameStore(s => s.exitPlacementMode);
  const isPaused        = useGameStore(s => s.isPaused);
  const setPaused       = useGameStore(s => s.setPaused);
  const showSleepMenu   = useGameStore(s => s.showSleepMenu);
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
  const closeCrafting = useCallback(() => setCraftingOpen(false), [setCraftingOpen]);

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

  // Step 4: Feuersteinmesser gecraftet
  useEffect(() => {
    if (tutorialSkipped || tutorialStep !== 4) return;
    const check = () => {
      const player = usePlayerStore.getState().player;
      const inInv = player.inventory.items.some(
        i => i.resourceId === 'flint_knife' && i.quantity > 0
      );
      const eq = player.equipment;
      const inHand = eq?.leftHand?.resourceId === 'flint_knife' || eq?.rightHand?.resourceId === 'flint_knife';
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
      // Avoid key-repeat toggles (notably "C" opening and immediately closing modals)
      if (e.repeat) return;

      if (e.key === 'Escape') {
        if (useGameStore.getState().placementMode) { useGameStore.getState().exitPlacementMode(); return; }
        if (useGameStore.getState().palmShelterModalId) { useGameStore.getState().closePalmShelterModal(); return; }
        if (useGameStore.getState().gatherMenuOpen) { closeGatherMenu(); return; }
        if (craftingOpen) { setCraftingOpen(false); return; }
        if (useGameStore.getState().storageBoxId) { closeStorageBox(); return; }
        setPaused(!useGameStore.getState().isPaused);
      }
      if ((e.key === 'c' || e.key === 'C') && !isPaused) {
        const open = useGameStore.getState().craftingOpen;
        setCraftingOpen(!open);
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
      {/* Game Canvas — blur increases with fatigue stage */}
      <div
        className="flex-1 relative"
        style={{
          minWidth: 0,
          filter: fatigue >= 80 ? 'blur(2.5px)' : fatigue >= 65 ? 'blur(1.2px)' : fatigue >= 45 ? 'blur(0.4px)' : 'none',
          transition: 'filter 2s ease',
        }}
      >
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

      {/* Placement mode overlay */}
      {placementMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/70 border border-green-500/50 rounded-xl px-5 py-3 text-center backdrop-blur-sm">
            <div className="text-green-400 font-bold text-sm mb-0.5">Platzierungsmodus</div>
            <div className="text-slate-300 text-xs">Klicken zum Platzieren &nbsp;·&nbsp; <span className="text-slate-400">Esc = Abbrechen</span></div>
          </div>
        </div>
      )}

      {placementMode && (
        <button
          onClick={exitPlacement}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 bg-red-800/80 hover:bg-red-700 text-white text-xs font-semibold rounded-lg border border-red-600 transition-colors pointer-events-auto"
        >
          ✕ Abbrechen
        </button>
      )}

      {/* Crafting modal */}
      {craftingOpen && <CraftingModal onClose={closeCrafting} />}

      {/* Storage box modal */}
      <StorageBoxModal />
      <CampfireModal />
      <PalmShelterModal />

      {/* Sleep modal */}
      {showSleepMenu && <SleepModal />}

      {/* Pause overlay */}
      {isPaused && <PauseMenu />}

      {/* Intro modal — shown once on first play */}
      {!introDismissed && <IntroModal />}
    </div>
  );
}
