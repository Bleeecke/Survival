import { getBuildDefinition } from '../../data/buildDefinitions';
import { usePlayerStore } from '../../store/playerStore';
import { useWorldStore } from '../../store/worldStore';
import { useGameStore } from '../../store/gameStore';
import { craftingSystem } from './CraftingSystem';
import { craftTimeMultiplier } from '../../data/craftingBalance';
import { buildWidth } from '../../data/construction';

export function buildDuration(id: string): number {
  const def = getBuildDefinition(id)!;
  const skill = def.grantsSkill?.skill === 'survival' ? 'survival' : 'building';
  return Math.round(def.buildTime * 1000 * craftTimeMultiplier(usePlayerStore.getState().player.skills[skill].level));
}

export function buildMaterialQuantity(resourceId: string, x = usePlayerStore.getState().player.x, y = usePlayerStore.getState().player.y): number {
  const world = useWorldStore.getState().world;
  const nearby = (p: { x: number; y: number }) => Math.abs(p.x - x) <= 3 && Math.abs(p.y - y) <= 3;
  return craftingSystem.getItemQuantity(usePlayerStore.getState().player.inventory, resourceId)
    + (world?.droppedItems ?? []).filter(d => nearby(d) && d.resourceId === resourceId).reduce((n, d) => n + d.quantity, 0)
    + (world?.structures ?? []).filter(nearby).flatMap(s => s.storage ?? []).filter(i => i.resourceId === resourceId).reduce((n, i) => n + i.quantity, 0);
}

export function consumeBuildMaterials(id: string, x: number, y: number): boolean {
  const def = getBuildDefinition(id)!;
  if (useGameStore.getState().freeCraft) return true;
  if (def.requiredMaterials.some(m => buildMaterialQuantity(m.item, x, y) < m.amount)) return false;
  const world = useWorldStore.getState().world!;
  const drops = world.droppedItems.map(d => ({ ...d }));
  const structures = world.structures.map(s => ({ ...s, storage: s.storage?.map(i => ({ ...i })) }));
  const nearby = (p: { x: number; y: number }) => Math.abs(p.x - x) <= 3 && Math.abs(p.y - y) <= 3;
  const inputs = [];
  for (const material of def.requiredMaterials) {
    const held = Math.min(material.amount, craftingSystem.getItemQuantity(usePlayerStore.getState().player.inventory, material.item));
    inputs.push({ resourceId: material.item, quantity: held });
    let remaining = material.amount - held;
    const sources = [...drops.filter(nearby), ...structures.filter(nearby).flatMap(s => s.storage ?? [])];
    for (const item of sources) {
      if (item.resourceId !== material.item) continue;
      const taken = Math.min(remaining, item.quantity);
      item.quantity -= taken;
      remaining -= taken;
    }
  }
  if (!usePlayerStore.getState().exchangeItems(inputs, [])) return false;
  useWorldStore.setState({ world: { ...world, droppedItems: drops.filter(d => d.quantity > 0), structures: structures.map(s => ({ ...s, storage: s.storage?.filter(i => i.quantity > 0) })) } });
  return true;
}

export function buildBlockReason(id: string, x?: number, y?: number): string | null {
  const def = getBuildDefinition(id);
  if (!def) return 'Unbekannter Bauplan.';
  if (useGameStore.getState().freeCraft) return null;
  const { player, knowledge } = usePlayerStore.getState();
  if (def.requiredKnowledge.some(flag => !knowledge[flag])) return 'Bauwissen fehlt.';
  if (def.requiredSkills.some(s => player.skills[s.skill].level < s.level)) return 'Skillstufe fehlt.';
  if (def.requiredTools.some(tool => !craftingSystem.hasRequiredTool({ requiresTool: tool }, player.inventory))) return 'Bauwerkzeug fehlt.';
  if (def.requiredMaterials.some(m => buildMaterialQuantity(m.item, x, y) < m.amount)) return 'Baumaterial fehlt (Inventar und Vorräte im Umkreis von 3 Feldern).';
  return null;
}

export function canPlaceBuilding(id: string, x: number, y: number, ignoreId?: string, siteId?: string, widthOverride?: number): boolean {
  const world = useWorldStore.getState().world;
  if (!world) return false;
  const def = getBuildDefinition(id);
  const width = widthOverride ?? buildWidth(id);
  const interactive = ['campfire', 'granite_campfire', 'arbeitsplatz'];
  for (let dx = 0; dx < width; dx++) {
    const tx = x + dx;
    const tile = world.tileMap[y]?.[tx];
    if (!tile?.walkable || def?.placementRules?.blockedTerrain?.includes(tile.type)) return false;
    if (tile.elevation !== world.tileMap[y]?.[x]?.elevation) return false;
    if (world.resources.some(r => r.quantity > 0 && r.x === tx && r.y === y && ['wood', 'large_tree', 'banyan_tree', 'resin_tree', 'palm_tree', 'stone', 'granite', 'iron_ore', 'obsidian'].includes(r.type))) return false;
    if ((world.constructionSites ?? []).some(s => s.id !== siteId && s.y === y && tx >= s.x && tx < s.x + s.width)) return false;
    if ((world.constructionSites ?? []).some(s => s.id !== siteId && (interactive.includes(id) || interactive.includes(s.target)) && Math.abs(y - s.y) <= 2 && tx >= s.x - 2 && tx < s.x + s.width + 2)) return false;
    if ((world.buildReservations ?? []).some(r => r.ownerId !== ignoreId && r.ownerId !== siteId && r.y === y && tx >= r.x && tx < r.x + r.width)) return false;
    if (def?.placementRules?.requiresOpenSky && (tile.type === 'dense_jungle' || world.resources.some(r => ['palm_tree', 'large_tree', 'banyan_tree'].includes(r.type) && Math.abs(r.x - tx) <= 2 && Math.abs(r.y - y) <= 2))) return false;
    for (const s of world.structures) {
      if (s.id === ignoreId) continue;
      for (let sx = s.x; sx < s.x + (s.width ?? 1); sx++) {
        if (y === s.y && tx === sx) return false;
        if ((interactive.includes(id) || interactive.includes(s.type)) && Math.abs(tx - sx) <= 2 && Math.abs(y - s.y) <= 2) return false;
      }
    }
  }
  // Leave room for the existing two-tile interaction clearance around fire pits.
  if (def?.placementRules?.requiresNearbyFire && !world.structures.some(s => ['campfire', 'granite_campfire'].includes(s.type) && (s.fuel ?? 0) > 0 && Math.abs(s.x - x) <= 4 && Math.abs(s.y - y) <= 4)) return false;
  return true;
}
