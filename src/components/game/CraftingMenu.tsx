import { useState, useEffect, useRef } from 'react';
import { RECIPES } from '../../data/recipes';
import { craftingSystem } from '../../services/game/CraftingSystem';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import type { Recipe } from '../../types';

type CategoryFilter = 'all' | Recipe['category'];

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  tool: 'Tools',
  shelter: 'Shelter',
  food: 'Food',
};

const STRUCTURE_CATEGORIES = new Set<Recipe['category']>(['shelter']);
const STRUCTURE_RECIPE_IDS = new Set(['campfire']);

export default function CraftingMenu() {
  const [filter, setFilter] = useState<CategoryFilter>('all');
  const [craftingId, setCraftingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const craftStartRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const inventory = usePlayerStore(s => s.player.inventory);

  const categories: CategoryFilter[] = ['all', 'tool', 'shelter', 'food'];
  const filtered = filter === 'all' ? RECIPES : RECIPES.filter(r => r.category === filter);

  function startCraft(recipeId: string) {
    if (craftingId) return;
    const inv = usePlayerStore.getState().player.inventory;
    if (!craftingSystem.canCraft(recipeId, inv)) return;

    const recipe = RECIPES.find(r => r.id === recipeId)!;
    setCraftingId(recipeId);
    setProgress(0);
    craftStartRef.current = Date.now();

    intervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - craftStartRef.current!;
      const pct = Math.min(100, (elapsed / recipe.craftingTime) * 100);
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

    if (!craftingSystem.canCraft(recipeId, player.inventory)) {
      setCraftingId(null);
      return;
    }

    for (const input of recipe.inputs) {
      removeResource(input.resourceId, input.quantity);
    }

    const isStructure =
      STRUCTURE_CATEGORIES.has(recipe.category) || STRUCTURE_RECIPE_IDS.has(recipeId);

    if (isStructure) {
      const { x, y } = usePlayerStore.getState().player;
      useWorldStore.getState().placeStructure(recipeId, x, y);
    } else {
      for (const output of recipe.outputs) {
        addToInventory(output.resourceId, output.quantity);
      }
    }

    setCraftingId(null);
    setProgress(0);
    craftStartRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const activeName = craftingId ? RECIPES.find(r => r.id === craftingId)?.name : null;

  return (
    <div className="p-4 border-t border-slate-700">
      <h3 className="text-lg font-bold text-white mb-3">Crafting</h3>

      {/* Category tabs */}
      <div className="flex gap-1 mb-3">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              filter === cat
                ? 'bg-amber-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Active crafting progress */}
      {craftingId && activeName && (
        <div className="mb-3 p-2 bg-amber-900/40 border border-amber-700 rounded">
          <div className="flex justify-between items-center text-sm text-amber-300 mb-1">
            <span>Crafting: {activeName}</span>
            <button
              onClick={cancelCraft}
              className="text-slate-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="w-full bg-slate-700 rounded h-2">
            <div
              className="h-full bg-amber-500 rounded transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Recipe list */}
      <div className="space-y-2">
        {filtered.map(recipe => {
          const canCraft = craftingSystem.canCraft(recipe.id, inventory);
          const isActive = craftingId === recipe.id;

          return (
            <div
              key={recipe.id}
              className={`p-2 rounded border text-sm ${
                isActive
                  ? 'border-amber-600 bg-amber-900/20'
                  : canCraft
                  ? 'border-slate-600 bg-slate-700'
                  : 'border-slate-700 bg-slate-800 opacity-60'
              }`}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-white font-medium">{recipe.name}</span>
                <button
                  onClick={() => startCraft(recipe.id)}
                  disabled={!canCraft || !!craftingId}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    canCraft && !craftingId
                      ? 'bg-green-700 hover:bg-green-600 text-white'
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {recipe.craftingTime / 1000}s
                </button>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {recipe.inputs.map(input => {
                  const have = craftingSystem.getItemQuantity(inventory, input.resourceId);
                  return (
                    <span
                      key={input.resourceId}
                      className={`text-xs ${
                        have >= input.quantity ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {input.resourceId} {have}/{input.quantity}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
