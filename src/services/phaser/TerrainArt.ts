import type Phaser from 'phaser';
import type { Tile } from '../../types/world';

export const TERRAIN_COLORS: Record<string, number> = {
  water: 0x286d80, beach: 0xcbb784, sand: 0xcbb784,
  grass: 0x56764a, tall_grass: 0x4d7042, forest: 0x354f38,
  sparse_forest: 0x405e3d, dense_jungle: 0x263f32,
  hills: 0x74784e, rock: 0x77796f, mountain: 0x777365, impassable: 0x494b45,
};

export function artHash(x: number, y: number, salt = 0): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function isLowShore(a: Tile | undefined, b: Tile | undefined): boolean {
  if (!a || !b) return false;
  const land = a.type === 'water' ? b : b.type === 'water' ? a : undefined;
  return !!land && (land.type === 'sand' || land.type === 'beach') && land.elevation <= 1;
}

/** Static, world-anchored decoration; no clock or random state in the terrain path. */
export function drawTerrain(g: Phaser.GameObjects.Graphics, type: string, tx: number, ty: number, size: number) {
  const x = tx * size, y = ty * size;
  const h = artHash(tx, ty);
  const px = x + 7 + h % (size - 14), py = y + 9 + (h >>> 8) % (size - 18);
  g.fillStyle(TERRAIN_COLORS[type] ?? 0x77796f);
  g.fillRect(x, y, size, size);

  if (type === 'water') {
    // Matching endpoints continue the wave across adjacent tiles without a tile-shaped highlight.
    if (ty % 3 === 0) {
      const waveY = y + 13;
      g.lineStyle(1, 0x8cbdb5, 0.20);
      g.beginPath();
      g.moveTo(x, waveY + Math.sin(x / 37) * 2);
      for (let i = 1; i <= 4; i++) {
        const wx = x + i * size / 4;
        g.lineTo(wx, waveY + Math.sin(wx / 37) * 2);
      }
      g.strokePath();
    }
    return;
  }
  if (type === 'sand' || type === 'beach') {
    if (h % 4 === 0) {
      g.fillStyle(0xf0ddb0, 0.30);
      g.fillEllipse(px, py, 3, 1.5);
      g.fillStyle(0x9b895f, 0.22);
      g.fillEllipse(px + 5, py + 3, 2, 1);
    }
    return;
  }
  if (type === 'tall_grass') {
    const count = 1 + h % 2;
    for (let i = 0; i < count; i++) {
      const seed = artHash(tx, ty, i + 3);
      const bx = x + 6 + seed % (size - 12), by = y + 14 + (seed >>> 8) % (size - 17);
      g.fillStyle(0x344d32, 0.25);
      g.fillEllipse(bx, by, 10, 3);
      g.lineStyle(1.3, i ? 0x7d9556 : 0x718b50, 0.65);
      g.lineBetween(bx, by, bx - 4, by - 7);
      g.lineBetween(bx + 1, by, bx, by - 11);
      g.lineBetween(bx + 2, by, bx + 5, by - 8);
    }
    return;
  }
  if (['forest', 'sparse_forest', 'dense_jungle'].includes(type)) {
    if (h % 3 === 0) {
      g.fillStyle(0x9a9367, 0.20);
      g.fillTriangle(px - 4, py, px + 2, py - 2, px, py + 2);
      g.fillStyle(0x1c3029, 0.25);
      g.fillEllipse(px + 5, py + 4, 7, 3);
    }
    return;
  }
  if (type === 'grass' || type === 'hills') {
    if (h % 3 === 0) {
      g.lineStyle(1, type === 'hills' ? 0xa5a073 : 0x93a570, 0.35);
      g.lineBetween(px - 2, py, px - 4, py - 3);
      g.lineBetween(px, py, px + 2, py - 4);
    }
    return;
  }
  if (h % 3 === 0) {
    g.fillStyle(0xb5b3a0, 0.22);
    g.fillTriangle(px - 6, py, px, py - 4, px + 7, py - 1);
    g.lineStyle(1, 0x343d38, 0.30);
    g.lineBetween(px - 2, py + 3, px + 5, py + 1);
  }
}

const DIRECTIONS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const VEGETATION = new Set(['grass', 'tall_grass', 'forest', 'sparse_forest', 'dense_jungle', 'hills']);
const EDGE_PRIORITY: Record<string, number> = { grass: 0, hills: 0, tall_grass: 1, sparse_forest: 2, forest: 3, dense_jungle: 4 };

export function drawTerrainEdges(g: Phaser.GameObjects.Graphics, tiles: Tile[][], tx: number, ty: number, size: number) {
  const here = tiles[ty]?.[tx];
  if (!here || here.type === 'water') return;
  const sandy = here.type === 'sand' || here.type === 'beach';
  for (let side = 0; side < 4; side++) {
    const [dx, dy] = DIRECTIONS[side];
    const other = tiles[ty + dy]?.[tx + dx];
    if (!other || other.type === here.type) continue;
    const shore = isLowShore(here, other);
    const grassEdge = sandy && VEGETATION.has(other.type) && here.elevation === other.elevation;
    const forestEdge = VEGETATION.has(here.type) && EDGE_PRIORITY[other.type] > EDGE_PRIORITY[here.type]
      && here.elevation === other.elevation;
    if (!shore && !grassEdge && !forestEdge) continue;
    // Everything stays inside this tile, so the fog mask and collision footprint remain authoritative.
    const point = (u: number, v: number) => {
      const x = tx * size, y = ty * size;
      if (side === 0) return { x: x + u, y: y + v };
      if (side === 1) return { x: x + size - v, y: y + u };
      if (side === 2) return { x: x + size - u, y: y + size - v };
      return { x: x + v, y: y + size - u };
    };
    const band = (color: number, depth: number, alpha: number) => {
      const points = [point(0, 0), point(size, 0)];
      for (let i = 4; i >= 0; i--) {
        const variation = i === 0 || i === 4 ? 0 : artHash(tx, ty, side * 5 + i) % 3;
        points.push(point(i * size / 4, depth + variation));
      }
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(points[0].x, points[0].y);
      for (const p of points.slice(1)) g.lineTo(p.x, p.y);
      g.closePath();
      g.fillPath();
    };
    if (shore) {
      band(0xa99972, 7, 0.75);
      band(0x6d9e98, 3, 0.85);
      const a = point(2, 2), b = point(size - 2, 2);
      g.lineStyle(1.3, 0xe0e4ca, 0.65);
      g.lineBetween(a.x, a.y, b.x, b.y);
    } else {
      band(TERRAIN_COLORS[other.type], 6, 0.32);
      band(TERRAIN_COLORS[other.type], 2, 0.85);
    }
  }
}
