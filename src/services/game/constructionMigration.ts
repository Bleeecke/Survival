import type { WorldState, ConstructionSite } from '../../types/world';
import { getBuildDefinition } from '../../data/buildDefinitions';
import { buildWidth } from '../../data/construction';

export function migrateConstruction(world: WorldState): WorldState {
  const sites = [...(world.constructionSites ?? [])];
  const structures = world.structures.filter(s => {
    if (s.type !== 'construction_site' || !s.constructionTarget) return true;
    const def = getBuildDefinition(s.constructionTarget);
    if (!def) return true;
    if (!sites.some(site => site.id === s.id)) {
      const days = s.constructionTarget === 'log_cabin' ? 4 : 2;
      sites.push({ id: s.id, version: 1, target: s.constructionTarget, x: s.x, y: s.y,
        // Existing saves must not silently occupy additional tiles.
        width: s.width ?? 1, work: def.buildTime * 1000,
        completed: def.buildTime * 1000 * Math.max(0, 1 - (s.constructionDaysLeft ?? days) / days),
        supplied: true, materials: [], phase: 'build', mode: 'build',
      } satisfies ConstructionSite);
    }
    return false;
  });
  return { ...world, structures, constructionSites: sites, buildReservations: world.buildReservations ?? [] };
}
export { buildWidth };
