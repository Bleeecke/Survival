import { useState, useEffect, useRef } from 'react';
import { RECIPES } from '../../data/recipes';
import { craftingSystem } from '../../services/game/CraftingSystem';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { useGameStore } from '../../store/gameStore';
import type { Recipe, RecipeCategory } from '../../types';
import { SKILL_LABELS } from '../../types/skills';
import { KNOWLEDGE_LABELS } from '../../data/knowledge';
import { useNotificationStore } from '../../store/notificationStore';

// ── Constants ─────────────────────────────────────────────────────

const STRUCTURE_IDS = new Set([
  'campfire', 'granite_campfire', 'palm_shelter', 'wooden_shelter', 'workbench', 'log_cabin', 'bed', 'farm_plot', 'furnace', 'storage_box',
]);

// Structures that become construction sites first (type → days to build)
const CONSTRUCTION_DAYS: Record<string, number> = {
  wooden_shelter: 2,
  log_cabin: 4,
};

const ITEM_NAMES: Record<string, string> = {
  // Materials
  sticks: 'Äste', pebbles: 'Bruchstein',
  wood: 'Holz', stone: 'Stein', food: 'Beeren', water: 'Wasser',
  rope: 'Seil', plank: 'Holzbretter', iron_ore: 'Eisenerz', iron_bar: 'Eisenbarren',
  sharp_flint: 'Gesp. Feuerstein', hardened_stick: 'Gehärteter Ast',
  // New materials
  flint: 'Feuerstein', driftwood: 'Treibholz', shells: 'Muscheln',
  palm_leaf: 'Palmenblatt', herbs: 'Kräuter', fiber: 'Fasern',
  mushroom: 'Pilze', exotic_fruit: 'Exotische Frucht', vine: 'Lianen',
  fish: 'Fisch',
  // Tools
  flint_knife: 'Feuersteinmesser',
  stone_axe: 'Steinaxt', stone_pickaxe: 'Steinspitzhacke', stone_spear: 'Steinspeer',
  improved_axe: 'Verbesserte Axt', improved_pickaxe: 'Verbesserte Spitzhacke',
  fishing_rod: 'Angelrute', torch: 'Fackel',
  iron_axe: 'Eisenaxt', iron_pickaxe: 'Eisenspitzhacke',
  // Food
  water_container: 'Wassercontainer', cooked_food: 'Gekochtes Essen',
  cooked_fish_meal: 'Gebratener Fisch', herbal_remedy: 'Kräutermittel',
  cooked_mushroom: 'Geb. Pilze',
  // Structures
  palm_tree: 'Palme', campfire: 'Lagerfeuer', palm_shelter: 'Palmendach',
  wooden_shelter: 'Holzunterkunft', workbench: 'Werkbank',
  log_cabin: 'Blockhütte', bed: 'Bett',
  farm_plot: 'Ackerbeet', furnace: 'Schmelzofen',
  storage_box: 'Lagerbox',
};


const CATEGORY_DEFS: { key: 'all' | RecipeCategory; label: string; icon: string }[] = [
  { key: 'all',      label: 'Alles',       icon: '★'  },
  { key: 'tool',     label: 'Werkzeuge',   icon: '🔨' },
  { key: 'food',     label: 'Nahrung',     icon: '🍖' },
  { key: 'weapon',   label: 'Waffen',      icon: '⚔️' },
  { key: 'utility',  label: 'Nützliches',  icon: '⚙️' },
  { key: 'resource', label: 'Ressourcen',  icon: '🪵' },
];

// ── Main Component ────────────────────────────────────────────────

export default function CraftingModal({ onClose }: { onClose: () => void }) {
  const [activeCategory, setActiveCategory] = useState<'all' | RecipeCategory>('all');
  const [craftingId, setCraftingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [failMessage, setFailMessage] = useState<string | null>(null);
  const craftStartRef = useRef<number | null>(null);
  const intervalRef   = useRef<number | null>(null);
  const failTimerRef  = useRef<number | null>(null);

  const inventory = usePlayerStore(s => s.player.inventory);

  // Only show discovered recipes — filter out structures (those belong in BuildMenu)
  const allFiltered = (activeCategory === 'all' ? RECIPES : RECIPES.filter(r => r.category === activeCategory))
    .filter(r => craftingSystem.isDiscovered(r, inventory))
    .filter(r => !STRUCTURE_IDS.has(r.id));

  const discovered = allFiltered.sort((a, b) => {
    const scoreA = (craftingSystem.canCraft(a.id, inventory) ? 4 : 0)
                 + (craftingSystem.hasRequiredTool(a, inventory) ? 2 : 0)
                 + (craftingSystem.hasRequiredSkill(a) ? 1 : 0)
                 + (craftingSystem.hasRequiredKnowledge(a) ? 1 : 0);
    const scoreB = (craftingSystem.canCraft(b.id, inventory) ? 4 : 0)
                 + (craftingSystem.hasRequiredTool(b, inventory) ? 2 : 0)
                 + (craftingSystem.hasRequiredSkill(b) ? 1 : 0)
                 + (craftingSystem.hasRequiredKnowledge(b) ? 1 : 0);
    return scoreB - scoreA || a.tier - b.tier;
  });

  // ── Crafting logic ───────────────────────────────────────────────

  function startCraft(recipeId: string) {
    if (craftingId) return;
    const inv = usePlayerStore.getState().player.inventory;
    if (!craftingSystem.canCraft(recipeId, inv)) return;
    const recipe = RECIPES.find(r => r.id === recipeId)!;
    if (!craftingSystem.hasRequiredTool(recipe, inv)) return;
    if (!craftingSystem.hasRequiredSkill(recipe)) return;

    // Structures → enter placement mode first, crafting happens on confirm
    if (STRUCTURE_IDS.has(recipeId)) {
      useGameStore.getState().enterPlacementMode(recipeId);
      onClose();
      return;
    }

    setCraftingId(recipeId);
    setProgress(0);
    craftStartRef.current = Date.now();
    const effectiveTime = craftingSystem.getEffectiveCraftTime(recipe);

    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - craftStartRef.current!;
      const pct = Math.min(100, (elapsed / effectiveTime) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(intervalRef.current!);
        finishCraft(recipeId);
      }
    }, 50);
  }

  function cancelCraft() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setCraftingId(null);
    setProgress(0);
    craftStartRef.current = null;
  }

  function finishCraft(recipeId: string) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;

    const { player, addToInventory, removeResource } = usePlayerStore.getState();
    if (!craftingSystem.canCraft(recipeId, player.inventory)) { setCraftingId(null); return; }

    // Immer erfolgreich — Materialien verbrauchen
    if (!useGameStore.getState().freeCraft) {
      for (const input of recipe.inputs) removeResource(input.resourceId, input.quantity);
    }

    if (STRUCTURE_IDS.has(recipeId)) {
      const { x, y } = usePlayerStore.getState().player;
      const constructionDays = CONSTRUCTION_DAYS[recipeId];
      if (constructionDays) {
        useWorldStore.getState().placeConstructionSite(recipeId, x, y, constructionDays);
      } else {
        // Some recipes have a different structure type than their recipe id
        const structureType = recipe.outputs[0]?.resourceId ?? recipeId;
        useWorldStore.getState().placeStructure(structureType, x, y);
      }
      useGameStore.getState().addScore(200);
    } else {
      for (const output of recipe.outputs) {
        if (recipeId === 'coconut_open' && output.resourceId === 'coconut_water') continue;
        addToInventory(output.resourceId, output.quantity);
      }
      if (recipeId === 'coconut_open') {
        const stats = usePlayerStore.getState().player.stats;
        usePlayerStore.getState().updateStats({
          thirst:  Math.max(0, (stats.thirst ?? 0) - 20),
          stamina: Math.min(100, (stats.stamina ?? 100) + 8),
        });
        const isFirst = !usePlayerStore.getState().knownMaterials.includes('coconut_water');
        if (isFirst) {
          usePlayerStore.getState().learnMaterial('coconut_water');
        } else {
          useNotificationStore.getState().addNotification('💧 Kokoswasser getrunken — Durst -20', 'xp');
        }
      }
      useGameStore.getState().addScore(100);
    }

    craftingSystem.awardSkillXp(recipe);
    craftingSystem.grantKnowledge(recipe);
    craftingSystem.damageToolOnCraft(recipe);
    setCraftingId(null);
    setProgress(0);
    craftStartRef.current = null;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { cancelCraft(); onClose(); } };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (failTimerRef.current) clearTimeout(failTimerRef.current);
    };
  }, [onClose]);

  useEffect(() => {
    if (!failMessage) return;
    if (failTimerRef.current) clearTimeout(failTimerRef.current);
    failTimerRef.current = window.setTimeout(() => setFailMessage(null), 2500);
  }, [failMessage]);

  const activeName = craftingId ? RECIPES.find(r => r.id === craftingId)?.name : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl flex flex-col"
           style={{ width: 'min(820px, 95vw)', height: 'min(700px, 90vh)' }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Crafting Buch</h2>
            <p className="text-slate-400 text-xs mt-0.5">
              {RECIPES.filter(r => !STRUCTURE_IDS.has(r.id) && craftingSystem.isDiscovered(r, inventory)).length} Rezepte entdeckt
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors text-lg">
            ✕
          </button>
        </div>

        {/* ── Fehlschlag-Banner ──────────────────────────────────── */}
        {failMessage && (
          <div className="px-6 py-2.5 border-b border-red-800 bg-red-950/60 flex-shrink-0 flex items-center gap-2">
            <span className="text-lg">💥</span>
            <div>
              <span className="text-red-300 font-semibold text-sm">Fehlschlag: {failMessage}</span>
              <span className="text-red-400/70 text-xs ml-2">Materialien verloren – versuche es erneut</span>
            </div>
          </div>
        )}

        {/* ── Active craft progress ───────────────────────────────── */}
        {craftingId && activeName && (
          <div className="px-6 py-3 border-b border-amber-800 bg-amber-950/40 flex-shrink-0">
            <div className="flex justify-between items-center text-sm mb-1.5">
              <span className="text-amber-300 font-semibold">Stellt her: {activeName}</span>
              <button onClick={cancelCraft} className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-700">
                Abbrechen
              </button>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-none"
                   style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* ── Body ───────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Category tabs */}
          <div className="w-36 border-r border-slate-700 p-3 space-y-1 flex-shrink-0 overflow-y-auto">
            {CATEGORY_DEFS.map(cat => {
              const count = (cat.key === 'all' ? RECIPES : RECIPES.filter(r => r.category === cat.key))
                .filter(r => !STRUCTURE_IDS.has(r.id) && craftingSystem.isDiscovered(r, inventory)).length;

              return (
                <button key={cat.key} onClick={() => setActiveCategory(cat.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    activeCategory === cat.key
                      ? 'bg-amber-700 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}>
                  <span>{cat.icon}</span>
                  <span className="flex-1">{cat.label}</span>
                  <span className="text-xs opacity-60">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Recipe grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {discovered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <div className="text-4xl mb-3 opacity-30">🌿</div>
                <div className="text-slate-400 text-sm font-semibold">Noch keine Rezepte entdeckt</div>
                <div className="text-slate-600 text-xs mt-1">Sammle Materialien um Rezepte freizuschalten</div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {discovered.map(recipe => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    inventory={inventory}
                    craftingId={craftingId}
                    progress={progress}
                    onCraft={startCraft}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer hint ─────────────────────────────────────────── */}
        <div className="px-6 py-2 border-t border-slate-700 flex-shrink-0 text-xs text-slate-500 flex gap-4">
          <span>Leertaste → sammeln</span>
          <span>C / Esc → schließen</span>
          <span className="ml-auto text-slate-600">Rezepte erscheinen beim Entdecken von Materialien</span>
        </div>
      </div>
    </div>
  );
}

// ── RecipeCard ────────────────────────────────────────────────────

function RecipeCard({ recipe, inventory, craftingId, progress, onCraft }: {
  recipe: Recipe;
  inventory: ReturnType<typeof usePlayerStore.getState>['player']['inventory'];
  craftingId: string | null;
  progress: number;
  onCraft: (id: string) => void;
}) {
  const hasMats      = craftingSystem.canCraft(recipe.id, inventory);
  const hasTool      = craftingSystem.hasRequiredTool(recipe, inventory);
  const hasSkill     = craftingSystem.hasRequiredSkill(recipe);
  const hasKnowledge = craftingSystem.hasRequiredKnowledge(recipe);
  const knowledge    = usePlayerStore(s => s.knowledge);
  const isActive     = craftingId === recipe.id;
  const busyCrafting = !!craftingId && !isActive;
  const effectiveTime = craftingSystem.getEffectiveCraftTime(recipe);

  const borderClass = isActive
    ? 'border-amber-500 bg-amber-900/20'
    : hasMats && hasTool && hasSkill && hasKnowledge
      ? 'border-green-700 bg-slate-700/60'
      : 'border-slate-600 bg-slate-700/40';

  return (
    <div className={`border rounded-xl p-4 transition-colors ${borderClass}`}>

      {/* Header */}
      <div className="flex items-start gap-2 mb-3">
        <span className="text-2xl leading-none mt-0.5">{recipe.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-sm leading-tight">{recipe.name}</div>
          <div className="text-slate-400 text-xs mt-0.5 leading-snug">{recipe.description}</div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="space-y-1 mb-3">
        {recipe.inputs.map(input => {
          const have = craftingSystem.getItemQuantity(inventory, input.resourceId);
          const enough = have >= input.quantity;
          return (
            <div key={input.resourceId} className="flex justify-between text-xs">
              <span className="text-slate-300">{ITEM_NAMES[input.resourceId] ?? input.resourceId}</span>
              <span className={`font-mono font-semibold ${enough ? 'text-green-400' : 'text-red-400'}`}>
                {have}/{input.quantity}
              </span>
            </div>
          );
        })}
      </div>

      {/* Active progress */}
      {isActive && (
        <div className="w-full bg-slate-600 rounded-full h-1.5 mb-2 overflow-hidden">
          <div className="h-full bg-amber-400 rounded-full"
               style={{ width: `${progress}%`, transition: 'width 50ms linear' }} />
        </div>
      )}

      {/* Tool requirement warning */}
      {!hasTool && recipe.requiresTool && recipe.requiresTool !== 'campfire_near' && (
        <div className="text-xs text-orange-400 mb-2 flex items-center gap-1">
          <span>⚠️</span>
          <span>Benötigt: {recipe.requiresTool === 'any_axe' ? 'Eine Axt' : (ITEM_NAMES[recipe.requiresTool] ?? recipe.requiresTool)}</span>
        </div>
      )}

      {/* Skill requirement */}
      {recipe.requiresSkill && (
        <div className={`text-xs mb-2 flex items-center gap-1 ${hasSkill ? 'text-slate-500' : 'text-purple-400'}`}>
          <span>{hasSkill ? '✓' : '📚'}</span>
          <span>
            {SKILL_LABELS[recipe.requiresSkill.skill]} Stufe {recipe.requiresSkill.level}
            {!hasSkill && ' erforderlich'}
          </span>
        </div>
      )}

      {/* Knowledge requirements */}
      {recipe.requiredKnowledge?.map(flag => {
        const known = knowledge[flag];
        return (
          <div key={flag} className={`text-xs mb-2 flex items-center gap-1 ${known ? 'text-slate-500' : 'text-cyan-400'}`}>
            <span>{known ? '✓' : '💡'}</span>
            <span>{KNOWLEDGE_LABELS[flag]}{!known && ' (noch nicht verstanden)'}</span>
          </div>
        );
      })}


      {/* Outputs preview */}
      <div className="text-xs text-slate-500 mb-3">
        → {recipe.outputs.map(o => `${o.quantity}× ${ITEM_NAMES[o.resourceId] ?? o.resourceId}`).join(', ')}
        {recipe.grantsSkill && (
          <span className="ml-1 text-amber-600/70">· +{recipe.grantsSkill.xp} {SKILL_LABELS[recipe.grantsSkill.skill]}</span>
        )}
      </div>

      {/* Button */}
      <button
        onClick={() => onCraft(recipe.id)}
        disabled={!hasMats || !hasTool || !hasSkill || !hasKnowledge || busyCrafting}
        className={`w-full py-2 text-xs font-bold rounded-lg transition-colors ${
          isActive              ? 'bg-amber-700 text-amber-200 cursor-wait' :
          !hasKnowledge         ? 'bg-slate-600 text-cyan-500 cursor-not-allowed' :
          !hasSkill             ? 'bg-slate-600 text-purple-400 cursor-not-allowed' :
          !hasTool              ? 'bg-slate-600 text-orange-400 cursor-not-allowed' :
          !hasMats              ? 'bg-slate-600 text-slate-500 cursor-not-allowed' :
          busyCrafting          ? 'bg-slate-600 text-slate-500 cursor-not-allowed' :
                                  'bg-green-700 hover:bg-green-600 text-white'
        }`}
      >
        {isActive        ? `Herstellung…  ${Math.round(progress)}%` :
         !hasKnowledge   ? `Erkenntnis fehlt` :
         !hasSkill       ? `Skill fehlt: ${SKILL_LABELS[recipe.requiresSkill!.skill]} Stufe ${recipe.requiresSkill!.level}` :
         !hasTool        ? 'Werkzeug fehlt' :
         !hasMats        ? 'Materialien fehlen' :
                           'Herstellen'}
      </button>
    </div>
  );
}
