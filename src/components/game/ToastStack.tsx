import { useNotificationStore } from '../../store/notificationStore';
import { SKILL_LABELS, type SkillId } from '../../types/skills';

export default function ToastStack() {
  const skillToasts    = useNotificationStore(s => s.notifications);
  const materialToasts = useNotificationStore(s => s.materialNotifications);

  if (skillToasts.length === 0 && materialToasts.length === 0) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2">

      {/* Skill XP / Level-Up */}
      {skillToasts.map((n) => {
        if (n.type === 'levelup') {
          const parts   = n.message.split(':');
          const skillId = parts[0] as SkillId;
          const level   = parts[2];
          const label   = SKILL_LABELS[skillId] ?? skillId;
          return (
            <div
              key={n.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/90 border border-green-500/70 text-green-200 text-xs font-bold shadow-lg"
            >
              <span>⬆️</span>
              <span>{label} → Stufe {level}!</span>
            </div>
          );
        }
        return (
          <div
            key={n.id}
            className="px-3 py-1.5 rounded-lg bg-black/75 border border-amber-700/40 text-amber-300 text-xs font-semibold shadow backdrop-blur-sm"
          >
            {n.message}
          </div>
        );
      })}

      {/* Material discovery */}
      {materialToasts.map((t) => (
        <div
          key={t.id}
          className="max-w-xs px-4 py-2.5 rounded-xl bg-black/75 border border-amber-800/50 backdrop-blur-sm shadow-xl text-center"
          style={{
            opacity: t.fading ? 0 : 1,
            transform: t.fading ? 'translateY(-4px)' : 'translateY(0)',
            transition: 'opacity 0.8s ease, transform 0.8s ease',
          }}
        >
          <p className="text-amber-200/90 text-xs leading-relaxed italic">„{t.text}"</p>
        </div>
      ))}

    </div>
  );
}
