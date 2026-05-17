import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { musicManager } from '../services/MusicManager';

const DAY_DURATION_MS = 10 * 60 * 1000;

export function useMusic() {
  const phase      = useGameStore(s => s.phase);
  const elapsed    = useGameStore(s => s.elapsedTime);
  const isNewGame  = useGameStore(s => s.isNewGame);
  const introPlayed = useRef(false);

  useEffect(() => {
    if (phase === 'menu') {
      introPlayed.current = false;
      musicManager.stopIntro();
      musicManager.crossfadeTo('menu');
      return;
    }
    if (phase === 'playing' || phase === 'paused') {
      if (isNewGame && !introPlayed.current) {
        introPlayed.current = true;
        musicManager.playIntro(() => {
          const dayProgress = (useGameStore.getState().elapsedTime % DAY_DURATION_MS) / DAY_DURATION_MS;
          musicManager.crossfadeTo(dayProgress >= 0.5 ? 'night' : 'day');
        });
        return;
      }
      const dayProgress = (elapsed % DAY_DURATION_MS) / DAY_DURATION_MS;
      const isNight = dayProgress >= 0.5;
      musicManager.crossfadeTo(isNight ? 'night' : 'day');
      return;
    }
    if (phase === 'dead') {
      musicManager.stopIntro();
      musicManager.stop();
    }
  }, [phase, isNewGame, Math.floor(elapsed / (DAY_DURATION_MS / 2))]);
}
