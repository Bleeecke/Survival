import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { DAY_DURATION_MS } from '../../data/worldConfig';

const HOUR_MS = DAY_DURATION_MS / 24;

type Quality = 'cabin' | 'shelter' | 'spot' | 'outdoor';
type FadeState = 'idle' | 'fading-out' | 'black' | 'fading-in';

const DURATIONS = [2, 4, 6, 8, 10] as const;

const QUALITY_LABELS: Record<Quality, string> = {
  outdoor: '🌿 Blanker Boden',
  spot:    '🍃 Schlafplatz',
  shelter: '⛺ Palmendach',
  cabin:   '🏠 Unterkunft',
};

const QUALITY_COLORS: Record<Quality, string> = {
  outdoor: 'text-orange-400',
  spot:    'text-lime-400',
  shelter: 'text-sky-400',
  cabin:   'text-emerald-400',
};

function calcEffects(hours: number, quality: Quality, currentFatigue: number) {
  let newFatigue: number;
  let healthDelta: number;

  if (quality === 'outdoor') {
    newFatigue   = Math.max(10, currentFatigue - hours * 11);
    healthDelta  = -Math.min(10, hours);
  } else if (quality === 'spot') {
    newFatigue  = Math.max(8, currentFatigue - hours * 11.5);
    healthDelta = 0;
  } else if (quality === 'shelter') {
    newFatigue  = Math.max(5, currentFatigue - Math.min(hours, 8) * 12);
    healthDelta = 0;
  } else {
    // cabin
    newFatigue  = Math.max(0, currentFatigue - hours * 13);
    healthDelta = hours >= 8 ? +10 : 0;
  }

  const fatigueChange = currentFatigue - newFatigue; // positive = improved
  return { newFatigue, healthDelta, fatigueChange };
}

export default function SleepModal() {
  const setShowSleepMenu = useGameStore(s => s.setShowSleepMenu);
  const tickTime         = useGameStore(s => s.tickTime);
  const quality          = useGameStore(s => s.sleepQuality);
  const stats            = usePlayerStore(s => s.player.stats);
  const updateStats      = usePlayerStore(s => s.updateStats);

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
        fatigue:  newFatigue,
        health:   Math.min(100, Math.max(0, health + healthDelta)),
        stamina:  Math.min(100, stamina + hours * 8),
        hunger:   Math.min(100, hunger + hours * 1.5),
        thirst:   Math.min(100, thirst  + hours * 2.0),
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

  return (
    <>
      {!isSleeping && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl p-6 w-[420px]">

            {/* Header */}
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

            {/* Duration grid */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              {DURATIONS.map(h => {
                const { fatigueChange } = calcEffects(h, quality, fatigue);
                const isSelected = selected === h;
                return (
                  <button
                    key={h}
                    onClick={() => setSelected(isSelected ? null : h)}
                    className={`rounded-xl py-3 px-1 border text-center transition-colors ${
                      isSelected
                        ? 'bg-indigo-700 border-indigo-500'
                        : 'bg-slate-700 hover:bg-slate-600 border-slate-600'
                    }`}
                  >
                    <div className="text-white font-bold text-sm">{h}h</div>
                    <div className="text-slate-400 text-xs mt-1">
                      -{Math.round(fatigueChange)}%
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Preview */}
            {selected !== null && (() => {
              const { newFatigue, healthDelta, fatigueChange } = calcEffects(selected, quality, fatigue);
              const hungerIncrease = Math.round(selected * 1.5);
              const thirstIncrease = Math.round(selected * 2.0);
              return (
                <div className="bg-slate-900 rounded-xl px-4 py-3 mb-4 space-y-1.5 text-xs">
                  <div className="text-slate-400 font-semibold mb-2 uppercase tracking-widest text-xs">
                    Vorschau — {selected}h Schlaf
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
                    <span className={healthDelta > 0 ? 'text-green-400' : healthDelta < 0 ? 'text-red-400' : 'text-slate-500'}>
                      {healthDelta > 0 ? `+${healthDelta}` : healthDelta === 0 ? '±0' : healthDelta} HP
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
                  {quality === 'shelter' && selected > 8 && (
                    <div className="text-slate-500 italic pt-1">
                      Länger als 8h bringt im Unterschlupf keinen weiteren Nutzen
                    </div>
                  )}
                  {quality === 'cabin' && selected >= 8 && (
                    <div className="text-emerald-400 italic pt-1">
                      ✓ Voll erholt + Gesundheitsbonus
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Confirm button */}
            <button
              onClick={() => selected !== null && sleep(selected)}
              disabled={selected === null}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-colors mb-2 ${
                selected !== null
                  ? 'bg-indigo-700 hover:bg-indigo-600 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {selected !== null ? `${selected}h schlafen` : 'Dauer wählen'}
            </button>

            <button
              onClick={() => setShowSleepMenu(false)}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-xl text-sm transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Fade overlay */}
      {isSleeping && (
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
                <div className="text-slate-400 text-sm tracking-widest">Schlafe...</div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
