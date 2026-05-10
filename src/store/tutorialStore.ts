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
    title: 'Wasserquelle finden',
    description: 'Du brauchst dringend Wasser. Erkundige die Insel und finde eine Quelle.',
    hint: 'Quellen findest du zwischen Felsen und im Inneren der Insel. Bewege dich mit WASD.',
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
    title: 'Feuersteine sammeln (×2)',
    description: 'Du brauchst Feuersteine für ein Feuersteinmesser – dein erstes Werkzeug.',
    hint: 'Feuersteine (glänzende Steine) findest du hauptsächlich am Strand zwischen Sand und Wasser.',
  },
  {
    id: 4,
    icon: '🔪',
    title: 'Feuersteinmesser herstellen',
    description: 'Öffne das Crafting-Menü und stelle ein Feuersteinmesser her.',
    hint: 'Drücke C für das Crafting-Menü → Werkzeuge → Feuersteinmesser (2× Feuerstein + 1× Ast).',
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
