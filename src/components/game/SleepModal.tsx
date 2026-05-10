import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { DAY_DURATION_MS } from '../../data/worldConfig';

const HOUR_MS = DAY_DURATION_MS / 24;

type Quality = 'bed' | 'shelter' | 'outdoor';

interface SleepOption {
  id: string;
  quality: Quality;
  icon: string;
  label: string;
  hours: number;
  fatigueReduction: number; // how much fatigue is removed (0–100)
  fatigueResult?: number;   // fixed result value (overrides reduction)
  healthDelta: number;
  staminaBonus: number;
  desc: string;
  color: string;
}

const OPTIONS: SleepOption[] = [
  {
    id: 'nap',
    quality: 'outdoor',
    icon: '😴', label: 'Nickerchen',
    hours: 2,
    fatigueReduction: 20,
    healthDelta: 0,
    staminaBonus: 40,
    desc: '2h · Müdigkeit -20 · Ausdauer +40',
    color: 'bg-sky-900 hover:bg-sky-800 border-sky-700',
  },
  {
    id: 'bed',
    quality: 'bed',
    icon: '🛏️', label: 'Im Bett schlafen',
    hours: 6,
    fatigueResult: 0,
    fatigueReduction: 100,
    healthDelta: +10,
    staminaBonus: 60,
    desc: '6h · Müdigkeit voll erholt · Gesundheit +10',
    color: 'bg-emerald-800 hover:bg-emerald-700 border-emerald-600',
  },
  {
    id: 'shelter',
    quality: 'shelter',
    icon: '🏠', label: 'Im Unterschlupf schlafen',
    hours: 8,
    fatigueResult: 0,
    fatigueReduction: 100,
    healthDelta: 0,
    staminaBonus: 40,
    desc: '8h · Müdigkeit voll erholt · Gesundheit neutral',
    color: 'bg-slate-700 hover:bg-slate-600 border-slate-500',
  },
  {
    id: 'outdoor',
    quality: 'outdoor',
    icon: '🌿', label: 'Auf der Erde schlafen',
    hours: 8,
    fatigueResult: 0,
    fatigueReduction: 100,
    healthDelta: -10,
    staminaBonus: 25,
    desc: '8h · Müdigkeit voll erholt · Gesundheit -10',
    color: 'bg-slate-700 hover:bg-slate-600 border-orange-800',
  },
];

const QUALITY_ORDER: Quality[] = ['outdoor', 'shelter', 'bed'];
function qualityAtLeast(have: Quality, need: Quality) {
  return QUALITY_ORDER.indexOf(have) >= QUALITY_ORDER.indexOf(need);
}

type FadeState = 'idle' | 'fading-out' | 'black' | 'fading-in';

export default function SleepModal() {
  const setShowSleepMenu = useGameStore(s => s.setShowSleepMenu);
  const tickTime         = useGameStore(s => s.tickTime);
  const quality          = useGameStore(s => s.sleepQuality);
  const stats            = usePlayerStore(s => s.player.stats);
  const updateStats      = usePlayerStore(s => s.updateStats);

  const [fadeState, setFadeState] = useState<FadeState>('idle');

  function sleep(opt: SleepOption) {
    const hunger  = stats.hunger  ?? 0;
    const thirst  = stats.thirst  ?? 0;
    const health  = stats.health  ?? 100;
    const stamina = stats.stamina ?? 100;

    // Fade out
    setFadeState('fading-out');
    setTimeout(() => {
      setFadeState('black');

      // Apply effects while screen is black
      const newFatigue = opt.fatigueResult !== undefined
        ? opt.fatigueResult
        : Math.max(0, (stats.fatigue ?? 0) - opt.fatigueReduction);
      const newHealth  = Math.min(100, Math.max(0, health + opt.healthDelta));
      const newStamina = Math.min(100, stamina + opt.staminaBonus);
      const newHunger  = Math.min(100, hunger + opt.hours * 1.5);
      const newThirst  = Math.min(100, thirst  + opt.hours * 2.0);
      updateStats({
        fatigue:  newFatigue,
        health:   newHealth,
        stamina:  newStamina,
        hunger:   newHunger,
        thirst:   newThirst,
      });
      tickTime(opt.hours * HOUR_MS);

      // Fade in
      setTimeout(() => {
        setFadeState('fading-in');
        setTimeout(() => {
          setFadeState('idle');
          setShowSleepMenu(false);
        }, 1200);
      }, 300);
    }, 1200);
  }

  const fatigue = stats.fatigue ?? 0;
  const fatigueLabel =
    fatigue < 20 ? 'Frisch'     :
    fatigue < 40 ? 'Ausgeruht'  :
    fatigue < 60 ? 'Etwas müde' :
    fatigue < 80 ? 'Müde'       :
    fatigue < 90 ? 'Sehr müde'  : 'Erschöpft';

  const isSleeping = fadeState !== 'idle';

  return (
    <>
      {/* Sleep modal — hidden while fade animation runs */}
      {!isSleeping && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl p-6 w-96">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">💤</span>
              <div>
                <h2 className="text-white font-bold text-lg">Schlafen</h2>
                <p className="text-slate-400 text-xs">
                  Müdigkeit:{' '}
                  <span className={fatigue > 60 ? 'text-orange-400' : 'text-green-400'}>
                    {fatigueLabel} ({Math.round(fatigue)}%)
                  </span>
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {OPTIONS.map(opt => {
                const available = qualityAtLeast(quality, opt.quality);
                return (
                  <button
                    key={opt.quality}
                    onClick={() => available && sleep(opt)}
                    disabled={!available}
                    className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors text-left ${
                      available
                        ? opt.color
                        : 'bg-slate-800 border-slate-700 opacity-40 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-2xl">{opt.icon}</span>
                    <div className="flex-1">
                      <div className="text-white font-semibold text-sm">{opt.label}</div>
                      <div className="text-slate-300 text-xs mt-0.5">{opt.desc}</div>
                      {!available && (
                        <div className="text-orange-400 text-xs">Nicht verfügbar</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setShowSleepMenu(false)}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Full-screen fade overlay */}
      {isSleeping && (
        <div
          className="fixed inset-0 z-[999] bg-black pointer-events-none"
          style={{
            opacity:
              fadeState === 'fading-out' ? 0 :
              fadeState === 'black'      ? 1 :
              fadeState === 'fading-in'  ? 0 : 0,
            transition:
              fadeState === 'fading-out' ? 'opacity 1.2s ease-in'  :
              fadeState === 'fading-in'  ? 'opacity 1.2s ease-out' : 'none',
          }}
        >
          {/* Small sleep indicator in center while black */}
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
