import { ISLAND_PRESETS, ISLAND_RANGES } from '../../data/islandConfig';
import type { IslandSettings } from '../../types/generation';

const CONTROLS = [
  ['landFraction', 'Landanteil', 0.01, '%', 'Zielwert; abgetrennte Landstücke werden entfernt.'],
  ['coastRoughness', 'Küstenunruhe', 0.05, '%', 'Mehr Buchten und kleine Landzungen.'],
  ['beachWidth', 'Strandbreite', 1, 'Felder', 'Breite vom Wasser bis zum Inland.'],
  ['terrainRoughness', 'Geländeunruhe', 0.05, '%', 'Mehr kleine Höhenunterschiede.'],
  ['plateauSize', 'Größe der Geländeformen', 1, 'Felder', 'Höhere Werte glätten kleine Höhenkanten.'],
  ['mountainFraction', 'Hochlandanteil', 0.01, '%', 'Anteil von Hochland und Gipfeln am Inland.'],
  ['vegetationDensity', 'Vegetationsdichte', 0.1, '×', 'Menge an Pflanzen und Bäumen; 1 entspricht der bisherigen Dichte.'],
  ['rampSpacing', 'Abstand der Aufgänge', 1, 'Felder', 'Größerer Abstand bedeutet weniger Aufgänge. Nötige Verbindungen werden ergänzt.'],
] as const;

export default function IslandSettingsPanel({ settings, onChange, seed, onSeedChange }: {
  settings: IslandSettings; onChange: (settings: IslandSettings) => void; seed: string; onSeedChange: (seed: string) => void;
}) {
  const preset = Object.entries(ISLAND_PRESETS).find(([, values]) => Object.entries(values).every(([key, value]) => settings[key as keyof IslandSettings] === value))?.[0] ?? 'custom';
  return <details className="w-[min(420px,calc(100vw-32px))] rounded-xl border border-slate-600 bg-slate-900/60 p-4 text-left text-slate-200">
    <summary className="cursor-pointer font-semibold">Insel anpassen</summary>
    <p className="my-3 text-xs text-slate-400">Gilt für ein neues Spiel. Beim Fortsetzen bleibt deine Insel erhalten.</p>
    <label className="mb-3 block text-sm">Landschaft
      <select value={preset} onChange={e => {
        if (e.target.value in ISLAND_PRESETS) onChange({ ...ISLAND_PRESETS[e.target.value as keyof typeof ISLAND_PRESETS] });
      }} className="mt-1 block w-full rounded border border-slate-600 bg-slate-800 p-2">
        <option value="gentle">Sanft – breite Strände, ruhiges Gelände</option>
        <option value="balanced">Ausgewogen</option>
        <option value="rugged">Rau – schmalere Strände, mehr Hochland</option>
        <option value="custom" disabled>Eigene Einstellungen</option>
      </select>
    </label>
    <label className="mb-4 block text-sm">Insel-Seed (optional)
      <input value={seed} onChange={e => onSeedChange(e.target.value)} inputMode="numeric" placeholder="Leer lassen für Zufall" className="mt-1 block w-full rounded border border-slate-600 bg-slate-800 p-2" />
      <span className="mt-1 block text-xs text-slate-400">Gleicher Seed und gleiche Einstellungen ergeben dieselbe Insel.</span>
    </label>
    <div className="space-y-3">
      {CONTROLS.map(([key, label, step, unit, hint]) => <label key={key} className="block text-sm">
        <span className="flex justify-between gap-2"><span>{label}</span><output>{unit === '%' ? Math.round(settings[key] * 100) : settings[key]} {unit}</output></span>
        <input type="range" min={ISLAND_RANGES[key][0]} max={ISLAND_RANGES[key][1]} step={step} value={settings[key]} onChange={e => onChange({ ...settings, [key]: Number(e.target.value) })} className="mt-1 w-full accent-green-500" />
        <span className="block text-xs text-slate-400">{hint}</span>
      </label>)}
    </div>
  </details>;
}
