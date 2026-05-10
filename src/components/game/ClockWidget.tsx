import { DAY_DURATION_MS } from '../../data/worldConfig';

const W = 220;
const H = 80;
const GROUND_Y = H - 6;

// Quadratic bezier: sun/moon path across the sky
function arcPoint(t: number) {
  const p0 = [10, GROUND_Y];
  const p1 = [W / 2, 2];
  const p2 = [W - 10, GROUND_Y];
  const mt = 1 - t;
  return {
    x: mt * mt * p0[0] + 2 * mt * t * p1[0] + t * t * p2[0],
    y: mt * mt * p0[1] + 2 * mt * t * p1[1] + t * t * p2[1],
  };
}

function getSkyGradient(fh: number): [string, string, string] {
  if (fh < 5 || fh >= 22)  return ['#03030f', '#07071e', '#0d0d30'];
  if (fh < 6.5)            return ['#1a0830', '#8b2500', '#e05010'];
  if (fh < 8)              return ['#1a4a8a', '#c46010', '#f9a040'];
  if (fh < 17)             return ['#0e50b0', '#1878d4', '#6eb8f0'];
  if (fh < 18.5)           return ['#1a1040', '#b04018', '#e06828'];
  if (fh < 21)             return ['#0a0620', '#4a1a38', '#801e38'];
  return ['#03030f', '#07071e', '#0d0d30'];
}

// Deterministic star positions
const STARS = [
  [0.05, 0.18], [0.14, 0.45], [0.22, 0.12], [0.31, 0.52], [0.40, 0.08],
  [0.48, 0.40], [0.56, 0.20], [0.64, 0.55], [0.72, 0.10], [0.80, 0.48],
  [0.88, 0.22], [0.94, 0.38], [0.10, 0.60], [0.60, 0.65], [0.35, 0.30],
];

export default function ClockWidget({ elapsedMs, day }: { elapsedMs: number; day: number }) {
  const dayMs = elapsedMs % DAY_DURATION_MS;
  const fh = (dayMs / DAY_DURATION_MS) * 24; // fractional hours 0-24

  const hours = Math.floor(fh);
  const mins = Math.floor((fh - hours) * 60);
  const timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;

  // Sun: rises 6, sets 19 (visible for 13 hours)
  const sunVisible = fh >= 6 && fh < 19;
  const sunT = Math.max(0, Math.min(1, (fh - 6) / 13));
  const sunPos = arcPoint(sunT);

  // Moon: rises 19, sets 7 next day
  const moonVisible = fh >= 19 || fh < 7;
  const moonT = fh >= 19 ? (fh - 19) / 12 : (fh + 5) / 12;
  const moonPos = arcPoint(Math.max(0, Math.min(1, moonT)));

  const isNight = fh < 6 || fh >= 20;
  const isDawnDusk = (fh >= 5 && fh < 8) || (fh >= 17 && fh < 22);
  const showStars = isNight || isDawnDusk;
  const starOpacity = isNight ? 0.9 : 0.35;

  const [skyTop, skyMid, skyBot] = getSkyGradient(fh);

  let phase = 'Day';
  let phaseClass = 'text-yellow-200';
  if (fh < 5 || fh >= 22)       { phase = 'Night'; phaseClass = 'text-blue-300'; }
  else if (fh < 8)              { phase = 'Dawn';  phaseClass = 'text-orange-300'; }
  else if (fh < 17)             { phase = 'Day';   phaseClass = 'text-yellow-200'; }
  else if (fh < 22)             { phase = 'Dusk';  phaseClass = 'text-orange-400'; }

  const SUN_RAYS = [0, 45, 90, 135];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg"
        style={{ display: 'block', background: 'black' }}
      >
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={skyTop} />
            <stop offset="60%"  stopColor={skyMid} />
            <stop offset="100%" stopColor={skyBot} />
          </linearGradient>
          {/* Horizon glow for dawn/dusk */}
          {isDawnDusk && (
            <radialGradient id="horizGlow" cx="50%" cy="100%" r="60%">
              <stop offset="0%"   stopColor="#ff8040" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#ff8040" stopOpacity="0" />
            </radialGradient>
          )}
          {/* Sun glow */}
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ffd700" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
          </radialGradient>
          {/* Moon glow */}
          <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#c8d8ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#c8d8ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Sky background */}
        <rect width={W} height={H} fill="url(#skyGrad)" />

        {/* Horizon glow */}
        {isDawnDusk && <rect width={W} height={H} fill="url(#horizGlow)" />}

        {/* Stars */}
        {showStars && STARS.map(([sx, sy], i) => (
          <circle
            key={i}
            cx={sx * W}
            cy={sy * (GROUND_Y - 10)}
            r={i % 3 === 0 ? 1.4 : 0.9}
            fill="white"
            opacity={starOpacity * (i % 5 === 0 ? 1 : 0.7)}
          />
        ))}

        {/* Orbit arc (dotted) */}
        <path
          d={`M 10 ${GROUND_Y} Q ${W / 2} 2 ${W - 10} ${GROUND_Y}`}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          strokeDasharray="3 5"
          fill="none"
        />

        {/* === SUN === */}
        {sunVisible && (
          <g transform={`translate(${sunPos.x.toFixed(1)},${sunPos.y.toFixed(1)})`}>
            {/* Outer glow */}
            <circle r="18" fill="url(#sunGlow)" />
            {/* Rays - long */}
            {SUN_RAYS.map(deg => {
              const r = (deg * Math.PI) / 180;
              const cos = Math.cos(r), sin = Math.sin(r);
              return (
                <g key={deg}>
                  <line x1={cos * 10} y1={sin * 10} x2={cos * 15} y2={sin * 15}
                    stroke="#ffd700" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
                  <line x1={-cos * 10} y1={-sin * 10} x2={-cos * 15} y2={-sin * 15}
                    stroke="#ffd700" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
                </g>
              );
            })}
            {/* Rays - short diagonal */}
            {SUN_RAYS.map(deg => {
              const r = ((deg + 22.5) * Math.PI) / 180;
              const cos = Math.cos(r), sin = Math.sin(r);
              return (
                <g key={`s${deg}`}>
                  <line x1={cos * 9} y1={sin * 9} x2={cos * 12} y2={sin * 12}
                    stroke="#ffc000" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                  <line x1={-cos * 9} y1={-sin * 9} x2={-cos * 12} y2={-sin * 12}
                    stroke="#ffc000" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
                </g>
              );
            })}
            {/* Sun body */}
            <circle r="8" fill="#ff9500" />
            <circle r="6.5" fill="#ffd000" />
            <circle r="5" fill="#ffe840" />
            {/* Highlight */}
            <circle r="2" cx="-2" cy="-2" fill="rgba(255,255,200,0.5)" />
          </g>
        )}

        {/* === MOON === */}
        {moonVisible && (
          <g transform={`translate(${moonPos.x.toFixed(1)},${moonPos.y.toFixed(1)})`}>
            {/* Glow */}
            <circle r="16" fill="url(#moonGlow)" />
            {/* Moon body */}
            <circle r="7" fill="#d0dfff" />
            {/* Crescent shadow */}
            <circle r="6" cx="3" cy="-2" fill={skyTop} opacity="0.88" />
            {/* Crater details */}
            <circle r="1.2" cx="-2.5" cy="1.5" fill="#a8b8d0" opacity="0.6" />
            <circle r="0.7" cx="-1" cy="4"    fill="#a8b8d0" opacity="0.5" />
            <circle r="0.5" cx="-4" cy="-1"   fill="#a8b8d0" opacity="0.4" />
          </g>
        )}

        {/* Ground strip */}
        <rect x="0" y={GROUND_Y - 1} width={W} height="7" fill="#1c3a1e" />
        <rect x="0" y={GROUND_Y - 1} width={W} height="2" fill="#2d5c30" />

        {/* Time text */}
        <text
          x={W / 2} y={H - 9}
          textAnchor="middle"
          fill="rgba(255,255,255,0.85)"
          fontSize="8.5"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {timeStr}
        </text>
      </svg>

      <div className="flex justify-between items-center mt-1 px-0.5">
        <span className="text-slate-500 text-xs">Day {day}</span>
        <span className={`text-xs font-semibold ${phaseClass}`}>{phase}</span>
      </div>
    </div>
  );
}
