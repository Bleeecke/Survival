export type GamePhase = 'menu' | 'loading' | 'playing' | 'paused' | 'dead' | 'game-over';
export type Difficulty = 'easy' | 'normal' | 'hard';

export interface GameState {
  phase: GamePhase;
  difficulty: Difficulty;
  isPaused: boolean;
  elapsedTime: number;
  score: number;
}
