import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { musicManager } from '../services/MusicManager';

const DAY_DURATION_MS = 10 * 60 * 1000;

export function useMusic() {
  const phase      = useGameStore(s => s.phase);
  const elapsed    = useGameStore(s => s.elapsedTime);

  useEffect(() => {
    if (phase === 'menu') {
      musicManager.crossfadeTo('menu');
      return;
    }
    if (phase === 'playing' || phase === 'paused') {
      const dayProgress = (elapsed % DAY_DURATION_MS) / DAY_DURATION_MS;
      // Night: roughly 0.5–1.0 of the day cycle
      const isNight = dayProgress >= 0.5;
      musicManager.crossfadeTo(isNight ? 'night' : 'day');
      return;
    }
    if (phase === 'dead') {
      musicManager.stop();
    }
  }, [phase, Math.floor(elapsed / (DAY_DURATION_MS / 2))]); // only re-run on half-day boundary
}
