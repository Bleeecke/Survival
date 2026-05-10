import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { musicManager } from '../../services/MusicManager';

export default function PauseMenu() {
  const setPaused = useGameStore(s => s.setPaused);
  const setPhase  = useGameStore(s => s.setPhase);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [volume, setVolume] = useState(() => musicManager.volume);

  function handleResume() {
    setPaused(false);
  }

  function handleSave() {
    setSaveState('saving');
    // Zustand persist syncs to localStorage on every change automatically.
    // We just force a tiny state touch so the persist middleware flushes.
    useGameStore.getState().tickTime(0);
    setTimeout(() => setSaveState('done'), 400);
    setTimeout(() => setSaveState('idle'), 2200);
  }

  function handleMainMenu() {
    setPaused(false);
    setPhase('menu');
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50"
         style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(2px)' }}>
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-72 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 text-center border-b border-slate-700">
          <div className="text-3xl mb-1">⏸</div>
          <h2 className="text-2xl font-bold text-white tracking-wide">Paused</h2>
          <p className="text-slate-400 text-xs mt-1">Your progress is safe</p>
        </div>

        {/* Buttons */}
        <div className="p-5 space-y-3">
          <button
            onClick={handleResume}
            className="w-full py-3 bg-green-700 hover:bg-green-600 active:bg-green-800 text-white font-bold rounded-xl transition-colors text-sm tracking-wide"
          >
            ▶  Resume Game
          </button>

          <button
            onClick={handleSave}
            disabled={saveState !== 'idle'}
            className={`w-full py-3 font-bold rounded-xl transition-all text-sm tracking-wide ${
              saveState === 'done'
                ? 'bg-blue-900 text-blue-300 cursor-default'
                : saveState === 'saving'
                ? 'bg-blue-800 text-blue-200 cursor-wait'
                : 'bg-blue-700 hover:bg-blue-600 active:bg-blue-800 text-white'
            }`}
          >
            {saveState === 'saving' && '💾  Saving…'}
            {saveState === 'done'   && '✓  Saved!'}
            {saveState === 'idle'   && '💾  Save Game'}
          </button>

          <div className="border-t border-slate-700 pt-3 space-y-3">
            {/* Volume slider */}
            <div className="flex items-center gap-3 px-1">
              <span className="text-slate-400 text-sm">🎵</span>
              <input
                type="range" min={0} max={1} step={0.05}
                value={volume}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  musicManager.setVolume(v);
                }}
                className="flex-1 accent-amber-500"
              />
              <span className="text-slate-400 text-xs w-8 text-right">{Math.round(volume * 100)}%</span>
            </div>

            <button
              onClick={handleMainMenu}
              className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 active:bg-slate-900 text-slate-300 hover:text-white font-semibold rounded-xl transition-colors text-sm"
            >
              ← Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
