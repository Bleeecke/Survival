import { usePlayerStore } from '../../store/playerStore';
import { useGameStore } from '../../store/gameStore';
import { DAY_DURATION_MS } from '../../data/worldConfig';
import type { PlayerStats } from '../../types';
import ClockWidget from './ClockWidget';

export default function GameHUD() {
  const stats       = usePlayerStore(s => s.player.stats);
  const elapsedTime = useGameStore(s => s.elapsedTime);
  const day         = Math.floor(elapsedTime / DAY_DURATION_MS) + 1;

  return (
    <div className="flex-shrink-0 px-3 py-2 border-b border-slate-700 space-y-2">
      <ClockWidget elapsedMs={elapsedTime} day={day} />
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
