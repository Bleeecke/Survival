import { useNotificationStore } from '../../store/notificationStore';

export default function MaterialToastStack() {
  const toasts = useNotificationStore(s => s.materialNotifications);

  if (toasts.length === 0) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-2">
      {toasts.map((t) => (
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
