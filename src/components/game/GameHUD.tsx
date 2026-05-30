import { usePlayerStore } from '../../store/playerStore';
import { useGameStore } from '../../store/gameStore';
import { useJournalStore } from '../../store/journalStore';
import { DAY_DURATION_MS } from '../../data/worldConfig';
import type { PlayerStats } from '../../types';
import ClockWidget from './ClockWidget';

export default function GameHUD() {
  const stats        = usePlayerStore(s => s.player.stats);
  const elapsedTime  = useGameStore(s => s.elapsedTime);
  const day          = Math.floor(elapsedTime / DAY_DURATION_MS) + 1;
  const pendingCount = useJournalStore(s => s.pending.length);
  const openJournal  = useJournalStore(s => s.openJournal);

  return (
    <div className="flex-shrink-0 px-3 py-2 border-b border-slate-700 space-y-2">
      <div className="flex items-center justify-between">
        <ClockWidget elapsedMs={elapsedTime} day={day} />
        <button
          onClick={openJournal}
          className="relative flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-800/40 rounded-lg text-amber-300 text-xs font-semibold transition-colors"
        >
          <span>📖</span>
          <span className="hidden sm:inline">Journal</span>
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-600 rounded-full text-[9px] text-white font-bold flex items-center justify-center animate-pulse">
              {pendingCount}
            </span>
          )}
        </button>
      </div>
      <DiseasePanel stats={stats} />
    </div>
  );
}

// ── Active disease indicator ──────────────────────────────────────
function DiseasePanel({ stats }: { stats: PlayerStats }) {
  const now = Date.now();
  const diseases: { icon: string; label: string; color: string; cure: string }[] = [];

  if ((stats.bleedingUntil ?? 0) > now)
    diseases.push({ icon: '🩸', label: 'Blutung', color: 'text-red-400', cure: 'Verband' });
  if ((stats.woundedUntil ?? 0) > now)
    diseases.push({ icon: '🩹', label: 'Schnittwunde', color: 'text-orange-300', cure: 'Verband / Kräuter' });
  if ((stats.coldUntil ?? 0) > now)
    diseases.push({ icon: '🤧', label: 'Erkältung', color: 'text-sky-300', cure: 'Fiebertee' });
  if ((stats.feverUntil ?? 0) > now)
    diseases.push({ icon: '🌡️', label: 'Fieber', color: 'text-orange-300', cure: 'Fiebertee' });
  if ((stats.parasitesUntil ?? 0) > now)
    diseases.push({ icon: '🦠', label: 'Parasiten', color: 'text-purple-300', cure: 'Parasitenmedizin' });
  if ((stats.poisonedUntil ?? 0) > now)
    diseases.push({ icon: '☠️', label: 'Vergiftung', color: 'text-red-300', cure: 'Kräutermittel' });

  if (diseases.length === 0) return null;

  return (
    <div className="mx-4 mb-3 bg-red-950/60 border border-red-800/60 rounded-lg px-3 py-2 space-y-1">
      <div className="text-red-400 text-[10px] font-semibold uppercase tracking-wider">Krankheiten</div>
      {diseases.map(d => (
        <div key={d.label} className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${d.color} animate-pulse`}>{d.icon} {d.label}</span>
          <span className="text-slate-500 text-[10px]">→ {d.cure}</span>
        </div>
      ))}
    </div>
  );
}
