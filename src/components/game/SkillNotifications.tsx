import { useEffect, useState } from 'react';
import { useNotificationStore } from '../../store/notificationStore';
import { SKILL_LABELS, type SkillId } from '../../types/skills';

export default function SkillNotifications() {
  const notifications = useNotificationStore((s) => s.notifications);
  const [visible, setVisible] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = new Set(notifications.map((n) => n.id));
    setVisible(ids);
  }, [notifications]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 pointer-events-none flex flex-col gap-1.5 items-end">
      {notifications.map((n) => {
        if (n.type === 'levelup') {
          // Parse "skillId:levelup:N"
          const parts = n.message.split(':');
          const skillId = parts[0] as SkillId;
          const level = parts[2];
          const label = SKILL_LABELS[skillId] ?? skillId;
          return (
            <div
              key={n.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-900/90 border border-green-500 text-green-200 text-xs font-bold shadow-lg animate-fade-in"
            >
              <span className="text-base">⬆️</span>
              <span>{label} → Stufe {level}!</span>
            </div>
          );
        }
        return (
          <div
            key={n.id}
            className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-amber-700/50 text-amber-400 text-xs font-semibold shadow animate-fade-in"
          >
            {n.message}
          </div>
        );
      })}
    </div>
  );
}
