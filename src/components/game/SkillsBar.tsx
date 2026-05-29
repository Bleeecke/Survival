import { usePlayerStore } from '../../store/playerStore';
import { SKILL_IDS, SKILL_LABELS, DEFAULT_SKILLS } from '../../types/skills';

const SKILL_ICONS: Record<string, string> = {
  flintknapping:   '🪨',
  woodworking:     '🪵',
  cordage:         '🧵',
  firemaking:      '🔥',
  foraging:        '🌿',
  cooking:         '🍖',
  hunting:         '🗡️',
  shelterbuilding: '🏠',
};

function levelLabel(level: number): string {
  if (level <= 2) return 'Anfänger';
  if (level <= 4) return 'Lehrling';
  if (level <= 6) return 'Geübt';
  if (level <= 8) return 'Erfahren';
  if (level <= 9) return 'Experte';
  return 'Meister';
}

function levelColor(level: number): string {
  if (level <= 2) return 'text-slate-400';
  if (level <= 4) return 'text-green-400';
  if (level <= 6) return 'text-blue-400';
  if (level <= 8) return 'text-purple-400';
  return 'text-amber-400';
}

function barColor(level: number): string {
  if (level <= 2) return 'bg-slate-400';
  if (level <= 4) return 'bg-green-500';
  if (level <= 6) return 'bg-blue-500';
  if (level <= 8) return 'bg-purple-500';
  return 'bg-amber-500';
}

export default function SkillsBar() {
  const skills = usePlayerStore(s => s.player.skills ?? DEFAULT_SKILLS);

  const rows = [SKILL_IDS.slice(0, 4), SKILL_IDS.slice(4)];

  return (
    <div className="space-y-1.5 select-none">
      <div className="text-slate-500 text-xs uppercase tracking-widest mb-1">Fähigkeiten</div>
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-4 gap-2">
          {row.map(id => {
            const skill = skills[id];
            const xpNeeded = skill.level * 20;
            const pct = Math.min(100, (skill.xp / xpNeeded) * 100);
            return (
              <div key={id} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="leading-none" style={{ fontSize: 11 }}>{SKILL_ICONS[id]}</span>
                  <span className="text-slate-300 truncate leading-none" style={{ fontSize: 9 }}>
                    {SKILL_LABELS[id].split(' ')[0]}
                  </span>
                  <span className={`ml-auto font-bold leading-none ${levelColor(skill.level)}`} style={{ fontSize: 9 }}>
                    {skill.level}
                  </span>
                </div>
                <span className={`leading-none ${levelColor(skill.level)}`} style={{ fontSize: 8 }}>
                  {levelLabel(skill.level)}
                </span>
                <div className="w-full bg-slate-700 rounded-full overflow-hidden" style={{ height: 3 }}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${barColor(skill.level)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
