import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { usePlayerStore } from '../../store/playerStore';
import { DAY_DURATION_MS } from '../../data/worldConfig';
import { FOCUS_LABELS, FOCUS_ICONS } from '../../data/ideas';
import type { ReflectionFocus } from '../../data/ideas';

const HOUR_MS = DAY_DURATION_MS / 24;

function getCurrentHour(elapsedTime: number) {
  return Math.floor((elapsedTime % DAY_DURATION_MS) / HOUR_MS);
}

function isNight(hour: number) {
  return hour >= 20 || hour < 6;
}

/** Returns null if allowed, or a reason string if blocked */
function getSleepBlockReason(
  hours: number,
  hour: number,
  fatigue: number,
  health: number,
): string | null {
  const nap = hours <= 4;
  if (nap) {
    // Nickerchen: requires fatigue >= 35 (or injury/night)
    if (fatigue < 35 && health >= 50 && !isNight(hour)) {
      return 'Zu ausgeruht für ein Nickerchen';
    }
    return null;
  }
  // Full sleep: night, injured, or very tired
  if (!isNight(hour) && health >= 50 && fatigue < 65) {
    return isNight(hour) ? null : 'Zu früh — erst ab 20 Uhr oder bei Erschöpfung';
  }
  return null;
}

type Quality = 'cabin' | 'shelter' | 'spot' | 'outdoor';
type FadeState = 'idle' | 'fading-out' | 'black' | 'fading-in';
type Step = 'duration' | 'reflect';

const DURATIONS = [2, 4, 6, 8, 10] as const;

const QUALITY_LABELS: Record<Quality, string> = {
  outdoor: '🌿 Blanker Boden',
  spot:    '🍃 Provisorisches Blätterlager',
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
    newFatigue  = Math.max(9, currentFatigue - hours * 11.2);
    healthDelta = -Math.min(5, Math.floor(hours * 0.5)); // uncomfortable, small health cost
  } else if (quality === 'shelter') {
    newFatigue  = Math.max(5, currentFatigue - Math.min(hours, 8) * 12);
    healthDelta = 0;
  } else {
    newFatigue  = Math.max(0, currentFatigue - hours * 13);
    healthDelta = hours >= 8 ? +10 : 0;
  }

  const fatigueChange = currentFatigue - newFatigue;
  return { newFatigue, healthDelta, fatigueChange };
}

export default function SleepModal() {
  const setShowSleepMenu   = useGameStore(s => s.setShowSleepMenu);
  const tickTime           = useGameStore(s => s.tickTime);
  const quality            = useGameStore(s => s.sleepQuality);
  const campfireNear       = useGameStore(s => s.campfireNear);
  const elapsedTime        = useGameStore(s => s.elapsedTime);
  const stats              = usePlayerStore(s => s.player.stats);

  const currentHour = getCurrentHour(elapsedTime);
  const updateStats        = usePlayerStore(s => s.updateStats);
  const unlockedFocuses    = usePlayerStore(s => s.unlockedFocuses);
  const setReflectionFocus = usePlayerStore(s => s.setReflectionFocus);

  const [fadeState, setFadeState]   = useState<FadeState>('idle');
  const [selected, setSelected]     = useState<number | null>(null);
  const [step, setStep]             = useState<Step>('duration');
  const [chosenFocus, setChosenFocus] = useState<ReflectionFocus | null>(null);

  const fatigue = stats.fatigue ?? 0;
  const canReflect = campfireNear && selected !== null && selected >= 6;

  const fatigueLabel =
    fatigue < 20 ? 'Ausgeruht'           :
    fatigue < 45 ? 'Müdigkeit setzt ein' :
    fatigue < 65 ? 'Müde'                :
    fatigue < 80 ? 'Erschöpft'           :
    fatigue < 92 ? 'Übermüdet'           : '💤 Kollaps';

  function confirmDuration() {
    if (selected === null) return;
    if (canReflect) {
      setStep('reflect');
    } else {
      sleep(selected, null);
    }
  }

  function sleep(hours: number, focus: ReflectionFocus | null) {
    const health  = stats.health  ?? 100;
    const hunger  = stats.hunger  ?? 0;
    const thirst  = stats.thirst  ?? 0;
    const stamina = stats.stamina ?? 100;

    const { newFatigue, healthDelta } = calcEffects(hours, quality, fatigue);

    setReflectionFocus(focus);

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

  // ── Fade overlay ─────────────────────────────────────────────────────────
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
            {chosenFocus
              ? <div className="text-slate-400 text-sm tracking-widest">Grübelnd eingeschlafen…</div>
              : <div className="text-slate-400 text-sm tracking-widest">Schlafe…</div>
            }
          </div>
        </div>
      )}
    </div>
  );

  if (isSleeping) return <>{fadeOverlay}</>;

  // ── Step 2: Grübeln ───────────────────────────────────────────────────────
  if (step === 'reflect') {
    const urgentStats = [
      stats.thirst  > 65 && 'water',
      stats.hunger  > 65 && 'food',
      stats.health  < 40 && 'medicine',
    ].filter(Boolean) as ReflectionFocus[];

    return (
      <>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
        >
          <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl p-6 w-[440px]">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🔥</span>
              <div>
                <h2 className="text-white font-bold text-lg">Worüber willst du nachdenken?</h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Das Feuer knistert. Deine Gedanken kreisen um das Überleben.
                </p>
              </div>
            </div>

            <div className="space-y-2 mt-4 mb-4">
              {unlockedFocuses.map(focus => {
                const urgent = urgentStats.includes(focus);
                const isChosen = chosenFocus === focus;
                return (
                  <button
                    key={focus}
                    onClick={() => setChosenFocus(isChosen ? null : focus)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                      isChosen
                        ? 'bg-amber-800/60 border-amber-600'
                        : 'bg-slate-700 hover:bg-slate-600 border-slate-600'
                    }`}
                  >
                    <span className="text-xl">{FOCUS_ICONS[focus]}</span>
                    <div className="flex-1">
                      <span className="text-white text-sm font-medium">{FOCUS_LABELS[focus]}</span>
                      {urgent && (
                        <span className="ml-2 text-orange-400 text-xs font-bold">— dringend</span>
                      )}
                    </div>
                    {isChosen && <span className="text-amber-400 text-xs">✓ gewählt</span>}
                  </button>
                );
              })}

              {/* Skip option */}
              <button
                onClick={() => { setChosenFocus(null); sleep(selected!, null); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-left transition-colors"
              >
                <span className="text-xl">😴</span>
                <span className="text-slate-400 text-sm">Einfach schlafen</span>
              </button>
            </div>

            <button
              onClick={() => chosenFocus !== null && sleep(selected!, chosenFocus)}
              disabled={chosenFocus === null}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-colors ${
                chosenFocus !== null
                  ? 'bg-amber-700 hover:bg-amber-600 text-white'
                  : 'bg-slate-700 text-slate-500 cursor-not-allowed'
              }`}
            >
              {chosenFocus !== null
                ? `Mit Fokus "${FOCUS_LABELS[chosenFocus]}" schlafen`
                : 'Thema wählen'}
            </button>
          </div>
        </div>
        {fadeOverlay}
      </>
    );
  }

  // ── Step 1: Schlafdauer ───────────────────────────────────────────────────
  return (
    <>
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
                  {isNap && (
                    <div className="text-slate-500 text-[10px] mt-0.5">Nickerchen</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Time hint */}
          {!isNight(currentHour) && (
            <div className="text-slate-500 text-xs mb-3 flex items-center gap-1.5">
              <span>🕐</span>
              <span>
                {currentHour}:00 Uhr — Langer Schlaf erst ab 20 Uhr
                {fatigue >= 65 ? ' (oder bei starker Erschöpfung)' : ''}
              </span>
            </div>
          )}

          {/* Preview */}
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
                {canReflect && (
                  <div className="text-amber-400 italic pt-1 flex items-center gap-1">
                    🔥 Du kannst heute Nacht grübeln
                  </div>
                )}
              </div>
            );
          })()}

          {/* Confirm button */}
          <button
            onClick={confirmDuration}
            disabled={selected === null}
            className={`w-full py-3 rounded-xl font-bold text-sm transition-colors mb-2 ${
              selected !== null
                ? 'bg-indigo-700 hover:bg-indigo-600 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {selected === null
              ? 'Dauer wählen'
              : canReflect
                ? `${selected}h schlafen →`
                : `${selected}h schlafen`}
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
