import { useState } from 'react';
import { RECIPES } from '../../data/recipes';
import { craftingSystem } from '../../services/game/CraftingSystem';
import { usePlayerStore } from '../../store/playerStore';
import { SKILL_LABELS } from '../../types/skills';
import type { Recipe } from '../../types/crafting';
import type { Inventory } from '../../types/player';

// ── Constants ─────────────────────────────────────────────────────

const STRUCTURE_IDS = new Set([
  'campfire', 'granite_campfire', 'palm_shelter', 'wooden_shelter',
  'workbench', 'log_cabin', 'bed', 'farm_plot', 'furnace', 'storage_box',
]);

const ITEM_NAMES: Record<string, string> = {
  sticks: 'Äste', pebbles: 'Bruchstein', wood: 'Holz', stone: 'Stein',
  food: 'Beeren', water: 'Wasser', rope: 'Seil', plank: 'Holzbretter',
  iron_ore: 'Eisenerz', iron_bar: 'Eisenbarren',
  sharp_flint: 'Gesp. Feuerstein', hardened_stick: 'Gehärteter Ast',
  flint: 'Feuerstein', driftwood: 'Treibholz', shells: 'Muscheln',
  palm_leaf: 'Palmenblatt', herbs: 'Kräuter', fiber: 'Fasern',
  mushroom: 'Pilze', exotic_fruit: 'Exotische Frucht', vine: 'Lianen',
  fish: 'Fisch', flint_knife: 'Feuersteinmesser',
  stone_axe: 'Steinaxt', stone_pickaxe: 'Steinspitzhacke', stone_spear: 'Steinspeer',
  improved_axe: 'Verbesserte Axt', improved_pickaxe: 'Verbesserte Spitzhacke',
  fishing_rod: 'Angelrute', torch: 'Fackel',
  iron_axe: 'Eisenaxt', iron_pickaxe: 'Eisenspitzhacke',
  cooked_food: 'Gekochtes Essen', cooked_fish_meal: 'Gebratener Fisch',
  herbal_remedy: 'Kräutermittel', cooked_mushroom: 'Geb. Pilze',
  campfire: 'Lagerfeuer', palm_shelter: 'Palmendach',
  wooden_shelter: 'Holzunterkunft', workbench: 'Werkbank',
  log_cabin: 'Blockhütte', bed: 'Bett', farm_plot: 'Ackerbeet',
  furnace: 'Schmelzofen', storage_box: 'Lagerbox',
  coconut_shell: 'Kokosschale', coconut_water: 'Kokoswasser',
  boar_meat: 'Wildschweinfleisch', cooked_boar: 'Gek. Wildschwein',
};

const CATEGORY_LABELS: Record<string, string> = {
  tool: 'Werkzeuge', food: 'Nahrung', weapon: 'Waffen',
  utility: 'Nützliches', resource: 'Ressourcen', medicine: 'Medizin',
};

const CATEGORY_ICONS: Record<string, string> = {
  tool: '🔨', food: '🍖', weapon: '⚔️', utility: '⚙️', resource: '🪵', medicine: '🌿',
};

type FilterMode = 'all' | 'craftable' | 'locked';

// ── Main Component ────────────────────────────────────────────────

export default function TechbaumModal({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [search, setSearch] = useState('');

  const inventory = usePlayerStore(s => s.player.inventory);

  // All non-structure, non-campfire recipes — grouped by category
  const allRecipes = RECIPES.filter(r => !STRUCTURE_IDS.has(r.id) && r.requiresTool !== 'campfire_near');

  const filtered = allRecipes.filter(r => {
    const discovered = craftingSystem.isDiscovered(r, inventory);
    if (filter === 'craftable') return discovered && craftingSystem.canCraft(r.id, inventory);
    if (filter === 'locked') return !discovered;
    return true;
  }).filter(r => {
    if (!search) return true;
    const name = r.name.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // Group by category
  const byCategory = filtered.reduce<Record<string, typeof filtered>>((acc, r) => {
    const cat = r.category ?? 'utility';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  const categoryOrder = ['tool', 'weapon', 'resource', 'utility', 'food', 'medicine'];
  const sortedCategories = categoryOrder.filter(c => byCategory[c]?.length);
  const otherCategories = Object.keys(byCategory).filter(c => !categoryOrder.includes(c));

  const totalDiscovered = allRecipes.filter(r => craftingSystem.isDiscovered(r, inventory)).length;
  const totalCraftable = allRecipes.filter(r => craftingSystem.canCraft(r.id, inventory)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl flex flex-col"
           style={{ width: 'min(860px, 96vw)', height: 'min(720px, 92vh)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">📊 Techbaum</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {totalDiscovered} entdeckt · {totalCraftable} herstellbar · {allRecipes.length} gesamt
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors text-lg">
            ✕
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 border-b border-slate-700 flex-shrink-0 flex gap-3 items-center">
          <div className="flex gap-1">
            {(['all', 'craftable', 'locked'] as FilterMode[]).map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-lg font-semibold transition-colors ${
                  filter === f ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}>
                {f === 'all' ? 'Alle' : f === 'craftable' ? '✅ Herstellbar' : '🔒 Gesperrt'}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Suche…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ml-auto px-3 py-1 text-xs rounded-lg bg-slate-700 border border-slate-600 text-slate-200 placeholder-slate-500 outline-none focus:border-amber-600 w-36"
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {[...sortedCategories, ...otherCategories].map(cat => (
            <div key={cat}>
              <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                <span>{CATEGORY_ICONS[cat] ?? '▪'}</span>
                <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                <span className="text-slate-500 font-normal">({byCategory[cat].length})</span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {byCategory[cat].map(r => (
                  <TechCard key={r.id} recipe={r} inventory={inventory} />
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm">Keine Einträge gefunden</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-2 border-t border-slate-700 flex-shrink-0 text-xs text-slate-500 flex gap-4">
          <span>Rezepte erscheinen durch Materialentdeckung</span>
          <span className="ml-auto">T / Esc → schließen</span>
        </div>
      </div>
    </div>
  );
}

// ── TechCard ──────────────────────────────────────────────────────

function TechCard({ recipe, inventory }: {
  recipe: Recipe;
  inventory: Inventory;
}) {
  const discovered = craftingSystem.isDiscovered(recipe, inventory);
  const canCraft   = discovered && craftingSystem.canCraft(recipe.id, inventory);
  const hasTool    = craftingSystem.hasRequiredTool(recipe, inventory);
  const hasSkill   = craftingSystem.hasRequiredSkill(recipe);

  const statusColor = !discovered ? 'border-slate-700 opacity-50' :
                      canCraft    ? 'border-green-700' :
                                    'border-slate-600';

  return (
    <div className={`rounded-xl border p-3 bg-slate-700/40 ${statusColor}`}>
      <div className="flex items-start gap-2">
        <span className="text-2xl leading-none mt-0.5">{recipe.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-semibold truncate ${discovered ? 'text-white' : 'text-slate-500'}`}>
              {discovered ? recipe.name : '???'}
            </span>
            {canCraft && <span className="text-green-400 text-xs shrink-0">✓</span>}
            {discovered && !canCraft && !hasTool && <span className="text-orange-400 text-xs shrink-0">Werkzeug fehlt</span>}
            {discovered && !canCraft && hasTool && !hasSkill && <span className="text-purple-400 text-xs shrink-0">Skill fehlt</span>}
          </div>

          {discovered && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {recipe.inputs.map((inp: { resourceId: string; quantity: number }) => {
                const hasIt = ((inventory as unknown as Record<string, number>)[inp.resourceId] ?? 0) >= inp.quantity;
                return (
                  <span key={inp.resourceId}
                    className={`text-xs px-1.5 py-0.5 rounded ${hasIt ? 'bg-green-900/60 text-green-300' : 'bg-slate-600/60 text-slate-400'}`}>
                    {inp.quantity}× {ITEM_NAMES[inp.resourceId] ?? inp.resourceId}
                  </span>
                );
              })}
            </div>
          )}

          {discovered && recipe.requiresSkill && (
            <p className={`text-xs mt-1 ${hasSkill ? 'text-slate-500' : 'text-purple-400'}`}>
              {SKILL_LABELS[recipe.requiresSkill!.skill]} Stufe {recipe.requiresSkill!.level}
            </p>
          )}

          {!discovered && (
            <p className="text-xs text-slate-600 mt-1">
              Noch nicht entdeckt
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
