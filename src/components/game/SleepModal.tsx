import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { DAY_DURATION_MS } from '../../data/worldConfig';

const HOUR_MS = DAY_DURATION_MS / 24;

function getCurrentHour(elapsedTime: number) {
  return Math.floor((elapsedTime % DAY_DURATION_MS) / HOUR_MS);
}

function isNight(hour: number) {
  return hour >= 20 || hour < 6;
}

function getSleepBlockReason(hours: number, hour: number, fatigue: number, health: number): string | null {
  const nap = hours <= 4;
  if (nap) {
    if (fatigue < 35 && health >= 50 && !isNight(hour)) return 'Zu ausgeruht für ein Nickerchen';
    return null;
  }
  if (!isNight(hour) && health >= 50 && fatigue < 65) return 'Zu früh — erst ab 20 Uhr oder bei Erschöpfung';
  return null;
}

type Quality = 'cabin' | 'shelter' | 'spot' | 'outdoor';
type FadeState = 'idle' | 'fading-out' | 'black' | 'fading-in';

const DURATIONS = [2, 4, 6, 8, 10] as const;

const QUALITY_LABELS: Record<Quality, string> = {
  outdoor: '🌿 Blanker Boden',
  spot:    '🍃 Provisorisches Blätterlager',
  shelter: '⛺ Palmendach',
  cabin:   '🏠 Unterkunft',
};

const QUALITY_COLORS: Record<Quality, string> = {
  outdoor: 'text-red-400',
  spot:    'text-orange-400',
  shelter: 'text-amber-400',
  cabin:   'text-green-400',
};

function calcEffects(hours: number, quality: Quality, fatigue: number) {
  const baseRestore: Record<Quality, number> = { outdoor: 0.35, spot: 0.50, shelter: 0.70, cabin: 0.90 };
  const rate = baseRestore[quality];
  const fatigueChange = Math.min(fatigue, hours * (100 / 8) * rate);
  const newFatigue = Math.max(0, fatigue - fatigueChange);
  const healthDelta = quality === 'cabin' && hours >= 8 ? 15 : quality === 'shelter' && hours >= 8 ? 5 : 0;
  return { fatigueChange, newFatigue, healthDelta };
}

export default function SleepModal() {
  const setShowSleepMenu = useGameStore(s => s.setShowSleepMenu);
  const tickTime         = useGameStore(s => s.tickTime);
  const quality          = useGameStore(s => s.sleepQuality);
  const elapsedTime      = useGameStore(s => s.elapsedTime);
  const stats            = usePlayerStore(s => s.player.stats);
  const updateStats      = usePlayerStore(s => s.updateStats);

  const currentHour = getCurrentHour(elapsedTime);
  const [fadeState, setFadeState] = useState<FadeState>('idle');
  const [selected, setSelected]   = useState<number | null>(null);

  const fatigue = stats.fatigue ?? 0;

  const fatigueLabel =
    fatigue < 20 ? 'Ausgeruht'           :
    fatigue < 45 ? 'Müdigkeit setzt ein' :
    fatigue < 65 ? 'Müde'                :
    fatigue < 80 ? 'Erschöpft'           :
    fatigue < 92 ? 'Übermüdet'           : '💤 Kollaps';

  function sleep(hours: number) {
    const health  = stats.health  ?? 100;
    const hunger  = stats.hunger  ?? 0;
    const thirst  = stats.thirst  ?? 0;
    const stamina = stats.stamina ?? 100;
    const { newFatigue, healthDelta } = calcEffects(hours, quality, fatigue);

    setFadeState('fading-out');
    setTimeout(() => {
      setFadeState('black');
      updateStats({
        fatigue: newFatigue,
        health:  Math.min(100, Math.max(0, health + healthDelta)),
        stamina: Math.min(100, stamina + hours * 8),
        hunger:  Math.min(100, hunger + hours * 1.5),
        thirst:  Math.min(100, thirst  + hours * 2.0),
      });
      tickTime(hours * HOUR_MS);
      setTimeout(() => {
        setFadeState('fading-in');
        setTimeout(() => {
          setFadeState('idle');
          setShowSleepMenu(false);
        }, 1200);
      }, 400);
    }, 1200);
  }

  const isSleeping = fadeState !== 'idle';

  const fadeOverlay = isSleeping && (
    <div
      className="fixed inset-0 z-[999] bg-black pointer-events-none"
      style={{
        opacity:    fadeState === 'black' ? 1 : 0,
        transition: fadeState === 'fading-out' ? 'opacity 1.2s ease-in' :
                    fadeState === 'fading-in'  ? 'opacity 1.2s ease-out' : 'none',
      }}
    >
      {fadeState === 'black' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-3">💤</div>
            <div className="text-slate-400 text-sm tracking-widest">Schlafe…</div>
          </div>
        </div>
      )}
    </div>
  );

  if (isSleeping) return <>{fadeOverlay}</>;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}
      >
        <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl p-6 w-[420px]">

          <div className="flex items-center gap-3 mb-5">
            <span className="text-3xl">💤</span>
            <div>
              <h2 className="text-white font-bold text-lg">Schlafen</h2>
              <div className="flex items-center gap-3 text-xs mt-0.5">
                <span className={QUALITY_COLORS[quality]}>{QUALITY_LABELS[quality]}</span>
                <span className="text-slate-500">·</span>
                <span className={fatigue > 65 ? 'text-orange-400' : 'text-slate-400'}>
                  {fatigueLabel} ({Math.round(fatigue)}%)
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-4">
            {DURATIONS.map(h => {
              const { fatigueChange } = calcEffects(h, quality, fatigue);
              const isSelected = selected === h;
              const isNap = h <= 4;
              const blockReason = getSleepBlockReason(h, currentHour, fatigue, stats.health ?? 100);
              const blocked = blockReason !== null;
              return (
                <button
                  key={h}
                  onClick={() => !blocked && setSelected(isSelected ? null : h)}
                  title={blockReason ?? undefined}
                  className={`rounded-xl py-3 px-1 border text-center transition-colors ${
                    blocked
                      ? 'bg-slate-800 border-slate-700 opacity-40 cursor-not-allowed'
                      : isSelected
                        ? 'bg-indigo-700 border-indigo-500'
                        : 'bg-slate-700 hover:bg-slate-600 border-slate-600'
                  }`}
                >
                  <div className={`font-bold text-sm ${blocked ? 'text-slate-500' : 'text-white'}`}>{h}h</div>
                  <div className="text-slate-400 text-xs mt-1">
                    {blocked ? '—' : `-${Math.round(fatigueChange)}%`}
                  </div>
                  {isNap && <div className="text-slate-500 text-[10px] mt-0.5">Nickerchen</div>}
                </button>
              );
            })}
          </div>

          {!isNight(currentHour) && (
            <div className="text-slate-500 text-xs mb-3 flex items-center gap-1.5">
              <span>🕐</span>
              <span>
                {currentHour}:00 Uhr — Langer Schlaf erst ab 20 Uhr
                {fatigue >= 65 ? ' (oder bei starker Erschöpfung)' : ''}
              </span>
            </div>
          )}

          {selected !== null && (() => {
            const { newFatigue, healthDelta, fatigueChange } = calcEffects(selected, quality, fatigue);
            const hungerIncrease = Math.round(selected * 1.5);
            const thirstIncrease = Math.round(selected * 2.0);
            return (
              <div className="bg-slate-900 rounded-xl px-4 py-3 mb-4 space-y-1.5 text-xs">
                <div className="text-slate-400 font-semibold mb-2 uppercase tracking-widest text-xs">
                  Vorschau — {selected}h {selected <= 4 ? 'Nickerchen' : 'Schlaf'}
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Müdigkeit</span>
                  <span className="text-violet-400">
                    {Math.round(fatigue)}% → {Math.round(newFatigue)}%
                    <span className="text-green-400 ml-1">(-{Math.round(fatigueChange)}%)</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Gesundheit</span>
                  <span className={healthDelta > 0 ? 'text-green-400' : 'text-slate-500'}>
                    {healthDelta > 0 ? `+${healthDelta}` : '±0'} HP
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Hunger</span>
                  <span className="text-orange-400">+{hungerIncrease}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Durst</span>
                  <span className="text-sky-400">+{thirstIncrease}%</span>
                </div>
                {quality === 'cabin' && selected >= 8 && (
                  <div className="text-emerald-400 italic pt-1">✓ Voll erholt + Gesundheitsbonus</div>
                )}
              </div>
            );
          })()}

          <button
            onClick={() => selected !== null && sleep(selected)}
            disabled={selected === null}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-colors mb-2 ${
              selected !== null
                ? 'bg-indigo-700 hover:bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {selected === null ? 'Dauer wählen' : `${selected}h schlafen`}
          </button>

          <button
            onClick={() => setShowSleepMenu(false)}
            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-xl text-sm transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
      {fadeOverlay}
    </>
  );
}
