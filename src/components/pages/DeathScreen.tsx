import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';

export default function DeathScreen() {
  const reset = useGameStore(s => s.reset);
  const resetPlayer = usePlayerStore(s => s.reset);
  const resetWorld = useWorldStore(s => s.reset);
  const score = useGameStore(s => s.score);
  const elapsedTime = useGameStore(s => s.elapsedTime);

  const survivedMin = Math.floor(elapsedTime / 60_000);

  // Top-5 leaderboard in localStorage
  const [board] = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('survival-scores') ?? '[]'); } catch { return []; }
  });
  const finalScore = Math.floor(score);
  const newBoard = [...board, finalScore].sort((a, b) => b - a).slice(0, 5);
  localStorage.setItem('survival-scores', JSON.stringify(newBoard));

  function handleRestart() {
    resetPlayer();
    resetWorld();
    reset();
  }

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-screen bg-slate-900 gap-4">
      <h1 className="text-5xl font-bold text-red-500">Du bist gestorben</h1>
      <p className="text-slate-300 text-lg">
        Du hast {survivedMin} Minuten überlebt.
      </p>
      <p className="text-amber-400 text-3xl font-bold">Score: {finalScore.toLocaleString()}</p>

      {newBoard.length > 0 && (
        <div className="bg-slate-800 rounded-xl px-8 py-4 mt-2">
          <h2 className="text-slate-400 text-sm font-bold mb-2 text-center">TOP 5</h2>
          {newBoard.map((s, i) => (
            <div key={i} className={`flex justify-between gap-8 text-sm ${s === finalScore && i === newBoard.indexOf(finalScore) ? 'text-amber-300 font-bold' : 'text-slate-300'}`}>
              <span>#{i + 1}</span><span>{s.toLocaleString()} Punkte</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleRestart}
        className="mt-4 px-8 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg transition-colors text-lg"
      >
        Nochmal versuchen
      </button>
    </div>
  );
}
