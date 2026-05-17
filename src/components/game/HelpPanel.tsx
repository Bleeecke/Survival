import { useState } from 'react';

const CONTROLS = [
  { key: 'WASD',        desc: 'Bewegen' },
  { key: 'Shift + WASD',desc: 'Sprinten (2× Ausdauer)' },
  { key: 'Leertaste',   desc: 'Ressourcen sammeln (in der Nähe)' },
  { key: 'E',           desc: 'Schlafen / Interagieren' },
  { key: 'F',           desc: 'Lagerfeuer / Kiste / Regensammler' },
  { key: 'C',           desc: 'Crafting Buch öffnen' },
  { key: 'Linksklick',  desc: 'Speer werfen (ausgerüstet)' },
  { key: '1 / 2 / 3',  desc: 'Schnellzugriff Gürtelslots' },
  { key: 'Esc',         desc: 'Menü / Abbrechen' },
];

const GUIDE = [
  {
    title: '💧 Wasser',
    text: 'Pfützen (Tag 1–2) → Regensammler bauen (Kokosschale + Palmenblatt) → auf Regen warten. Kokosnuss öffnen gibt sofort Kokoswasser.',
  },
  {
    title: '🍖 Essen',
    text: 'Beeren sammeln (Gras/Wald), exotische Früchte (Dschungel), Krabbe/Schildkröte jagen. Fleisch am Lagerfeuer garen – rohes Fleisch macht krank!',
  },
  {
    title: '🔥 Lagerfeuer',
    text: 'Äste ×5 + Bruchstein ×3 craften und platzieren. Mit F interagieren zum Kochen. Starker Regen löscht das Feuer – Holz als Reserve lagern.',
  },
  {
    title: '🛡️ Werkzeuge',
    text: 'Feuersteinmesser → Steinaxt → Verbesserte Axt. Steinaxt braucht man für Holz, Kokosöffnen und viele Rezepte.',
  },
  {
    title: '🦀 Jagd',
    text: 'Steinspeer ausrüsten → Linksklick auf Krabbe/Schildkröte (6 Tiles Reichweite). Fleisch dann am Lagerfeuer garen.',
  },
  {
    title: '🌙 Schlafen',
    text: 'Bei Lagerfeuer oder Unterkunft mit E schlafen. Draußen schlafen erholt weniger. Müdigkeit über 95% führt zu Kollaps.',
  },
  {
    title: '🥥 Kokosnuss',
    text: 'Von Palmen ernten (Leertaste, Axt nötig) oder am Strand finden. Mit Axt im Crafting öffnen → 2 Schalen + Kokoswasser.',
  },
  {
    title: '🌧️ Regen',
    text: 'Füllt automatisch alle platzierten Regensammler mit 2 Schluck. Starker Regen löscht Lagerfeuer. Regentypen variieren stark.',
  },
];

export default function HelpPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState<'controls' | 'guide'>('controls');

  return (
    <div className="absolute bottom-4 left-4 z-[800] pointer-events-auto">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-full bg-slate-700/90 hover:bg-slate-600 border border-slate-500 text-white font-bold text-base shadow-lg flex items-center justify-center"
        title="Hilfe & Steuerung"
      >
        ?
      </button>

      {open && (
        <div className="absolute bottom-11 left-0 w-80 bg-slate-900/97 border border-slate-600 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
            <div className="flex gap-1">
              <button
                onClick={() => setTab('controls')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  tab === 'controls' ? 'bg-amber-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                🎮 Steuerung
              </button>
              <button
                onClick={() => setTab('guide')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                  tab === 'guide' ? 'bg-amber-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                📖 Anleitung
              </button>
            </div>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white text-sm">✕</button>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto p-3">
            {tab === 'controls' ? (
              <div className="space-y-1">
                {CONTROLS.map(c => (
                  <div key={c.key} className="flex items-start gap-3 py-1.5 border-b border-slate-800 last:border-0">
                    <span className="bg-slate-700 text-amber-300 text-xs font-mono font-bold px-2 py-0.5 rounded min-w-fit whitespace-nowrap">
                      {c.key}
                    </span>
                    <span className="text-slate-300 text-xs leading-tight">{c.desc}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {GUIDE.map(g => (
                  <div key={g.title} className="bg-slate-800 rounded-xl p-3">
                    <div className="text-white text-xs font-bold mb-1">{g.title}</div>
                    <div className="text-slate-400 text-xs leading-relaxed">{g.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
