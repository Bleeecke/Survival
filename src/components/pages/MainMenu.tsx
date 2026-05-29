import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { useTutorialStore } from '../../store/tutorialStore';
import { WorldGenerator } from '../../services/phaser/WorldGenerator';
import OptionsModal from './OptionsModal';
import { CHANGELOG, CURRENT_VERSION, CURRENT_DATE } from '../../data/changelog';

export default function MainMenu() {
  const [showOptions,   setShowOptions]   = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  const setPhase        = useGameStore(s => s.setPhase);
  const resetGame       = useGameStore(s => s.reset);
  const initPlayer      = usePlayerStore(s => s.initPlayer);
  const resetPlayer     = usePlayerStore(s => s.reset);
  const initializeWorld = useWorldStore(s => s.initializeWorld);
  const resetWorld      = useWorldStore(s => s.reset);
  const resetTutorial   = useTutorialStore(s => s.resetTutorial);
  const hasSave         = !!useWorldStore(s => s.world);

  const handleNewGame = () => {
    resetGame();
    resetPlayer();
    resetWorld();
    resetTutorial();
    initPlayer('Player');
    const seed = Math.floor(Math.random() * 1_000_000);
    const world = new WorldGenerator().generate(seed);
    initializeWorld(world);
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
        <h1 className="text-6xl font-bold text-white mb-2">Survival</h1>
        <p className="text-xl text-slate-400 mb-1">Explore. Gather. Survive.</p>

        {/* Version badge */}
        <button
          onClick={() => setShowChangelog(v => !v)}
          className="text-slate-500 hover:text-slate-300 text-xs mb-10 transition-colors"
        >
          v{CURRENT_VERSION} · {CURRENT_DATE} · Changelog {showChangelog ? '▲' : '▼'}
        </button>

        {/* Changelog panel */}
        {showChangelog && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 mb-8 w-[480px] text-left max-h-[380px] overflow-y-auto">
            {CHANGELOG.map((entry, i) => (
              <div key={entry.version} className={i > 0 ? 'mt-5' : ''}>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className={`font-bold text-sm ${i === 0 ? 'text-green-400' : 'text-slate-300'}`}>
                    v{entry.version}
                  </span>
                  <span className="text-slate-500 text-xs">{entry.date}</span>
                  {i === 0 && (
                    <span className="text-xs bg-green-800 text-green-300 px-2 py-0.5 rounded-full">aktuell</span>
                  )}
                </div>
                <ul className="space-y-0.5">
                  {entry.changes.map((change, j) => (
                    <li key={j} className="text-slate-400 text-xs flex gap-2">
                      <span className="text-slate-600 shrink-0">–</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

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

      {showOptions   && <OptionsModal onClose={() => setShowOptions(false)} />}
    </div>
  );
}
