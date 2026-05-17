import { Component } from 'react';
import type { ReactNode } from 'react';
import { useGameStore } from './store/gameStore';
import { useMusic } from './hooks/useMusic';
import { useWorldStore } from './store/worldStore';
import MainMenu from './components/pages/MainMenu';
import GameScreen from './components/pages/GameScreen';
import DeathScreen from './components/pages/DeathScreen';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div className="flex flex-col items-center justify-center w-full min-h-screen bg-slate-900 p-8 gap-4">
          <div className="text-red-400 font-bold text-lg">Fehler beim Laden</div>
          <pre className="text-red-300 text-xs bg-slate-800 p-4 rounded-lg max-w-2xl w-full overflow-auto whitespace-pre-wrap">
            {err.message}{'\n'}{err.stack}
          </pre>
          <button
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            className="px-6 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm font-bold"
          >
            Spielstand löschen &amp; neu starten
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  useMusic();
  const rawPhase = useGameStore((s) => s.phase);
  const world    = useWorldStore((s) => s.world);

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

export default function AppWithBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
