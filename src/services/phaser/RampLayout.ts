import type { Tile } from '../../types/world';
import { artHash } from './TerrainArt';

/** Widen selected existing passages without changing terrain, RNG or removing any route. */
export function widenRamps(tiles: Tile[][]): void {
  const passages = tiles.flat().filter(tile => tile.isRamp);
  for (const tile of passages) {
    if (artHash(tile.x, tile.y, 71) % 3 === 0) continue;
    for (const [dx, dy, dir] of [[0, -1, 'n'], [1, 0, 'e'], [0, 1, 's'], [-1, 0, 'w']] as const) {
      const low = tiles[tile.y + dy]?.[tile.x + dx];
      if (!tile.walkable || !low?.walkable || tile.elevation - low.elevation !== 1) continue;
      const sign = artHash(tile.x, tile.y, 72) % 2 ? 1 : -1;
      const highNext = tiles[tile.y + dx * sign]?.[tile.x - dy * sign];
      const lowNext = tiles[tile.y + dy + dx * sign]?.[tile.x + dx - dy * sign];
      if (!highNext?.walkable || !lowNext?.walkable || highNext.elevation !== tile.elevation || lowNext.elevation !== low.elevation) continue;
      highNext.isRamp = true;
      highNext.rampDir = dir;
    }
  }
}
