import type Phaser from 'phaser';
import type { Tile, WorldResource } from '../../types/world';
import { artHash } from './TerrainArt';

interface Point { x: number; y: number }
export interface TrailSegment { from: Point; to: Point; biome: string; fade: number }
const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

/** Decorative routes are computed once; they never change terrain or movement rules. */
export function buildTrails(tiles: Tile[][], resources: WorldResource[]): TrailSegment[] {
  const width = tiles[0]?.length ?? 0;
  if (!width) return [];
  const key = (p: Point) => p.y * width + p.x;
  const blockers = new Set(resources.filter(r => ['wood', 'palm_tree', 'large_tree', 'banyan_tree', 'resin_tree', 'stone', 'granite', 'iron_ore', 'obsidian'].includes(r.type)).map(key));
  const at = (p: Point) => tiles[p.y]?.[p.x];
  const canStep = (a: Point, b: Point) => {
    const from = at(a), to = at(b);
    return !!(from?.walkable && to?.walkable && !blockers.has(key(b)) && to.type !== 'water'
      && (from.elevation === to.elevation || (Math.abs(from.elevation - to.elevation) === 1 && (from.isRamp || to.isRamp))));
  };
  const segments = new Map<string, TrailSegment>();
  const add = (from: Point, to: Point, fade = 1) => {
    const id = [key(from), key(to)].sort((a, b) => a - b).join(':');
    if (!segments.has(id) || segments.get(id)!.fade < fade) segments.set(id, { from, to, biome: at(from).type, fade });
  };
  const spur = (start: Point, heading: number, length: number) => {
    let current = start;
    const visited = new Set([key(start)]);
    for (let step = 0; step < length; step++) {
      const turn = artHash(current.x, current.y, step) % 2 ? 1 : 3;
      const order = step % 3 === 2 ? [turn, 0, 4 - turn] : [0, turn, 4 - turn];
      const next = order.map(offset => {
        const [dx, dy] = directions[(heading + offset) % 4];
        return { x: current.x + dx, y: current.y + dy };
      }).find(p => !visited.has(key(p)) && canStep(current, p));
      if (!next) break;
      add(current, next, 1 - step / length * 0.8);
      visited.add(key(next));
      current = next;
    }
  };

  for (const row of tiles) for (const high of row) {
    if (!high.walkable || blockers.has(key(high))) continue;
    if (!high.isRamp && !directions.some(([dx, dy]) => tiles[high.y + dy]?.[high.x + dx]?.isRamp)) continue;
    for (const [heading, [dx, dy]] of directions.entries()) {
      const low = { x: high.x + dx, y: high.y + dy };
      if (!canStep(high, low) || at(low).elevation !== high.elevation - 1) continue;
      // One hint per wide opening instead of parallel tracks on every ramp tile.
      const adjacent = tiles[high.y - dx]?.[high.x + dy];
      if (adjacent?.isRamp && adjacent.elevation === high.elevation) continue;
      add(high, low);
      spur(high, (heading + 2) % 4, 5);
      spur(low, heading, 6);
      break;
    }
  }

  for (const water of resources.filter(r => r.type === 'spring' || r.type === 'puddle')) {
    if (!at(water)?.walkable) continue;
    const start = { x: water.x, y: water.y };
    const queue = [{ point: start, parent: -1, distance: 0 }];
    const visited = new Set([key(start)]);
    let found = -1;
    for (let i = 0; i < queue.length && i < 1200; i++) {
      const { point, distance } = queue[i];
      if (at(point).isRamp && distance > 1) { found = i; break; }
      if (distance >= 28) continue;
      for (const [dx, dy] of directions) {
        const next = { x: point.x + dx, y: point.y + dy };
        if (visited.has(key(next)) || !canStep(point, next)) continue;
        visited.add(key(next));
        queue.push({ point: next, parent: i, distance: distance + 1 });
      }
    }
    if (found >= 0) {
      while (queue[found].parent >= 0) {
        const parent = queue[found].parent;
        add(queue[found].point, queue[parent].point, 0.85);
        found = parent;
      }
    } else spur(start, artHash(water.x, water.y) % 4, 6);
  }
  return [...segments.values()];
}

export function drawTrails(g: Phaser.GameObjects.Graphics, trails: TrailSegment[], x0: number, y0: number, x1: number, y1: number, size: number) {
  const point = (p: Point) => ({
    x: (p.x + 0.5) * size + (artHash(p.x, p.y, 81) % 5 - 2),
    y: (p.y + 0.5) * size + (artHash(p.x, p.y, 82) % 5 - 2),
  });
  for (const trail of trails) {
    const { from, to, biome, fade } = trail;
    if (Math.max(from.x, to.x) < x0 || Math.min(from.x, to.x) > x1 || Math.max(from.y, to.y) < y0 || Math.min(from.y, to.y) > y1) continue;
    const a = point(from), b = point(to);
    const hash = artHash(from.x, from.y, to.x + to.y);
    const color = ['sand', 'beach'].includes(biome) ? 0x9d8d68 : ['mountain', 'rock', 'hills'].includes(biome) ? 0x9a9680 : 0xa49870;
    // Fragmented wear, with soft edges and no continuous road outline.
    for (let i = 0; i < 5; i++) {
      if ((hash + i) % 7 === 0) continue;
      const t = i / 5, u = (i + 0.85) / 5;
      const ax = a.x + (b.x - a.x) * t, ay = a.y + (b.y - a.y) * t;
      const bx = a.x + (b.x - a.x) * u, by = a.y + (b.y - a.y) * u;
      g.lineStyle(7 + hash % 3, color, 0.045 * fade);
      g.lineBetween(ax, ay, bx, by);
      g.lineStyle(3 + hash % 2, color, 0.09 * fade);
      g.lineBetween(ax, ay, bx, by);
    }
  }
}
