import { useState } from 'react';
import { musicManager } from '../../services/MusicManager';

interface Props {
  onClose: () => void;
}

function loadVolume() {
  const v = localStorage.getItem('survival-music-volume');
  return v !== null ? parseFloat(v) : 0.4;
}

function loadMuted() {
  return localStorage.getItem('survival-music-muted') === 'true';
}

export default function OptionsModal({ onClose }: Props) {
  const [volume, setVolume] = useState(loadVolume);
  const [muted, setMuted]   = useState(loadMuted);

  function handleVolume(v: number) {
    setVolume(v);
    localStorage.setItem('survival-music-volume', String(v));
    musicManager.setVolume(v);
    if (muted && v > 0) {
      setMuted(false);
      localStorage.setItem('survival-music-muted', 'false');
      musicManager.mute(false);
    }
  }

  function handleMute() {
    const next = !muted;
    setMuted(next);
    localStorage.setItem('survival-music-muted', String(next));
    musicManager.mute(next);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl w-80 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 px-6 py-5 flex items-center justify-between border-b border-slate-700">
          <h2 className="text-xl font-bold text-white tracking-wide">⚙️ Optionen</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Music section */}
          <div>
            <h3 className="text-slate-300 font-semibold text-sm uppercase tracking-widest mb-4">
              🎵 Musik
            </h3>

            {/* Volume slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Lautstärke</span>
                <span className="text-slate-300 font-mono">{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range" min={0} max={1} step={0.05}
                value={volume}
                disabled={muted}
                onChange={e => handleVolume(parseFloat(e.target.value))}
                className="w-full accent-amber-500 disabled:opacity-40"
              />
            </div>

            {/* Mute toggle */}
            <button
              onClick={handleMute}
              className={`mt-4 w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                muted
                  ? 'bg-red-800 hover:bg-red-700 text-red-200'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {muted ? '🔇 Stummgeschaltet — Klicken zum Aktivieren' : '🔊 Ton aktiv'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-green-700 hover:bg-green-600 text-white font-bold rounded-xl transition-colors text-sm"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
}
