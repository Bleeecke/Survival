import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { useTutorialStore } from '../../store/tutorialStore';
import { WorldGenerator } from '../../services/phaser/WorldGenerator';
import OptionsModal from './OptionsModal';

export default function MainMenu() {
  const [showOptions, setShowOptions] = useState(false);
  const setPhase        = useGameStore(s => s.setPhase);
  const resetGame       = useGameStore(s => s.reset);
  const initPlayer      = usePlayerStore(s => s.initPlayer);
  const resetPlayer     = usePlayerStore(s => s.reset);
  const initializeWorld = useWorldStore(s => s.initializeWorld);
  const resetWorld      = useWorldStore(s => s.reset);

  const resetTutorial   = useTutorialStore(s => s.resetTutorial);
  const hasSave = !!useWorldStore(s => s.world);

  const handleNewGame = () => {
    // Full reset before starting fresh – clears old save data
    resetGame();
    resetPlayer();
    resetWorld();
    resetTutorial();

    initPlayer('Player');

    const seed = Math.floor(Math.random() * 1_000_000);
    const world = new WorldGenerator().generate(seed);
    initializeWorld(world);

    // Place player at beach spawn
    usePlayerStore.getState().movePlayer(world.spawnX, world.spawnY);

    useGameStore.getState().setIsNewGame(true);
    setPhase('playing');
  };

  const handleLoadGame = () => {
    useGameStore.getState().setIsNewGame(false);
    setPhase('playing');
  };

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-white mb-3">Survival</h1>
        <p className="text-xl text-slate-400 mb-12">Explore. Gather. Survive.</p>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleNewGame}
            className="w-56 py-3 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl transition-colors text-lg"
          >
            New Game
          </button>

          <button
            onClick={handleLoadGame}
            disabled={!hasSave}
            className={`w-56 py-3 font-bold rounded-xl transition-colors text-lg ${
              hasSave
                ? 'bg-blue-700 hover:bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
          <button
            onClick={() => setShowOptions(true)}
            className="w-56 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold rounded-xl transition-colors text-lg"
          >
            ⚙️ Optionen
          </button>
        </div>

        {!hasSave && (
          <p className="text-slate-600 text-sm mt-4">No save found</p>
        )}
      </div>

      {showOptions && <OptionsModal onClose={() => setShowOptions(false)} />}
    </div>
  );
}
