import { useEffect, useCallback, useState } from 'react';
import GameCanvas from '../game/GameCanvas';
import GameHUD from '../game/GameHUD';
import InventoryPanel from '../game/InventoryPanel';
import CraftingModal from '../game/CraftingModal';
import BuildBar from '../game/BuildMenu';
import CampfireModal from '../game/CampfireModal';
import PalmShelterModal from '../game/PalmShelterModal';
import SleepModal from '../game/SleepModal';
import StorageBoxModal from '../game/StorageBoxModal';
import CharacterPanel from '../game/CharacterPanel';
import IntroModal from '../game/IntroModal';
import TutorialPanel from '../game/TutorialPanel';
import SkillNotifications from '../game/SkillNotifications';
import JournalModal from '../game/JournalModal';
import SkillsBar from '../game/SkillsBar';
import StatsOverlay from '../game/StatsOverlay';
import PauseMenu from './PauseMenu';
import DevPanel from '../game/DevPanel';
import HelpPanel from '../game/HelpPanel';
import PickupMenu from '../game/PickupMenu';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { DAY_DURATION_MS } from '../../data/worldConfig';
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

  const devMode         = useGameStore(s => s.devMode);
  const elapsedTime     = useGameStore(s => s.elapsedTime);
  const currentDay      = Math.floor(elapsedTime / DAY_DURATION_MS) + 1;
  const isAwakening     = useGameStore(s => s.isAwakening);
  const awakeningBlur   = useGameStore(s => s.awakeningBlur);
  const [subtitlePhase, setSubtitlePhase] = useState(0); // 0=hidden, 1-4=lines, 5=fading, 6=gone

  useEffect(() => {
    if (!isAwakening) return;
    setSubtitlePhase(0);
    const t1 = setTimeout(() => setSubtitlePhase(1), 2800);
    const t2 = setTimeout(() => setSubtitlePhase(2), 5200);
    const t3 = setTimeout(() => setSubtitlePhase(3), 7400);
    const t4 = setTimeout(() => setSubtitlePhase(4), 9400);
    const t5 = setTimeout(() => setSubtitlePhase(5), 11500);
    const t6 = setTimeout(() => setSubtitlePhase(6), 13500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); clearTimeout(t6); };
  }, [isAwakening]);

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
        if (useGameStore.getState().pickupMenuOpen) { useGameStore.getState().closePickupMenu(); return; }
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
        const FOOD_IDS = new Set([
          'food', 'cooked_food', 'cooked_fish_meal', 'mushroom', 'cooked_mushroom',
          'exotic_fruit', 'turtle_meat', 'cooked_turtle', 'crab_meat', 'cooked_crab',
        ]);
        const currentStats = usePlayerStore.getState().player.stats;
        const peekId = usePlayerStore.getState().player.equipment.belt[beltIdx as 0|1|2]?.resourceId;
        if (peekId && FOOD_IDS.has(peekId) && currentStats.hunger <= 0) {
          // satt — nichts tun
        } else {
          const resourceId = useBeltSlot(beltIdx as 0|1|2);
          if (resourceId) {
            const def = USABLE[resourceId];
            if (def) updateStats(def.effect(currentStats));
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
          filter: awakeningBlur > 0
            ? `blur(${awakeningBlur.toFixed(1)}px)`
            : fatigue >= 80 ? 'blur(2.5px)' : fatigue >= 65 ? 'blur(1.2px)' : fatigue >= 45 ? 'blur(0.4px)' : 'none',
          transition: awakeningBlur > 0 ? 'filter 0.1s linear' : 'filter 2s ease',
        }}
      >
        <GameCanvas />
        {/* Character panel overlay – top-left of canvas */}
        <div className="absolute top-3 left-3 z-10 pointer-events-auto">
          <CharacterPanel />
        </div>

        {/* Day counter – top-right of canvas */}
        <div className="absolute top-3 right-3 z-10 pointer-events-none">
          <div className="bg-black/60 border border-amber-700/60 rounded-lg px-4 py-1 backdrop-blur-sm">
            <span className="text-amber-300 font-bold text-sm tracking-widest">Tag {currentDay}</span>
          </div>
        </div>

        {/* Stats overlay – top-center of canvas */}
        <StatsOverlay />

        {/* Help & controls panel – bottom-left of canvas */}
        <HelpPanel />

        {/* RimWorld-style build bar – bottom of canvas */}
        <BuildBar />
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden">
        {/* Crafting + Menu buttons */}
        <div className="px-3 pt-3 pb-2 border-b border-slate-700 flex gap-2">
          <button
            onClick={() => setCraftingOpen(true)}
            className="flex-1 py-1.5 bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <span>📖</span>
            <span>Crafting</span>
            <span className="text-amber-300 font-normal">(C)</span>
          </button>
          <button
            onClick={() => setPaused(true)}
            className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
            title="Pause (Esc)"
          >
            <span>⏸</span>
            <span>Menü</span>
          </button>
        </div>

        {/* Tutorial panel */}
        {!tutorialSkipped && tutorialStep > 0 && (
          <div className="px-3 pt-2">
            <TutorialPanel />
          </div>
        )}

        <SkillNotifications />
        <JournalModal />

        {/* Skills panel — moved from canvas */}
        <div className="px-3 py-2 border-b border-slate-700">
          <SkillsBar />
        </div>

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

      {/* Pickup menu (dropped items) */}
      <PickupMenu />

      {/* Dev panel */}
      {devMode && <DevPanel />}

      {/* Pause overlay */}
      {isPaused && <PauseMenu />}

      {/* Intro modal — shown once on first play */}
      {!introDismissed && <IntroModal />}

      {/* Cinematic subtitle awakening overlay */}
      {subtitlePhase >= 1 && subtitlePhase < 6 && (
        <div
          className="absolute inset-x-0 bottom-0 z-[900000] pointer-events-none"
          style={{ opacity: subtitlePhase === 5 ? 0 : 1, transition: 'opacity 2s ease' }}
        >
          {/* Gradient vignette at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-48"
               style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)' }} />

          <div className="relative px-10 pb-10 pt-16 max-w-3xl mx-auto">
            {/* Chapter label */}
            <SubtitleLine
              visible={subtitlePhase >= 1}
              text="— Kapitel I —"
              className="text-amber-600/80 text-sm tracking-[0.5em] uppercase font-light mb-4"
            />
            {/* Main line */}
            <SubtitleLine
              visible={subtitlePhase >= 2}
              text="Du öffnest die Augen. Sand. Salz. Stille."
              className="text-white text-3xl font-light tracking-wide leading-snug mb-4"
              style={{ textShadow: '0 2px 30px rgba(0,0,0,0.9)' }}
            />
            {/* Story line 1 */}
            <SubtitleLine
              visible={subtitlePhase >= 3}
              text="Das Schiff ist verschwunden. Die anderen auch. Nur das Rauschen der Wellen bleibt."
              className="text-slate-300 text-lg font-light leading-relaxed tracking-wide mb-6"
              style={{ textShadow: '0 1px 16px rgba(0,0,0,1)' }}
            />
            {/* Final dramatic line */}
            <SubtitleLine
              visible={subtitlePhase >= 4}
              text="Überlebe."
              className="text-amber-400 text-2xl font-semibold tracking-[0.4em] uppercase"
              style={{ textShadow: '0 0 32px rgba(255,180,50,0.6)' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SubtitleLine({ visible, text, className, style }: {
  visible: boolean;
  text: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 1.4s ease, transform 1.4s ease',
      }}
    >
      {text}
    </div>
  );
}
