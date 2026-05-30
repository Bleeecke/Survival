import { useJournalStore } from '../../store/journalStore';
import { SKILL_LABELS } from '../../types/skills';

export default function JournalModal() {
  const isOpen   = useJournalStore(s => s.isOpen);
  const pending  = useJournalStore(s => s.pending);
  const accepted = useJournalStore(s => s.accepted);
  const close    = useJournalStore(s => s.closeJournal);
  const accept   = useJournalStore(s => s.acceptEntry);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
      onClick={close}
    >
      <div
        className="bg-slate-900 border border-amber-800/60 rounded-2xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-xl">📖</span>
            <span className="text-amber-200 font-bold text-base">Eingebungs-Journal</span>
            {pending.length > 0 && (
              <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pending.length}
              </span>
            )}
          </div>
          <button onClick={close} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {/* Neue Eingebungen */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <div className="text-red-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                {pending.length} neue Eingebung{pending.length > 1 ? 'en' : ''}
              </div>
              {pending.map(entry => (
                <div
                  key={entry.id}
                  className="bg-amber-950/40 border border-amber-700/50 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-amber-200 font-semibold text-sm">{entry.title}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5">
                        {SKILL_LABELS[entry.skillId]} · Stufe {entry.skillLevel}
                      </div>
                    </div>
                    <span className="text-xl flex-shrink-0">💡</span>
                  </div>
                  <p className="text-slate-300 text-xs leading-relaxed italic">
                    „{entry.text}"
                  </p>
                  <button
                    onClick={() => accept(entry.id)}
                    className="w-full py-1.5 bg-amber-700 hover:bg-amber-600 text-amber-100 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Eingebung annehmen →
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Archiv */}
          {accepted.length > 0 && (
            <div className="space-y-2">
              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider border-t border-slate-700 pt-3">
                Bereits verstanden
              </div>
              {accepted.map(entry => (
                <div
                  key={entry.id}
                  className="bg-slate-800/60 border border-slate-700/50 rounded-lg px-3 py-2 flex items-center gap-3"
                >
                  <span className="text-green-500 text-sm">✅</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-300 text-xs font-medium truncate">{entry.title}</div>
                    <div className="text-slate-500 text-[10px]">
                      {SKILL_LABELS[entry.skillId]} · Stufe {entry.skillLevel}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pending.length === 0 && accepted.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              <div className="text-3xl mb-3">📖</div>
              <div>Noch keine Eingebungen.</div>
              <div className="text-xs mt-1">Sammle Materialien und arbeite, um neue Einsichten zu gewinnen.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
