import type { CraftJob } from '../types/crafting';
import { create } from 'zustand';
import { getRecipe } from '../data/recipes';
import { craftingSystem } from '../services/game/CraftingSystem';
import { normalizeCondition } from '../services/game/inventory';
import { rollCraftQuality, QUALITY_LABELS } from '../data/craftingBalance';
import { TOOL_MAX_DURABILITY } from '../data/toolDurability';
import { PERISHABLE_IDS } from '../data/foodDecay';
import { usePlayerStore } from './playerStore';
import { useGameStore } from './gameStore';
import { useJournalStore } from './journalStore';
import { useNotificationStore } from './notificationStore';
import type { StoredItem } from '../types/world';
import { useWorldStore } from './worldStore';

import { findSite, planConstruction, siteWorkReason, tickSite, updateSite } from '../services/game/ConstructionSystem';

interface CraftingState {
  job: CraftJob | null;
  message: string;
  failures: Record<string, number>;
  start: (recipeId: string) => boolean;
  startBuild: (id: string, x: number, y: number) => boolean;
  resumeBuild: (siteId: string) => boolean;
  cancel: () => void;
  update: (delta: number) => void;
}

export const useCraftingStore = create<CraftingState>((set, get) => ({
  job: null,
  message: '',
  failures: {},
  startBuild: (id, x, y) => {
    const reason = planConstruction(id, x, y);
    set({ message: reason ?? 'Bauplan gesetzt. Material anliefern und direkt daneben Bauen waehlen.' });
    return !reason;
  },
  resumeBuild: siteId => {
    if (get().job) { set({ message: 'Zuerst die aktive Arbeit unterbrechen.' }); return false; }
    const site = findSite(siteId);
    if (!site) return false;
    const reason = siteWorkReason(site);
    if (reason) { set({ message: reason }); return false; }
    set({ job: { recipeId: site.target, duration: site.work, elapsed: site.completed,
      playerId: usePlayerStore.getState().player.id,
      building: { x: site.x, y: site.y, seed: useWorldStore.getState().world!.seed, siteId } }, message: '' });
    return true;
  },
  start: recipeId => {
    if (get().job) return false;
    const recipe = getRecipe(recipeId);
    if (!recipe) return false;
    const reason = craftingSystem.getCraftBlockReason(recipe);
    if (reason) { set({ message: reason }); return false; }
    set({ job: { recipeId, duration: craftingSystem.getEffectiveCraftTime(recipe), elapsed: 0, playerId: usePlayerStore.getState().player.id }, message: '' });
    return true;
  },
  cancel: () => {
    const job = get().job;
    const site = job?.building?.siteId ? findSite(job.building.siteId) : undefined;
    if (site?.phase === 'carry') {
      const p = usePlayerStore.getState().player;
      updateSite({ ...site, cargoX: p.x, cargoY: p.y });
    }
    set({ job: null, message: job?.building ? 'Arbeit unterbrochen. Baustelle und Transportgut bleiben erhalten.' : 'Abgebrochen – Materialien bleiben erhalten.' });
  },
  update: delta => {
    const job = get().job;
    if (!job) return;
    const game = useGameStore.getState();
    const store = usePlayerStore.getState();
    if (job.playerId !== store.player.id || game.phase !== 'playing') { get().cancel(); return; }
    if (game.isPaused || game.isAwakening || game.showSleepMenu || document.hidden) return;
    if (job.building) {
      if (useWorldStore.getState().world?.seed !== job.building.seed || !job.building.siteId) { get().cancel(); return; }
      const result = tickSite(job.building.siteId, delta);
      const site = findSite(job.building.siteId);
      if (result.finished || result.pause || !site) {
        set({ job: null, message: result.pause ?? 'Bau abgeschlossen.' });
      } else set({ job: { ...job, elapsed: site.completed, duration: site.work }, message: '' });
      return;
    }
    const recipe = getRecipe(job.recipeId)!;
    const reason = craftingSystem.getCraftBlockReason(recipe);
    if (reason) { set({ job: null, message: `Abgebrochen: ${reason} Materialien bleiben erhalten.` }); return; }
    const elapsed = Math.min(job.duration, job.elapsed + delta);
    if (elapsed < job.duration) { set({ job: { ...job, elapsed } }); return; }

    const inputs = game.freeCraft ? [] : recipe.inputs;
    const isQualityRecipe = !!recipe.qualityBased || recipe.outputs.some(o => !!TOOL_MAX_DURABILITY[o.resourceId]);
    const level = store.player.skills[recipe.grantsSkill?.skill ?? recipe.requiresSkill?.skill ?? 'crafting'].level;
    // Keep the rolled outcome while waiting for space; other possible qualities need no slot.
    const quality = job.outcome ?? (isQualityRecipe && !game.freeCraft ? rollCraftQuality(level, get().failures[recipe.id] ?? 0, Math.random()) : 'standard');
    const failed = quality === 'failed';
    const outputs: StoredItem[] = failed ? [] : recipe.outputs.filter(o => o.resourceId !== 'coconut_water').map(o => ({
      ...o, ...normalizeCondition(o.resourceId, isQualityRecipe ? { quality } : {}),
      addedAt: PERISHABLE_IDS.has(o.resourceId) ? game.elapsedTime : undefined,
    }));
    // One component is lost on a failed attempt; bindings and handles can be reused.
    const consumed = failed && !game.freeCraft ? [{ ...recipe.inputs[0], quantity: 1 }] : inputs;
    if (!store.exchangeItems(consumed, outputs)) {
      set({ job: { ...job, elapsed: job.duration, outcome: quality }, message: 'Inventar voll – Platz für das Ergebnis schaffen oder abbrechen. Materialien bleiben erhalten.' });
      return;
    }
    set({ job: null, failures: { ...get().failures, [recipe.id]: failed ? (get().failures[recipe.id] ?? 0) + 1 : 0 } });
    craftingSystem.awardSkillXp(recipe, !failed);
    craftingSystem.damageToolOnCraft(recipe);
    if (!failed) {
      craftingSystem.grantKnowledge(recipe);
      const event = ({ knap_flint: 'first_knapping', flint_knife: 'first_knife', harden_stick: 'first_harden' } as Record<string, string>)[recipe.id];
      if (event) useJournalStore.getState().triggerJournalEvent(event);
      if (recipe.category === 'food') {
        store.learnKnowledge('knows_cooking');
        useJournalStore.getState().triggerJournalEvent('first_cook');
        const cookedCount = Object.entries(usePlayerStore.getState().craftCounts).filter(([id]) => id.startsWith('cooked_')).reduce((n, [, count]) => n + count, 0);
        if (cookedCount >= 3) {
          store.learnKnowledge('knows_preservation');
          useJournalStore.getState().triggerJournalEvent('first_cook_advanced');
        }
      }
      if (recipe.id === 'coconut_open') {
        const stats = usePlayerStore.getState().player.stats;
        store.updateStats({ thirst: Math.max(0, stats.thirst - 20), stamina: Math.min(100, stats.stamina + 8) });
        store.learnMaterial('coconut_water');
      }
    }
    const message = failed ? `${recipe.name}: misslungen. Eine Komponente verloren; du hast dazugelernt. Der nächste Versuch wird sicherer.`
      : `${recipe.name}: ${isQualityRecipe ? QUALITY_LABELS[quality] : 'fertig'}.`;
    set({ message });
    useNotificationStore.getState().addNotification(message, 'xp');
  },
}));
