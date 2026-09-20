import { createId } from './createId';
import type { ConstructionSite, Structure, WorldState } from '../../types/world';
import { getBuildDefinition } from '../../data/buildDefinitions';
import { buildWidth, MOVABLE_BUILDS, UPGRADES } from '../../data/construction';
import { craftTimeMultiplier } from '../../data/craftingBalance';
import { useWorldStore } from '../../store/worldStore';
import { usePlayerStore } from '../../store/playerStore';
import { useGameStore } from '../../store/gameStore';
import { useJournalStore } from '../../store/journalStore';
import { craftingSystem } from './CraftingSystem';
import { canPlaceBuilding } from './BuildingSystem';

const world = () => useWorldStore.getState().world!;
const save = (w: WorldState) => useWorldStore.setState({ world: w });
export const findSite = (id: string) => world()?.constructionSites?.find(s => s.id === id);
export function updateSite(site: ConstructionSite) {
  save({ ...world(), constructionSites: world().constructionSites?.map(s => s.id === site.id ? site : s) });
}
export function knownBuild(id: string) {
  const def = getBuildDefinition(id), p = usePlayerStore.getState();
  return !!def && (useGameStore.getState().freeCraft || (def.requiredKnowledge.every(k => p.knowledge[k]) &&
    (!def.visibleWhenSeen.length || def.visibleWhenSeen.some(m => p.knownMaterials.includes(m)))));
}
export function expansionTarget(type: string): string | null {
  let target: string | null = null;
  const visited = new Set<string>();
  while (UPGRADES[type] && !visited.has(type)) {
    visited.add(type);
    const next = UPGRADES[type].target;
    if (!knownBuild(next)) break;
    target = next; type = next;
  }
  return target;
}
export function adjacent(x: number, y: number, width = 1) {
  const p = usePlayerStore.getState().player, tiles = world()?.tileMap;
  const nearestX = Math.max(x, Math.min(x + width - 1, p.x));
  return Math.abs(p.x - nearestX) + Math.abs(p.y - y) === 1 && !!tiles?.[p.y]?.[p.x]?.walkable &&
    tiles[p.y][p.x].elevation === tiles[y]?.[nearestX]?.elevation &&
    !world().structures.some(s => s.y === p.y && p.x >= s.x && p.x < s.x + (s.width ?? 1));
}
export function planConstruction(target: string, x: number, y: number, sourceId?: string, move = false): string | null {
  const w = world(), def = getBuildDefinition(target), source = w?.structures.find(s => s.id === sourceId);
  if (!w || !def || !knownBuild(target)) return 'Bauplan noch nicht bekannt.';
  if (sourceId && (!source || w.constructionSites?.some(s => s.sourceId === sourceId))) return 'Dieser Bau wird bereits bearbeitet.';
  if (move && (!source || source.type !== target || !MOVABLE_BUILDS.has(target))) return 'Dieser Bau kann nicht versetzt werden.';
  if (move && ((source!.fuel ?? 0) > 0 || source!.storage?.length)) return 'Zuerst Feuer löschen bzw. Lager vollständig leeren.';
  if (move && source!.x === x && source!.y === y) return 'Wähle einen neuen Platz.';
  const upgrade = source && !move ? UPGRADES[source.type] : undefined;
  if (source && !move && upgrade?.target !== target) return 'Kein passendes Upgrade.';
  if (!canPlaceBuilding(target, x, y, sourceId)) return 'Fläche blockiert oder reserviert.';
  const site: ConstructionSite = {
    id: `site-${createId()}`, version: 1, target, x, y, width: buildWidth(target),
    work: move ? 5000 : (upgrade?.work ?? def.buildTime) * 1000, completed: 0,
    materials: (move || useGameStore.getState().freeCraft ? [] : upgrade?.materials ?? def.requiredMaterials).map(m => ({ ...m })),
    supplied: move || useGameStore.getState().freeCraft, sourceId,
    mode: move ? 'move' : source ? 'upgrade' : 'build', phase: move ? 'pack' : 'build',
  };
  save({ ...w, constructionSites: [...(w.constructionSites ?? []), site] });
  return null;
}

export function supplySite(id: string): string | null {
  const site = findSite(id), w = world(), store = usePlayerStore.getState();
  if (!site) return 'Baustelle fehlt.';
  if (!adjacent(site.x, site.y, site.width)) return 'Stelle dich direkt neben die Baustelle.';
  if (site.supplied) return null;
  const near = (v: { x: number; y: number }) => Math.abs(v.x - site.x) <= 3 && Math.abs(v.y - site.y) <= 3;
  const drops = w.droppedItems.map(d => ({ ...d }));
  const structures = w.structures.map(s => ({ ...s, storage: s.storage?.map(i => ({ ...i })) }));
  const sources = [...drops.filter(near), ...structures.filter(near).flatMap(s => s.storage ?? [])];
  const inputs: { resourceId: string; quantity: number }[] = [];
  const delivered = { ...site.delivered };
  let transferred = 0;
  for (const m of site.materials) {
    const needed = Math.max(0, m.amount - (delivered[m.item] ?? 0));
    const held = Math.min(needed, craftingSystem.getItemQuantity(store.player.inventory, m.item));
    let remaining = needed - held;
    inputs.push({ resourceId: m.item, quantity: held });
    for (const source of sources) if (source.resourceId === m.item) {
      const take = Math.min(source.quantity, remaining); source.quantity -= take; remaining -= take;
    }
    delivered[m.item] = (delivered[m.item] ?? 0) + needed - remaining;
    transferred += needed - remaining;
  }
  if (!transferred) return 'Kein noch benötigtes Material im Inventar oder in den nahen Vorräten.';
  if (!store.exchangeItems(inputs, [])) return 'Materialübernahme nicht möglich.';
  save({ ...world(), droppedItems: drops.filter(d => d.quantity > 0), structures: structures.map(s => ({ ...s, storage: s.storage?.filter(i => i.quantity > 0) })),
    constructionSites: w.constructionSites!.map(s => s.id === id ? { ...s, delivered, supplied: s.materials.every(m => delivered[m.item] >= m.amount) } : s) });
  return null;
}

export function siteWorkReason(site: ConstructionSite): string | null {
  const w = world(), source = w.structures.find(s => s.id === site.sourceId), p = usePlayerStore.getState();
  if (site.sourceId && !source && !site.cargo) return 'Ausgangsbau fehlt.';
  if (site.phase === 'carry') {
    const player = p.player;
    return Math.abs(player.x - site.cargoX!) + Math.abs(player.y - site.cargoY!) <= 1 ? null : 'Gehe zum abgelegten Transportgut.';
  }
  const position = site.phase === 'pack' ? source! : site;
  if (!adjacent(position.x, position.y, site.phase === 'pack' ? source!.width ?? 1 : site.width)) return 'Stelle dich direkt neben den Bau (gleiche Höhe, keine diagonale Arbeit).';
  if (site.phase === 'pack' && ((source!.fuel ?? 0) > 0 || source!.storage?.length)) return 'Feuer löschen und Inhalt leeren.';
  if (site.phase === 'pack' && (source!.coolingUntil ?? 0) > useGameStore.getState().elapsedTime) return 'Feuerstelle kühlt noch ab.';
  if (!canPlaceBuilding(site.target, site.x, site.y, site.sourceId, site.id, site.width)) return 'Zielfläche ist blockiert.';
  if (!site.supplied) return 'Zuerst Material übernehmen.';
  if (p.player.stats.stamina < 5) return 'Zu erschöpft zum Bauen.';
  const def = getBuildDefinition(site.target)!;
  if (!useGameStore.getState().freeCraft) {
    if (def.requiredKnowledge.some(k => !p.knowledge[k])) return 'Bauwissen fehlt.';
    if (def.requiredSkills.some(s => p.player.skills[s.skill].level < s.level)) return 'Bauskill fehlt.';
    if (def.requiredTools.some(tool => !craftingSystem.hasRequiredTool({ requiresTool: tool }, p.player.inventory))) return 'Bauwerkzeug fehlt.';
  }
  return null;
}

export function tickSite(id: string, delta: number): { finished?: boolean; pause?: string } {
  const site = findSite(id), p = usePlayerStore.getState();
  if (!site) return { finished: true };
  if (site.phase === 'carry') {
    updateSite({ ...site, cargoX: p.player.x, cargoY: p.player.y });
    if (adjacent(site.x, site.y, site.width)) {
      updateSite({ ...findSite(id)!, phase: 'build', completed: 0, work: 5000 });
      return { pause: 'Transport angekommen. Jetzt Aufbauen wählen.' };
    }
    return {};
  }
  const reason = siteWorkReason(site);
  if (reason) return { pause: reason };
  const def = getBuildDefinition(site.target)!, skill = def.grantsSkill?.skill === 'survival' ? 'survival' : 'building';
  const completed = Math.min(site.work, site.completed + delta / craftTimeMultiplier(p.player.skills[skill].level));
  const target = site.phase === 'pack' ? world().structures.find(s => s.id === site.sourceId)! : site;
  p.setDirection(p.player.y < target.y ? 'down' : p.player.y > target.y ? 'up' : p.player.x < target.x ? 'right' : 'left');
  const workedMs = (completed - site.completed) * craftTimeMultiplier(p.player.skills[skill].level);
  p.updateStats({ stamina: Math.max(0, p.player.stats.stamina - workedMs / 1000 * 0.8) });
  if (completed < site.work) { updateSite({ ...site, completed }); return {}; }
  if (site.phase === 'pack') {
    const w = world(), source = w.structures.find(s => s.id === site.sourceId)!;
    save({ ...w, structures: w.structures.filter(s => s.id !== source.id),
      buildReservations: w.buildReservations?.filter(r => r.ownerId !== source.id),
      constructionSites: w.constructionSites!.map(s => s.id === id ? { ...s, cargo: { ...source }, cargoX: p.player.x, cargoY: p.player.y, phase: 'carry', completed: 0 } : s) });
    return { pause: 'Verpackt. Tragen wählen und zum markierten Ziel gehen.' };
  }
  const w = world(), source = site.cargo ?? w.structures.find(s => s.id === site.sourceId);
  const maxHealth = site.mode === 'move' ? source!.maxHealth : 100 + (p.player.skills.building.level - 1) * 5;
  const built: Structure = { ...source, id: source?.id ?? `structure-${createId()}`, type: site.target, x: site.x, y: site.y, width: site.width,
    maxHealth, health: source ? Math.round(maxHealth * source.health / source.maxHealth) : maxHealth,
    ...(site.mode === 'build' && ['campfire', 'granite_campfire'].includes(site.target) ? { fuel: 1 } : {}),
    ...(site.mode === 'build' && site.target === 'water_container' ? { fuel: 0 } : {}),
  };
  save({ ...w, structures: [...w.structures.filter(s => s.id !== site.sourceId), built],
    constructionSites: w.constructionSites!.filter(s => s.id !== id),
    buildReservations: w.buildReservations?.map(r => r.ownerId === id ? { ...r, ownerId: built.id } : r) });
  if (useGameStore.getState().constructionSelected === id) useGameStore.setState({ constructionSelected: built.id });
  if (site.mode !== 'move') {
    if (def.grantsSkill) {
      p.gainSkillXp(def.grantsSkill.skill, Math.max(1, Math.round(def.grantsSkill.xp * p.getCraftXpMultiplier(`build:${site.target}`))));
      p.recordCraft(`build:${site.target}`);
    }
    for (const flag of def.grantsKnowledge ?? []) p.learnKnowledge(flag);
    for (const tool of def.requiredTools) craftingSystem.damageToolOnCraft({ requiresTool: tool });
    if (site.target === 'campfire') useJournalStore.getState().triggerJournalEvent('first_campfire');
    if (['palm_shelter', 'wooden_shelter'].includes(site.target)) useJournalStore.getState().triggerJournalEvent('first_wood_shelter');
  }
  return { finished: true };
}

export function abandonSite(id: string): string | null {
  const site = findSite(id), w = world();
  if (!site) return null;
  if (site.cargo) return 'Transportgut zuerst am Ziel aufbauen; es geht beim Unterbrechen nicht verloren.';
  const fraction = site.completed === 0 ? 1 : 0.5;
  const drops = site.materials.flatMap(m => {
    const quantity = Math.floor((site.supplied ? m.amount : site.delivered?.[m.item] ?? 0) * fraction);
    return quantity ? [{ id: `drop-${createId()}`, resourceId: m.item, quantity, x: site.x, y: site.y }] : [];
  });
  save({ ...w, droppedItems: [...w.droppedItems, ...drops], constructionSites: w.constructionSites!.filter(s => s.id !== id),
    buildReservations: w.buildReservations?.filter(r => r.ownerId !== id) });
  return null;
}

export function toggleReservation(ownerId: string): string | null {
  const w = world(), reservations = w.buildReservations ?? [];
  if (reservations.some(r => r.ownerId === ownerId)) { save({ ...w, buildReservations: reservations.filter(r => r.ownerId !== ownerId) }); return null; }
  const owner = w.structures.find(s => s.id === ownerId) ?? w.constructionSites?.find(s => s.id === ownerId);
  if (!owner) return 'Bau fehlt.';
  const type = 'type' in owner ? owner.type : owner.target;
  const target = expansionTarget(type);
  if (!target) return 'Noch kein bekannter größerer Ausbau.';
  if (!canPlaceBuilding(target, owner.x, owner.y, ownerId, ownerId)) return 'Ausbaufläche ist nicht frei.';
  save({ ...w, buildReservations: [...reservations, { ownerId, x: owner.x, y: owner.y, width: buildWidth(target) }] });
  return null;
}
