import type Phaser from 'phaser';
import type { Tile } from '../../types/world';
import { artHash, isLowShore, TERRAIN_COLORS } from './TerrainArt';

export interface CliffEdge {
  x: number;
  y: number;
  side: number;
  elevation: number;
  difference: number;
  ground: number;
  ramp: boolean;
  rampMaterial: 'sand' | 'stone' | 'earth';
  joinsBefore: boolean;
  joinsAfter: boolean;
}

interface Point { x: number; y: number }
interface SurfacePoint extends Point { nx: number; ny: number; outerLimit?: number }
type Graphics = Phaser.GameObjects.Graphics;
const NEIGHBORS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const TANGENTS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

export function collectCliffEdges(tiles: Tile[][], x0: number, y0: number, x1: number, y1: number): CliffEdge[] {
  const edges: CliffEdge[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const high = tiles[y]?.[x];
    if (!high) continue;
    for (let side = 0; side < 4; side++) {
      const [dx, dy] = NEIGHBORS[side];
      const low = tiles[y + dy]?.[x + dx];
      if (!low || isLowShore(high, low)) continue;
      const difference = (high.elevation ?? 0) - (low.elevation ?? 0);
      if (difference <= 0) continue;
      const rampAt = (tx: number, ty: number) => {
        const a = tiles[ty]?.[tx], b = tiles[ty + dy]?.[tx + dx];
        return !!(a && b && a.walkable !== false && b.walkable !== false && a.elevation === high.elevation && b.elevation === low.elevation && (a.isRamp || b.isRamp));
      };
      const [tangentX, tangentY] = TANGENTS[side];
      const biomes = [high.type, low.type];
      edges.push({ x, y, side, elevation: high.elevation ?? 0, difference,
        ground: TERRAIN_COLORS[high.type] ?? 0x56764a,
        ramp: difference === 1 && high.walkable !== false && low.walkable !== false && !!(high.isRamp || low.isRamp),
        rampMaterial: biomes.some(type => type === 'sand' || type === 'beach') ? 'sand'
          : biomes.some(type => ['rock', 'mountain', 'hills'].includes(type)) ? 'stone' : 'earth',
        joinsBefore: rampAt(x - tangentX, y - tangentY),
        joinsAfter: rampAt(x + tangentX, y + tangentY),
      });
    }
  }
  return edges;
}

function ends(edge: CliffEdge, size: number): [Point, Point] {
  const x = edge.x * size, y = edge.y * size;
  if (edge.side === 0) return [{ x, y }, { x: x + size, y }];
  if (edge.side === 1) return [{ x: x + size, y }, { x: x + size, y: y + size }];
  if (edge.side === 2) return [{ x: x + size, y: y + size }, { x, y: y + size }];
  return [{ x, y: y + size }, { x, y }];
}

const vertexKey = (edge: CliffEdge, point: Point) => `${edge.elevation}:${point.x}:${point.y}`;

/** Prefer a right turn at diagonal contacts: touching plateau corners are separate contours. */
export function connectCliffEdges(edges: CliffEdge[], size: number): { previous: number[]; next: number[] } {
  const starts = new Map<string, number[]>();
  edges.forEach((edge, i) => {
    const key = vertexKey(edge, ends(edge, size)[0]);
    const bucket = starts.get(key) ?? [];
    bucket.push(i);
    starts.set(key, bucket);
  });
  const next = edges.map(edge => {
    const candidates = starts.get(vertexKey(edge, ends(edge, size)[1])) ?? [];
    return [...candidates].sort((a, b) => {
      const priority = (i: number) => [1, 0, 3, 2][(edges[i].side - edge.side + 4) % 4];
      return priority(a) - priority(b);
    })[0] ?? -1;
  });
  const previous = Array<number>(edges.length).fill(-1);
  next.forEach((target, source) => { if (target >= 0) previous[target] = source; });
  return { previous, next };
}

function cornerRadius(a: CliffEdge, b: CliffEdge | undefined, size: number): number {
  if (!b || a.side === b.side) return 0;
  return Math.min(size * 0.44, 8 + Math.max(a.difference, b.difference) * 2);
}

export function cliffSurface(edge: CliffEdge, previous: CliffEdge | undefined, next: CliffEdge | undefined, size: number): SurfacePoint[] {
  const [a, b] = ends(edge, size);
  const [dx, dy] = TANGENTS[edge.side];
  const startRadius = cornerRadius(edge, previous, size);
  const endRadius = cornerRadius(edge, next, size);
  const points: SurfacePoint[] = [
    { x: a.x + dx * startRadius, y: a.y + dy * startRadius, nx: dy, ny: -dx },
    { x: b.x - dx * endRadius, y: b.y - dy * endRadius, nx: dy, ny: -dx },
  ];
  if (endRadius && next) {
    const [ndx, ndy] = TANGENTS[next.side];
    const start = points[1], end = { x: b.x + ndx * endRadius, y: b.y + ndy * endRadius };
    for (let i = 1; i <= 5; i++) {
      const t = i / 5, u = 1 - t;
      const vx = u * (b.x - start.x) + t * (end.x - b.x);
      const vy = u * (b.y - start.y) + t * (end.y - b.y);
      const length = Math.hypot(vx, vy);
      points.push({ x: u * u * start.x + 2 * u * t * b.x + t * t * end.x,
        y: u * u * start.y + 2 * u * t * b.y + t * t * end.y,
        nx: vy / length, ny: -vx / length,
        // An inward corner must taper before its offset folds back over itself.
        outerLimit: (next.side - edge.side + 4) % 4 === 3
          ? endRadius * 0.64 / Math.max(0.001, Math.sin(Math.PI * t) ** 2) : undefined,
      });
    }
  }
  return points;
}

function polygon(g: Graphics, points: Point[], color: number, alpha = 1) {
  g.fillStyle(color, alpha);
  g.beginPath(); g.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) g.lineTo(points[i].x, points[i].y);
  g.closePath(); g.fillPath();
}

function band(g: Graphics, points: SurfacePoint[], inner: number, outer: number, color: number, alpha = 1) {
  const offset = (p: SurfacePoint, distance: number) => {
    const relief = 0.8 + Math.max(0, p.ny) * 0.5;
    const depth = distance > 0 ? Math.min(distance * relief, p.outerLimit ?? Infinity) : distance;
    const contour = Math.sin(p.x / 47 + p.y / 61) * 1.2 + Math.sin(p.x / 91 - p.y / 53) * 0.6;
    return { x: p.x + p.nx * (depth + contour), y: p.y + p.ny * (depth + contour) };
  };
  polygon(g, [
    ...points.map(p => offset(p, inner)),
    ...points.map(p => offset(p, outer)).reverse(),
  ], color, alpha);
}

/** Only the camera's tile neighborhood is processed; static geometry has no per-frame animation. */
export function drawCliffs(g: Graphics, tiles: Tile[][], x0: number, y0: number, x1: number, y1: number, size: number) {
  const edges = collectCliffEdges(tiles, x0, y0, x1, y1);
  const connections = connectCliffEdges(edges, size);
  const surfaces = edges.map((edge, i) => cliffSurface(edge, edges[connections.previous[i]], edges[connections.next[i]], size));

  // Broad subdued earth replaces the old bright lip / black base / vertical-post pattern.
  edges.forEach((edge, i) => {
    const points = surfaces[i];
    const depth = Math.min(17, 8 + edge.difference * 3);
    // A passage is a real gap in the cliff drawing: keep the underlying terrain visible.
    if (edge.ramp) return;
    band(g, points, depth - 2, depth + 5, 0x706e50, 0.23);
    band(g, points, -2, depth, edge.difference > 1 ? 0x74776b : 0x7d8060);
    band(g, points, 4, depth, 0x465642, edge.side === 1 || edge.side === 2 ? 0.27 : 0.12);
    band(g, points, -4, 1, edge.ground, 0.86);
  });

  edges.forEach(edge => {
    const [a, b] = ends(edge, size), [dx, dy] = TANGENTS[edge.side];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const local = (along: number, across: number) => ({ x: mx + dx * along + dy * across, y: my + dy * along - dx * across });
    if (edge.ramp) {
      const hash = artHash(edge.x, edge.y, edge.side);
      // Let the broken cliff ends taper into the opening, without painting a path.
      // Each side has its own profile; adjoining ramp tiles remain completely open.
      for (const sign of [-1, 1]) {
        if (sign < 0 ? edge.joinsBefore : edge.joinsAfter) continue;
        const variation = (hash >>> (sign < 0 ? 3 : 8)) % 4;
        const rim = size / 2;
        const tip = rim - 3 - variation;
        const depth = 8 + (variation % 3);
        polygon(g, [
          local(sign * rim, -2), local(sign * (tip + 1), -1),
          local(sign * tip, 3), local(sign * (tip + 2), depth - 2),
          local(sign * rim, depth),
        ], 0x7d8060, 0.78);
        polygon(g, [
          local(sign * rim, -3), local(sign * (tip + 1), -2),
          local(sign * tip, 1), local(sign * rim, 2),
        ], edge.ground, 0.86);

        // A tiny exposed stone, sand nick or root at the edge hints at the slope.
        const along = sign * (tip - 1.5), across = 4 + variation;
        if (edge.rampMaterial === 'stone') {
          polygon(g, [local(along - 1.8, across), local(along, across - 1.3),
            local(along + 2, across + 0.5), local(along + 0.4, across + 1.4)], 0x858779, 0.55);
        } else {
          const a = local(along, across), b = local(along + sign * 2, across + 1.2);
          g.lineStyle(0.8, edge.rampMaterial === 'sand' ? 0xa89972 : 0x6c7350, 0.35);
          g.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    } else if (artHash(edge.x, edge.y, edge.side) % 4 === 0) {
      polygon(g, [local(-7, 3), local(1, 2), local(6, 5), local(-2, 6)], 0xb0aa85, 0.26);
    }
  });
}
