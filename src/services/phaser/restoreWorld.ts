import type { WorldState } from '../../types/world';
import { WorldGenerator } from './WorldGenerator';
import { LegacyWorldGenerator } from './LegacyWorldGenerator';
import { WORLD_CONFIG } from '../../data/worldConfig';
import { ISLAND_DEFAULTS } from '../../data/islandConfig';
import { migrateConstruction } from '../game/constructionMigration';

export function restoreWorld(saved: WorldState): WorldState {
  if (saved.generation && saved.generation.version !== 2) throw new Error('Unbekannte Inselgenerator-Version. Spielstand wird nicht verändert.');
  if (saved.width !== WORLD_CONFIG.width || saved.height !== WORLD_CONFIG.height) throw new Error('Die Kartengröße dieses Spielstands wird nicht unterstützt.');
  if (saved.generation && (!saved.generation.settings || Object.keys(ISLAND_DEFAULTS).some(key => !Object.hasOwn(saved.generation!.settings, key)))) {
    throw new Error('Die gespeicherten Inseleinstellungen sind unvollständig.');
  }
  const generated = saved.generation
    ? new WorldGenerator().generate(saved.seed, saved.generation.settings)
    : new LegacyWorldGenerator().generate(saved.seed);
  return migrateConstruction({ ...generated, structures: saved.structures, resources: saved.resources,
    constructionSites: saved.constructionSites ?? [], buildReservations: saved.buildReservations ?? [],
    droppedItems: saved.droppedItems ?? [], spawnX: saved.spawnX ?? generated.spawnX, spawnY: saved.spawnY ?? generated.spawnY });
}
