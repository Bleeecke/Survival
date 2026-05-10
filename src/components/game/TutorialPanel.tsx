import { useTutorialStore, TUTORIAL_STEPS } from '../../store/tutorialStore';

export default function TutorialPanel() {
  const currentStep = useTutorialStore(s => s.currentStep);
  const skipped     = useTutorialStore(s => s.skipped);
  const skipTutorial = useTutorialStore(s => s.skipTutorial);

  if (skipped || currentStep === 0) return null;

  const step = TUTORIAL_STEPS.find(s => s.id === currentStep);
  if (!step) return null;

  const completed = currentStep - 1;
  const total     = TUTORIAL_STEPS.length;

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-lg overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-slate-700">
        <div
          className="h-full bg-teal-500 transition-all duration-500"
          style={{ width: `${(completed / total) * 100}%` }}
        />
      </div>

      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-teal-400 font-semibold uppercase tracking-widest">
              Tutorial
            </span>
            <span className="text-xs text-slate-500">{completed}/{total}</span>
          </div>
          <button
            onClick={skipTutorial}
            className="text-slate-600 hover:text-slate-400 text-xs transition-colors"
            title="Tutorial überspringen"
          >
            ✕
          </button>
        </div>

        {/* Current task */}
        <div className="flex items-start gap-2.5">
          <span className="text-xl mt-0.5 flex-shrink-0">{step.icon}</span>
          <div className="min-w-0">
            <div className="text-white font-semibold text-sm leading-tight mb-1">
              {step.title}
            </div>
            <div className="text-slate-400 text-xs leading-relaxed mb-2">
              {step.description}
            </div>
            {/* Hint box */}
            <div className="bg-slate-700/60 border border-slate-600 rounded-lg px-2.5 py-1.5">
              <span className="text-yellow-400 text-xs">💡 </span>
              <span className="text-slate-300 text-xs">{step.hint}</span>
            </div>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex gap-1 mt-3 justify-center">
          {TUTORIAL_STEPS.map(s => (
            <div
              key={s.id}
              className={`rounded-full transition-all duration-300 ${
                s.id < currentStep  ? 'w-2 h-2 bg-teal-500' :
                s.id === currentStep ? 'w-3 h-2 bg-teal-400' :
                'w-2 h-2 bg-slate-600'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
