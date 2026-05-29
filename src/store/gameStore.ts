import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GamePhase, Difficulty } from '../types';
import type { WorldResource, DroppedItem } from '../types';

interface GameStore {
  phase: GamePhase;
  difficulty: Difficulty;
  isPaused: boolean;
  elapsedTime: number;
  score: number;
  showSleepMenu: boolean;
  sleepQuality: 'cabin' | 'shelter' | 'spot' | 'outdoor';
  campfireNear: boolean;
  setCampfireNear: (v: boolean) => void;

  // Gather interaction menu
  gatherMenuOpen: boolean;
  nearbyResources: WorldResource[];
  pendingGatherId: string | null;
  pendingGatherAction: string | null; // e.g. 'sticks' for chopping branches from tree

  // Pickup menu (dropped items)
  pickupMenuOpen: boolean;
  nearbyDrops: DroppedItem[];
  openPickupMenu: (drops: DroppedItem[]) => void;
  closePickupMenu: () => void;

  // Mouse hover tooltip
  hoveredResource: WorldResource | null;
  hoverSince: number | null;

  // Crafting modal
  craftingOpen: boolean;
  setCraftingOpen: (open: boolean) => void;

  // Placement mode — active after clicking "Craft" for a structure
  placementMode: { recipeId: string } | null;
  enterPlacementMode: (recipeId: string) => void;
  exitPlacementMode: () => void;

  // Storage box modal
  storageBoxId: string | null;
  openStorageBox: (id: string) => void;
  closeStorageBox: () => void;

  // Campfire modal
  campfireModalId: string | null;
  openCampfireModal: (id: string) => void;
  closeCampfireModal: () => void;

  // Palm shelter modal
  palmShelterModalId: string | null;
  openPalmShelterModal: (id: string) => void;
  closePalmShelterModal: () => void;

  // Dev mode
  devMode: boolean;
  freeCraft: boolean;
  devRain: boolean;
  toggleDevMode: () => void;
  toggleFreeCraft: () => void;
  toggleDevRain: () => void;
  setDevRain: (v: boolean) => void;

  // Shipwreck awakening sequence
  isAwakening: boolean;
  awakeningBlur: number;   // px blur applied to canvas, fades 0→0 during rising
  isNewGame: boolean;
  setAwakening: (v: boolean) => void;
  setAwakeningBlur: (v: number) => void;
  setIsNewGame: (v: boolean) => void;

  setPhase: (phase: GamePhase) => void;
  setPaused: (paused: boolean) => void;
  setDifficulty: (diff: Difficulty) => void;
  tickTime: (delta: number) => void;
  addScore: (points: number) => void;
  setShowSleepMenu: (show: boolean, quality?: 'cabin' | 'shelter' | 'spot' | 'outdoor') => void;
  openGatherMenu: (resources: WorldResource[]) => void;
  closeGatherMenu: () => void;
  setPendingGather: (id: string | null, action?: string | null) => void;
  setHoveredResource: (res: WorldResource | null) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      phase: 'menu',
      difficulty: 'normal',
      isPaused: false,
      elapsedTime: 0,
      score: 0,
      showSleepMenu: false,
      sleepQuality: 'outdoor' as 'cabin' | 'shelter' | 'spot' | 'outdoor',
      campfireNear: false,
      setCampfireNear: (v) => set({ campfireNear: v }),
      gatherMenuOpen: false,
      nearbyResources: [],
      pendingGatherId: null,
      pendingGatherAction: null,
      pickupMenuOpen: false,
      nearbyDrops: [],
      openPickupMenu: (drops) => set({ pickupMenuOpen: true, nearbyDrops: drops }),
      closePickupMenu: () => set({ pickupMenuOpen: false, nearbyDrops: [] }),
      hoveredResource: null,
      hoverSince: null,
      devMode: false,
      freeCraft: false,
      devRain: false,
      toggleDevMode: () => set(s => ({ devMode: !s.devMode })),
      toggleFreeCraft: () => set(s => ({ freeCraft: !s.freeCraft })),
      toggleDevRain: () => set(s => ({ devRain: !s.devRain })),
      setDevRain: (v) => set({ devRain: v }),
      isAwakening: false,
      awakeningBlur: 0,
      isNewGame: false,
      setAwakening: (v) => set({ isAwakening: v }),
      setAwakeningBlur: (v) => set({ awakeningBlur: v }),
      setIsNewGame: (v) => set({ isNewGame: v }),
      craftingOpen: false,

      setPhase: (phase) => set({ phase }),
      setPaused: (paused) => set({ isPaused: paused }),
      setDifficulty: (difficulty) => set({ difficulty }),
      tickTime: (delta) =>
        set((state) => ({ elapsedTime: state.elapsedTime + delta })),
      addScore: (points) =>
        set((state) => ({ score: state.score + points })),
      setShowSleepMenu: (show, quality = 'outdoor') =>
        set({ showSleepMenu: show, sleepQuality: quality }),
      openGatherMenu: (resources) =>
        set({ gatherMenuOpen: true, nearbyResources: resources, pendingGatherId: null, pendingGatherAction: null }),
      closeGatherMenu: () =>
        set({ gatherMenuOpen: false, nearbyResources: [], pendingGatherId: null, pendingGatherAction: null }),
      setPendingGather: (id, action = null) =>
        set({ pendingGatherId: id, pendingGatherAction: action }),
      setCraftingOpen: (open) => set({ craftingOpen: open }),
      placementMode: null,
      enterPlacementMode: (recipeId) => set({ placementMode: { recipeId }, craftingOpen: false }),
      exitPlacementMode: () => set({ placementMode: null }),
      storageBoxId: null,
      openStorageBox: (id) => set({ storageBoxId: id, isPaused: false }),
      closeStorageBox: () => set({ storageBoxId: null }),
      campfireModalId: null,
      openCampfireModal: (id) => set({ campfireModalId: id }),
      closeCampfireModal: () => set({ campfireModalId: null }),
      palmShelterModalId: null,
      openPalmShelterModal: (id) => set({ palmShelterModalId: id }),
      closePalmShelterModal: () => set({ palmShelterModalId: null }),
      setHoveredResource: (res) =>
        set(state => {
          if (res?.id === state.hoveredResource?.id) return {};
          return { hoveredResource: res, hoverSince: res ? Date.now() : null };
        }),
      reset: () =>
        set({
          phase: 'menu',
          difficulty: 'normal',
          isPaused: false,
          elapsedTime: 225_000,
          score: 0,
          showSleepMenu: false,
          sleepQuality: 'outdoor' as 'cabin' | 'shelter' | 'spot' | 'outdoor',
          gatherMenuOpen: false,
          nearbyResources: [],
          pendingGatherId: null,
          pendingGatherAction: null,
          pickupMenuOpen: false,
          nearbyDrops: [],
          hoveredResource: null,
          hoverSince: null,
          craftingOpen: false,
          campfireModalId: null,
          palmShelterModalId: null,
          storageBoxId: null,
          placementMode: null,
        }),
    }),
    {
      name: 'survival-game-save',
      partialize: (s) => {
        const { isAwakening, awakeningBlur, isNewGame, devRain, freeCraft,
                setAwakening, setAwakeningBlur, setIsNewGame, setDevRain, toggleFreeCraft, toggleDevMode, toggleDevRain, ...rest } = s;
        void isAwakening; void awakeningBlur; void isNewGame; void devRain; void freeCraft;
        void setAwakening; void setAwakeningBlur; void setIsNewGame; void setDevRain; void toggleFreeCraft; void toggleDevMode; void toggleDevRain;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAwakening = false;
          state.awakeningBlur = 0;
          state.isNewGame = false;
          state.isPaused = false;
          state.gatherMenuOpen = false;
          state.craftingOpen = false;
          state.storageBoxId = null;
          state.campfireModalId = null;
          state.palmShelterModalId = null;
          state.showSleepMenu = false;
          state.placementMode = null;
          state.pickupMenuOpen = false;
          state.nearbyDrops = [];
        }
      },
    }
  )
);
