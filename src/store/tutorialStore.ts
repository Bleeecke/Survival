import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TutorialStep {
  id: number;
  title: string;
  description: string;
  hint: string;
  icon: string;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    icon: '💧',
    title: 'Pfütze finden & trinken',
    description: 'Du brauchst dringend Wasser. Suche eine Pfütze in der Nähe und trinke daraus.',
    hint: 'Pfützen liegen nahe dem Startpunkt auf Wiesen. Geh ran und drücke LEERTASTE — Wasser wird sofort getrunken.',
  },
  {
    id: 2,
    icon: '🌿',
    title: 'Äste sammeln (×5)',
    description: 'Sammle mindestens 5 Äste für dein erstes Feuer.',
    hint: 'Äste liegen überall auf dem Boden – besonders am Waldrand. Geh ran und drücke LEERTASTE.',
  },
  {
    id: 3,
    icon: '🪨',
    title: 'Feuersteine & Kieselsteine sammeln',
    description: 'Du brauchst Feuersteine und Kieselsteine, um scharfe Steinklingen herzustellen.',
    hint: 'Feuersteine (glänzende Steine) und Kieselsteine findest du am Strand. Sammle je 2 davon.',
  },
  {
    id: 4,
    icon: '🔪',
    title: 'Feuersteinmesser herstellen',
    description: 'Ein Messer entsteht in 3 Schritten: Klingen absplittern → Ast härten → Messer binden.',
    hint: '① Crafting (C) → Feuerstein absplittern (Feuerstein + Kiesel) → scharfer Stein.\n② Lagerfeuer bauen, dann Ast im Feuer härten.\n③ Feuersteinmesser binden (scharfer Stein + gehärteter Ast + Pflanzenfaser).',
  },
  {
    id: 5,
    icon: '🔥',
    title: 'Lagerfeuer bauen',
    description: 'Ein Lagerfeuer hält dich warm und schützt in der Nacht.',
    hint: 'Crafting-Menü (C) → Lagerfeuer (5× Äste + 3× Kieselsteine). Kieselsteine findest du am Strand.',
  },
  {
    id: 6,
    icon: '😴',
    title: 'Schlafen',
    description: 'Du bist erschöpft von der Strandung. Du musst dich ausruhen.',
    hint: 'Drücke E um zu schlafen. Beim Lagerfeuer schläfst du geschützter.',
  },
];

interface TutorialStore {
  introDismissed: boolean;
  currentStep: number;       // 1–6, 0 = tutorial abgeschlossen
  skipped: boolean;

  dismissIntro: () => void;
  completeStep: (step: number) => void;
  skipTutorial: () => void;
  resetTutorial: () => void;
}

export const useTutorialStore = create<TutorialStore>()(
  persist(
    (set, get) => ({
      introDismissed: false,
      currentStep: 1,
      skipped: false,

      dismissIntro: () => set({ introDismissed: true }),

      completeStep: (step) => {
        const { currentStep, skipped } = get();
        if (skipped || step !== currentStep) return;
        const next = step + 1;
        set({ currentStep: next > TUTORIAL_STEPS.length ? 0 : next });
      },

      skipTutorial: () => set({ skipped: true, currentStep: 0 }),

      resetTutorial: () => set({ introDismissed: false, currentStep: 1, skipped: false }),
    }),
    { name: 'survival-tutorial-save' }
  )
);
