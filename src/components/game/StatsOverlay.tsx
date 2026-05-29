import { usePlayerStore } from '../../store/playerStore';

const HUNGER_LABEL  = (v: number) => v <= 15 ? 'Satt' : v <= 30 ? 'Zufrieden' : v <= 55 ? 'Hungrig' : v <= 75 ? 'Sehr hungrig' : v <= 90 ? 'Ausgehungert' : 'Verhungernd';
const THIRST_LABEL  = (v: number) => v <= 10 ? 'Hydriert' : v <= 25 ? 'Erfrischt' : v <= 50 ? 'Durstig' : v <= 70 ? 'Stark durstig' : v <= 90 ? 'Dehydriert' : 'Verdurstend';
const FATIGUE_LABEL = (v: number) => v <= 20 ? 'Ausgeruht' : v <= 45 ? 'Müde werdend' : v <= 65 ? 'Müde' : v <= 80 ? 'Erschöpft' : v <= 92 ? 'Übermüdet' : 'Kollaps';

const HUNGER_COLOR  = (v: number) => v <= 30 ? 'bg-green-500' : v <= 55 ? 'bg-yellow-500' : v <= 80 ? 'bg-orange-500' : 'bg-red-600';
const THIRST_COLOR  = (v: number) => v <= 25 ? 'bg-sky-500'   : v <= 50 ? 'bg-yellow-500' : v <= 80 ? 'bg-orange-500' : 'bg-red-600';
const FATIGUE_COLOR = (v: number) => v <= 20 ? 'bg-violet-500': v <= 65 ? 'bg-yellow-500' : v <= 85 ? 'bg-orange-500' : 'bg-red-700';

function StatRow({ icon, label, pct, barColor, warn }: {
  icon: string; label: string; pct: number; barColor: string; warn?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 flex-1">
      <span className="text-sm w-5 text-center leading-none">{icon}</span>
      <div className="flex flex-col gap-0.5 flex-1">
        <div className="flex justify-between items-baseline">
          <span className={`font-semibold leading-none ${warn ? 'text-red-400' : 'text-slate-200'}`} style={{ fontSize: 10 }}>
            {label}
          </span>
          <span className={`tabular-nums leading-none ${warn ? 'text-red-400' : 'text-slate-400'}`} style={{ fontSize: 10 }}>
            {Math.round(pct)}%
          </span>
        </div>
        <div className="w-full bg-slate-700/80 rounded-full overflow-hidden" style={{ height: 5 }}>
          <div className={`h-full rounded-full transition-all duration-300 ${barColor}`}
               style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function StatsOverlay() {
  const stats  = usePlayerStore(s => s.player.stats);
  const hunger  = stats.hunger  ?? 0;
  const thirst  = stats.thirst  ?? 0;
  const fatigue = stats.fatigue ?? 0;

  const healthColor = stats.health > 60 ? 'bg-green-500' : stats.health > 30 ? 'bg-yellow-500' : stats.health > 15 ? 'bg-orange-500' : 'bg-red-600';

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none select-none"
         style={{ width: 'min(680px, 72vw)' }}>
      <div className="bg-black/70 border border-slate-700/60 rounded-xl px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-4">

          <StatRow icon="❤️" label="Gesundheit" pct={stats.health} barColor={healthColor} warn={stats.health < 20} />
          <div className="w-px self-stretch bg-slate-600/50" />
          <StatRow icon="⚡" label="Ausdauer" pct={stats.stamina} barColor="bg-blue-500" />
          <div className="w-px self-stretch bg-slate-600/50" />
          <StatRow icon="🍖" label={HUNGER_LABEL(hunger)} pct={100 - hunger} barColor={HUNGER_COLOR(hunger)} warn={hunger > 80} />
          <div className="w-px self-stretch bg-slate-600/50" />
          <StatRow icon="💧" label={THIRST_LABEL(thirst)} pct={100 - thirst} barColor={THIRST_COLOR(thirst)} warn={thirst > 75} />
          <div className="w-px self-stretch bg-slate-600/50" />
          <StatRow icon="😴" label={FATIGUE_LABEL(fatigue)} pct={100 - fatigue} barColor={FATIGUE_COLOR(fatigue)} warn={fatigue > 75} />

        </div>
      </div>
    </div>
  );
}
