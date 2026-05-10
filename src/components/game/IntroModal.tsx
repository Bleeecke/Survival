import { useState } from 'react';
import { useTutorialStore } from '../../store/tutorialStore';

const PAGES = [
  {
    title: 'Tag 1 — Gestrandeter',
    text: [
      'Das Letzte woran du dich erinnerst ist der Sturm. Die Wellen. Das Krachen des Rumpfes.',
      'Als du aufwachst, liegst du auf einem Sandstrand. Dein Schiff ist weg. Die Crew — verschwunden. Nur du, das Rauschen des Meeres und eine unbekannte Insel vor dir.',
      'Irgendwo da draußen wird jemand nach dir suchen. Aber bis Hilfe kommt, musst du auf eigene Faust überleben.',
    ],
    icon: '🌊',
  },
  {
    title: 'Die Insel',
    text: [
      'Die Insel ist deine einzige Ressource. Wälder, Strände, Felsen und Quellen bieten alles was du zum Überleben brauchst — wenn du weißt wo du suchen musst.',
      'Sammle Ressourcen, baue Werkzeuge, errichte einen Unterschlupf. Je besser du dich vorbereitest, desto größer deine Überlebenschancen.',
      'Die Nächte sind dunkel und kalt. Ein Lagerfeuer kann den Unterschied zwischen Leben und Tod bedeuten.',
    ],
    icon: '🏝️',
  },
  {
    title: 'Deine erste Aufgabe',
    text: [
      'Fang klein an. Wasser ist das Dringlichste — ohne es überlebst du keine drei Tage.',
      'Am Strand findest du Feuersteine und Treibholz. Im Wald gibt es Äste, Fasern und Pilze. Erkunde die Insel systematisch.',
      'Das Tutorial führt dich durch die ersten Stunden. Danach bist du auf dich allein gestellt.',
    ],
    icon: '🗺️',
  },
];

export default function IntroModal() {
  const dismissIntro = useTutorialStore(s => s.dismissIntro);
  const skipTutorial = useTutorialStore(s => s.skipTutorial);
  const [page, setPage] = useState(0);

  const current = PAGES[page];
  const isLast = page === PAGES.length - 1;

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(6px)' }}>

      <div className="relative bg-slate-900 border border-slate-600 rounded-2xl shadow-2xl w-[520px] max-w-[95vw] overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-blue-600 via-teal-500 to-green-500" />

        <div className="p-8">
          {/* Icon + Title */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-5xl">{current.icon}</span>
            <div>
              <div className="text-slate-400 text-xs uppercase tracking-widest mb-1">
                Überlebens-Log — {page + 1}/{PAGES.length}
              </div>
              <h2 className="text-white font-bold text-xl">{current.title}</h2>
            </div>
          </div>

          {/* Text */}
          <div className="space-y-3 mb-8">
            {current.text.map((line, i) => (
              <p key={i} className="text-slate-300 text-sm leading-relaxed">{line}</p>
            ))}
          </div>

          {/* Page dots */}
          <div className="flex justify-center gap-2 mb-6">
            {PAGES.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === page ? 'w-6 h-2 bg-teal-400' : 'w-2 h-2 bg-slate-600'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            {!isLast ? (
              <>
                <button
                  onClick={() => setPage(p => p + 1)}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-colors"
                >
                  Weiter →
                </button>
                <button
                  onClick={() => { dismissIntro(); skipTutorial(); }}
                  className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-400 text-sm rounded-xl transition-colors"
                >
                  Überspringen
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={dismissIntro}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition-colors"
                >
                  🏝️ Überleben beginnen
                </button>
                <button
                  onClick={() => { dismissIntro(); skipTutorial(); }}
                  className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-400 text-sm rounded-xl transition-colors"
                >
                  Ohne Tutorial
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
