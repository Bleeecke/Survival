import ResourceIcon from './ResourceIcon';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { useGameStore } from '../../store/gameStore';
import { useCraftingStore } from '../../store/craftingStore';
import { RECIPES } from '../../data/recipes';
import { craftingSystem } from '../../services/game/CraftingSystem';
import { outcomeChances } from '../../data/craftingBalance';
import { TOOL_MAX_DURABILITY } from '../../data/toolDurability';
import resources from '../../data/json/resources.json';
import { getBuildDefinition } from '../../data/buildDefinitions';

const names = Object.fromEntries(resources.map(r => [r.id, r.name]));

export default function CraftingPanel({ mode = 'all' }: { mode?: 'all' | 'hand' | 'fire' }) {
  const inventory = usePlayerStore(s => s.player.inventory);
  const skills = usePlayerStore(s => s.player.skills);
  usePlayerStore(s => s.knowledge);
  usePlayerStore(s => s.knownMaterials);
  usePlayerStore(s => s.player.equipment);
  usePlayerStore(s => s.player.x);
  usePlayerStore(s => s.player.y);
  useWorldStore(s => s.world?.structures);
  useGameStore(s => s.freeCraft);
  const job = useCraftingStore(s => s.job);
  const message = useCraftingStore(s => s.message);
  const failures = useCraftingStore(s => s.failures);
  const start = useCraftingStore(s => s.start);
  const cancel = useCraftingStore(s => s.cancel);
  const recipes = RECIPES.filter(r => craftingSystem.isDiscovered(r, inventory)
    && (mode === 'fire' ? r.requiresTool === 'campfire_near'
      : mode === 'hand' ? !r.requiresTool?.endsWith('_near') : true));
  return <div className="space-y-3">
    {job && <div className="rounded-lg bg-amber-950/60 p-3 text-xs text-amber-200">
      <div className="flex justify-between gap-3">
        <span>{RECIPES.find(r => r.id === job.recipeId)?.name ?? getBuildDefinition(job.recipeId)?.name} · {Math.round(job.elapsed / job.duration * 100)}%</span>
        <button onClick={cancel} className="underline">Abbrechen</button>
      </div>
      <progress className="mt-2 w-full" value={job.elapsed} max={job.duration} aria-label="Arbeitsfortschritt" />
      <p>{job.building ? 'Baustelle bleibt beim Unterbrechen erhalten. Material wird an der Baustelle gebunden.' : 'Materialverbrauch erst beim Abschluss. Pause und Schlaf unterbrechen die Arbeit.'}</p>
    </div>}
    {message && <p role="status" className="text-xs text-amber-200">{message}</p>}
    <details open={mode !== 'hand'} className="space-y-3">
    <summary className="cursor-pointer text-sm text-amber-200">{mode === 'hand' ? 'Mit der Hand herstellen' : 'Bekannte Rezepte'} ({recipes.length})</summary>
    {recipes.length === 0 && <p className="text-sm text-slate-400">Entdecke Materialien und Verfahren, um neue Rezepte zu lernen.</p>}
    {recipes.map(recipe => {
      const reason = craftingSystem.getCraftBlockReason(recipe);
      const guidance = reason ? craftingSystem.getCraftGuidance(recipe) : null;
      const level = skills[recipe.grantsSkill?.skill ?? recipe.requiresSkill?.skill ?? 'crafting'].level;
      const quality = !!recipe.qualityBased || recipe.outputs.some(o => !!TOOL_MAX_DURABILITY[o.resourceId]);
      const chances = outcomeChances(level, failures[recipe.id] ?? 0);
      return <div key={recipe.id} className="rounded-lg border border-slate-700 bg-slate-800 p-3">
        <div className="flex justify-between gap-3 text-sm text-white">
          <span><ResourceIcon id={recipe.outputs[0]?.resourceId ?? ''} fallback={recipe.icon} /> {recipe.name}</span>
          <span>{(craftingSystem.getEffectiveCraftTime(recipe) / 1000).toFixed(1)} s</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {recipe.inputs.map(i => {
            const have = craftingSystem.getItemQuantity(inventory, i.resourceId);
            return <span key={i.resourceId} className={have >= i.quantity ? 'text-green-300' : 'text-red-300'}>
              <ResourceIcon id={i.resourceId} fallback="" /> {names[i.resourceId] ?? i.resourceId}: {have}/{i.quantity}
            </span>;
          })}
        </div>
        <p className="mt-1 text-xs text-slate-400">{recipe.description}</p>
        {quality && <p className="mt-1 text-xs text-slate-300">{Math.round((1 - chances.failure) * 100)}% brauchbar · {Math.round(chances.good * 100)}% gut · Qualität bestimmt Haltbarkeit</p>}
        {guidance && <p className="mt-2 text-xs text-amber-200">{guidance}</p>}
        <button disabled={!!job || !!reason} onClick={() => start(recipe.id)} className="mt-2 rounded bg-amber-700 px-3 py-1 text-xs text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400">
          {job ? job.recipeId === recipe.id ? 'In Arbeit – Fortschritt oben' : 'Anderer Auftrag läuft – siehe oben' : reason ?? 'Herstellen'}
        </button>
      </div>;
    })}
    </details>
  </div>;
}
