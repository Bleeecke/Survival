import { usePlayerStore } from '../../store/playerStore';
import { useGameStore } from '../../store/gameStore';
import { DAY_DURATION_MS } from '../../data/worldConfig';
import ClockWidget from './ClockWidget';

// ── Hunger status ─────────────────────────────────────────────────
const HUNGER_LEVELS = [
  { max: 15,  label: 'Satt',         bar: 'bg-green-500',       text: 'text-green-400'  },
  { max: 30,  label: 'Zufrieden',    bar: 'bg-green-400',       text: 'text-green-300'  },
  { max: 55,  label: 'Hungrig',      bar: 'bg-yellow-500',      text: 'text-yellow-400' },
  { max: 75,  label: 'Sehr hungrig', bar: 'bg-orange-500',      text: 'text-orange-400' },
  { max: 90,  label: 'Ausgehungert', bar: 'bg-red-500',         text: 'text-red-400'    },
  { max: 100, label: 'Verhungernd',  bar: 'bg-red-700',         text: 'text-red-300'    },
] as const;

// ── Fatigue status ────────────────────────────────────────────────
const FATIGUE_LEVELS = [
  { max: 20,  label: 'Frisch',      bar: 'bg-violet-500',      text: 'text-violet-400' },
  { max: 40,  label: 'Ausgeruht',   bar: 'bg-violet-400',      text: 'text-violet-300' },
  { max: 60,  label: 'Etwas müde', bar: 'bg-yellow-500',      text: 'text-yellow-400' },
  { max: 80,  label: 'Müde',        bar: 'bg-orange-500',      text: 'text-orange-400' },
  { max: 90,  label: 'Sehr müde',   bar: 'bg-red-500',         text: 'text-red-400'    },
  { max: 100, label: 'Erschöpft',   bar: 'bg-red-700',         text: 'text-red-300'    },
] as const;

// ── Thirst status ─────────────────────────────────────────────────
const THIRST_LEVELS = [
  { max: 10,  label: 'Hydriert',      bar: 'bg-sky-500',         text: 'text-sky-400'   },
  { max: 25,  label: 'Erfrischt',     bar: 'bg-sky-400',         text: 'text-sky-300'   },
  { max: 50,  label: 'Durstig',       bar: 'bg-yellow-500',      text: 'text-yellow-400'},
  { max: 70,  label: 'Stark durstig', bar: 'bg-orange-500',      text: 'text-orange-400'},
  { max: 90,  label: 'Dehydriert',    bar: 'bg-red-500',         text: 'text-red-400'   },
  { max: 100, label: 'Verdurstend',   bar: 'bg-red-700',         text: 'text-red-300'   },
] as const;

function getHungerLevel(v: number) {
  return HUNGER_LEVELS.find(l => v <= l.max) ?? HUNGER_LEVELS[HUNGER_LEVELS.length - 1];
}
function getThirstLevel(v: number) {
  return THIRST_LEVELS.find(l => v <= l.max) ?? THIRST_LEVELS[THIRST_LEVELS.length - 1];
}
function getFatigueLevel(v: number) {
  return FATIGUE_LEVELS.find(l => v <= l.max) ?? FATIGUE_LEVELS[FATIGUE_LEVELS.length - 1];
}

export default function GameHUD() {
  const stats       = usePlayerStore(s => s.player.stats);
  const elapsedTime = useGameStore(s => s.elapsedTime);
  const setPaused   = useGameStore(s => s.setPaused);

  const day     = Math.floor(elapsedTime / DAY_DURATION_MS) + 1;
  const hunger  = stats.hunger  ?? 0;
  const thirst  = stats.thirst  ?? 0;
  const fatigue = stats.fatigue ?? 0;
  const hl      = getHungerLevel(hunger);
  const tl      = getThirstLevel(thirst);
  const fl      = getFatigueLevel(fatigue);

  // Stamina regen hint
  const staminaRegens = hunger < 31 && thirst < 26 && fatigue < 60;
  const staminaSlow   = !staminaRegens && (hunger < 56 && thirst < 51 && fatigue < 80);
  const staminaDrains = fatigue > 80;

  return (
    <div className="flex-shrink-0 border-b border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
        <span className="text-green-400 font-bold text-sm tracking-widest uppercase">Survival</span>
        <button
          onClick={() => setPaused(true)}
          className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
          title="Pause (Esc)"
        >
          <span>⏸</span>
          <span>Menu</span>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Clock */}
        <ClockWidget elapsedMs={elapsedTime} day={day} />

        {/* Stats */}
        <div className="space-y-2.5">

          {/* Health */}
          <SimpleBar
            label="Gesundheit"
            value={stats.health}
            barClass={
              stats.health > 60 ? 'bg-green-500' :
              stats.health > 30 ? 'bg-yellow-500' :
              stats.health > 15 ? 'bg-orange-500' : 'bg-red-600'
            }
            displayValue={`${Math.round(stats.health)}%`}
            warn={stats.health < 20}
          />

          {/* Stamina */}
          <div>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-slate-300">Ausdauer</span>
              <span className="text-slate-500 text-xs">
                {staminaDrains ? '↓ sinkt' : staminaRegens ? '↑ lädt auf' : staminaSlow ? '↑ langsam' : '—'}
              </span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 bg-blue-500"
                style={{ width: `${Math.max(0, stats.stamina)}%` }}
              />
            </div>
          </div>

          {/* Hunger – status label */}
          <StatusBar
            label="Hunger"
            value={100 - hunger}
            statusLabel={hl.label}
            statusTextClass={hl.text}
            barClass={hl.bar}
            warn={hunger > 75}
          />

          {/* Thirst – status label */}
          <StatusBar
            label="Durst"
            value={100 - thirst}
            statusLabel={tl.label}
            statusTextClass={tl.text}
            barClass={tl.bar}
            warn={thirst > 70}
          />

          {/* Fatigue – status label */}
          <StatusBar
            label="Müdigkeit"
            value={100 - fatigue}
            statusLabel={fl.label}
            statusTextClass={fl.text}
            barClass={fl.bar}
            warn={fatigue > 60}
          />

        </div>
      </div>
    </div>
  );
}

// ── Simple numeric bar (Health) ───────────────────────────────────
function SimpleBar({ label, value, barClass, displayValue, warn }: {
  label: string;
  value: number;
  barClass: string;
  displayValue: string;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className={warn ? 'text-red-400 font-semibold' : 'text-slate-300'}>{label}</span>
        <span className={warn ? 'text-red-400' : 'text-slate-500'}>{displayValue}</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

// ── Status-label bar (Hunger / Thirst) ───────────────────────────
function StatusBar({ label, value, statusLabel, statusTextClass, barClass, warn }: {
  label: string;
  value: number;   // 0-100, where 100 = full/hydrated
  statusLabel: string;
  statusTextClass: string;
  barClass: string;
  warn?: boolean;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline text-xs mb-0.5">
        <span className={warn ? 'text-red-400 font-semibold' : 'text-slate-400'}>{label}</span>
        <span className={`font-semibold ${statusTextClass} ${warn ? 'animate-pulse' : ''}`}>
          {statusLabel}
        </span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
