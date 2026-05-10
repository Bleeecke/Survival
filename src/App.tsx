import { useGameStore } from './store/gameStore';
import { useWorldStore } from './store/worldStore';
import MainMenu from './components/pages/MainMenu';
import GameScreen from './components/pages/GameScreen';
import DeathScreen from './components/pages/DeathScreen';

function App() {
  const rawPhase = useGameStore((s) => s.phase);
  const world    = useWorldStore((s) => s.world);

  // Synchronous guard: if persisted phase is 'playing' but world is missing
  // (e.g. after a crash), treat it as 'menu' so Phaser never starts.
  const phase = (rawPhase === 'playing' || rawPhase === 'paused') && !world
    ? 'menu'
    : rawPhase;

  return (
    <div className="w-full min-h-screen bg-slate-900">
      {phase === 'menu' && <MainMenu />}
      {(phase === 'playing' || phase === 'paused') && <GameScreen />}
      {phase === 'dead' && <DeathScreen />}
      {phase === 'loading' && (
        <div className="flex items-center justify-center w-full min-h-screen">
          <div className="text-2xl text-white">Loading...</div>
        </div>
      )}
    </div>
  );
}

export default App;
