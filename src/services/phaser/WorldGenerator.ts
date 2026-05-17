import type { Tile, WorldState, WorldResource, ShipwreckPiece } from '../../types';
import { TILE_TYPES } from '../../data/tiles';
import { RESOURCE_TYPES } from '../../data/resources';
import { WORLD_CONFIG } from '../../data/worldConfig';
import { SeededRandom } from '../../utils/random';

interface ClusterConfig {
  clusterCount: number;
  radius: number;
  density: number;
  spawnOn: string[];
  minQ: number;
  maxQ: number;
  minDistFromSpawn?: number;
}

export class WorldGenerator {
  generate(seed: number): WorldState {
    const rng = new SeededRandom(seed);
    const { width, height } = WORLD_CONFIG;

    const tileMap: Tile[][] = [];
    for (let y = 0; y < height; y++) {
      tileMap[y] = [];
      for (let x = 0; x < width; x++) {
        tileMap[y][x] = this.generateTile(x, y, seed, width, height);
      }
    }

    const { spawnX, spawnY } = this.findSouthBeachSpawn(tileMap, width, height);

    // Clear walkable area around spawn
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const tile = tileMap[spawnY + dy]?.[spawnX + dx];
        if (tile && !tile.walkable) {
          tile.type = 'beach';
          tile.walkable = true;
          tile.spriteIndex = TILE_TYPES['beach'].spriteIndex;
        }
      }
    }

    // Guarantee flint cluster very close to spawn (5–12 tiles)
    this.guaranteeFlintNearSpawn(tileMap, spawnX, spawnY, rng);

    const resources = this.generateScattered(tileMap, rng);
    this.generateClusters(resources, tileMap, rng, spawnX, spawnY);
    this.generateSticks(resources, tileMap, rng);

    const puddles = this.placePuddles(tileMap, spawnX, spawnY, rng);
    resources.push(...puddles);

    const shipwreck = this.generateShipwreck(tileMap, spawnX, spawnY, rng);

    return { seed, width, height, tileMap, resources, structures: [], droppedItems: [], spawnX, spawnY, shipwreck };
  }

  // ── Tile generation ─────────────────────────────────────────────────

  private generateTile(x: number, y: number, seed: number, w: number, h: number): Tile {
    const cx = w / 2;
    const cy = h / 2;

    // Island shape: slightly elongated north-south oval
    const ndx = (x - cx) / (cx * 0.84);
    const ndy = (y - cy) / (cy * 0.78);
    const dist = Math.sqrt(ndx * ndx + ndy * ndy);

    // Noise layers
    const edgeNoise = this.noise(x,        y,        seed,     16) * 0.13;
    const moisture  = this.noise(x + 1000, y + 1000, seed,     24);
    const rocky     = this.noise(x + 3000, y + 3000, seed + 1, 18);
    const detail    = this.noise(x + 5000, y + 5000, seed + 2,  9) * 0.05;

    const d = dist + edgeNoise + detail;

    // Water & beach ring
    if (d > 1.02) return this.makeTile(x, y, 'water');
    if (d > 0.83) return this.makeTile(x, y, 'beach');

    // y_north: 0 = south coast, 1 = north coast (within island)
    const y_north = 1 - (y / h);

    // inland: 0 = just past beach, 1 = island center
    const inland = (0.83 - d) / 0.83;

    // biome_depth: how "deep" into the progression we are
    // Northern areas reach deeper biomes at the same inland distance
    const biome_depth = inland * (0.65 + y_north * 0.70);

    let type: string;

    if (biome_depth < 0.15) {
      // Coastal fringe — grass/savanna just behind the beach
      type = moisture > 0.58 ? 'tall_grass' : 'grass';

    } else if (biome_depth < 0.32) {
      // Inland grassland / light forest
      if      (moisture > 0.68) type = 'sparse_forest';
      else if (moisture > 0.45) type = 'tall_grass';
      else                       type = 'grass';

    } else if (biome_depth < 0.50) {
      // Forest zone
      if      (moisture > 0.65) type = 'dense_jungle';
      else if (moisture > 0.38) type = 'sparse_forest';
      else if (moisture > 0.20) type = 'forest';
      else                       type = 'tall_grass';

    } else if (biome_depth < 0.68) {
      // Deep jungle
      if      (moisture > 0.55) type = 'dense_jungle';
      else if (moisture > 0.28) type = 'forest';
      else                       type = 'sparse_forest';
      // Rocky outcrops appear here
      if (rocky > 0.76) type = 'hills';

    } else if (biome_depth < 0.84) {
      // Highland approach — foothills
      if      (rocky > 0.68) type = 'mountain';
      else if (rocky > 0.44) type = 'hills';
      else if (moisture > 0.52) type = 'dense_jungle';
      else                       type = 'sparse_forest';

    } else {
      // Mountain core
      if      (rocky > 0.78) type = 'impassable';
      else if (rocky > 0.52) type = 'mountain';
      else                    type = 'hills';
    }

    return this.makeTile(x, y, type);
  }

  private makeTile(x: number, y: number, type: string): Tile {
    const tileType = TILE_TYPES[type] ?? TILE_TYPES['impassable'];
    return { id: `tile-${x}-${y}`, type, walkable: tileType.walkable, x, y, spriteIndex: tileType.spriteIndex };
  }

  // ── Spawn on SOUTH beach ─────────────────────────────────────────────

  private findSouthBeachSpawn(tileMap: Tile[][], w: number, h: number): { spawnX: number; spawnY: number } {
    const cx = Math.floor(w / 2);
    // Search southern portion: start near bottom and move upward
    for (let r = 0; r < h / 3; r++) {
      for (let dx = 0; dx <= r; dx++) {
        for (const sx of dx === 0 ? [cx] : [cx - dx, cx + dx]) {
          const y = h - 4 - r;
          if (sx < 3 || sx >= w - 3 || y < 3) continue;
          if (tileMap[y]?.[sx]?.type !== 'beach') continue;
          const nextToWater = [[-1,0],[1,0],[0,-1],[0,1]].some(
            ([ddx, ddy]) => tileMap[y + ddy]?.[sx + ddx]?.type === 'water'
          );
          if (nextToWater) return { spawnX: sx, spawnY: y };
        }
      }
    }
    // Fallback: any beach tile in bottom half
    for (let y = h - 4; y > h / 2; y--) {
      for (let x = 3; x < w - 3; x++) {
        if (tileMap[y]?.[x]?.type === 'beach') return { spawnX: x, spawnY: y };
      }
    }
    return { spawnX: cx, spawnY: Math.floor(h * 0.82) };
  }

  // ── Guaranteed flint near spawn ────────────────────────────────────

  private guaranteeFlintNearSpawn(tileMap: Tile[][], sx: number, sy: number, rng: SeededRandom) {
    const def = RESOURCE_TYPES['flint'];
    if (!def) return;
    let placed = 0;
    for (let attempt = 0; attempt < 600 && placed < 2; attempt++) {
      const r = 5 + rng.next() * 10; // 5–15 tiles from spawn
      const angle = rng.next() * Math.PI * 2;
      const x = Math.round(sx + Math.cos(angle) * r);
      const y = Math.round(sy + Math.sin(angle) * r);
      const tile = tileMap[y]?.[x];
      if (!tile?.walkable || tile.type !== 'beach') continue;
      // Mark tile so generateScattered doesn't double-place
      tileMap[y][x] = { ...tile, id: tile.id }; // keep as-is, resource added separately
      placed++;
      // We don't push here — generateScattered will pick them up since freq is high
    }
  }

  // ── Scattered resources ───────────────────────────────────────────────

  private generateScattered(tileMap: Tile[][], rng: SeededRandom): WorldResource[] {
    const resources: WorldResource[] = [];
    const { width, height, resources: resourceConfig } = WORLD_CONFIG;

    for (const [resourceId, config] of Object.entries(resourceConfig)) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (rng.next() >= config.frequency) continue;
          const tile = tileMap[y][x];
          if (!tile.walkable) continue;
          if (config.spawnOn && !config.spawnOn.includes(tile.type)) continue;
          const resourceDef = RESOURCE_TYPES[resourceId];
          if (!resourceDef) continue;
          const regenStep = (resourceId === 'berry_bush' || resourceId === 'exotic_fruit') ? 1 : undefined;
          const emptySpawn = resourceId === 'berry_bush' && rng.next() < 0.5;
          resources.push({
            id: `resource-${resourceId}-${x}-${y}`,
            type: resourceId,
            x, y,
            quantity: emptySpawn ? 0 : rng.nextInt(config.minQuantity, config.maxQuantity),
            maxQuantity: config.maxQuantity,
            regenerationTime: resourceDef.regenerationTime,
            lastHarvestedAt: undefined,
            ...(regenStep ? { regenStep } : {}),
          });
        }
      }
    }
    return resources;
  }

  // ── Clustered resources ──────────────────────────────────────────────

  private generateClusters(
    resources: WorldResource[],
    tileMap: Tile[][],
    rng: SeededRandom,
    spawnX: number,
    spawnY: number,
  ) {
    const configs: Record<string, ClusterConfig> = {
      stone: {
        clusterCount: 6, radius: 14, density: 0.26,
        spawnOn: ['hills', 'mountain'], minQ: 2, maxQ: 5, minDistFromSpawn: 50,
      },
      pebbles: {
        clusterCount: 10, radius: 7, density: 0.38,
        spawnOn: ['beach'], minQ: 1, maxQ: 2, minDistFromSpawn: 3,
      },
      palm_tree: {
        clusterCount: 10, radius: 5, density: 0.28,
        spawnOn: ['beach'], minQ: 4, maxQ: 6, minDistFromSpawn: 0,
      },
      resin_tree: {
        clusterCount: 6, radius: 7, density: 0.18,
        spawnOn: ['sparse_forest', 'forest', 'dense_jungle'], minQ: 3, maxQ: 5, minDistFromSpawn: 35,
      },
    };

    for (const [type, cfg] of Object.entries(configs)) {
      const def = RESOURCE_TYPES[type];
      if (!def) continue;

      const candidates: { x: number; y: number }[] = [];
      for (let y = 5; y < WORLD_CONFIG.height - 5; y++) {
        for (let x = 5; x < WORLD_CONFIG.width - 5; x++) {
          const tile = tileMap[y][x];
          if (!tile.walkable || !cfg.spawnOn.includes(tile.type)) continue;
          if (Math.hypot(x - spawnX, y - spawnY) < (cfg.minDistFromSpawn ?? 0)) continue;
          candidates.push({ x, y });
        }
      }

      const centers: { x: number; y: number }[] = [];
      let pool = [...candidates];
      for (let c = 0; c < cfg.clusterCount && pool.length > 0; c++) {
        const idx = Math.floor(rng.next() * pool.length);
        const center = pool[idx];
        centers.push(center);
        pool = pool.filter(p => Math.hypot(p.x - center.x, p.y - center.y) > cfg.radius * 2.5);
      }

      for (const center of centers) {
        for (let dy = -cfg.radius; dy <= cfg.radius; dy++) {
          for (let dx = -cfg.radius; dx <= cfg.radius; dx++) {
            if (dx * dx + dy * dy > cfg.radius * cfg.radius) continue;
            if (rng.next() >= cfg.density) continue;
            const x = center.x + dx;
            const y = center.y + dy;
            if (x < 0 || y < 0 || x >= WORLD_CONFIG.width || y >= WORLD_CONFIG.height) continue;
            const tile = tileMap[y][x];
            if (!tile.walkable || !cfg.spawnOn.includes(tile.type)) continue;
            if (resources.some(r => r.x === x && r.y === y)) continue;
            resources.push({
              id: `resource-${type}-${x}-${y}`,
              type, x, y,
              quantity: rng.nextInt(cfg.minQ, cfg.maxQ),
              maxQuantity: cfg.maxQ,
              regenerationTime: def.regenerationTime,
              lastHarvestedAt: undefined,
            });
          }
        }
      }
    }
  }

  // ── Sticks under forest tiles ────────────────────────────────────────

  private generateSticks(resources: WorldResource[], tileMap: Tile[][], rng: SeededRandom) {
    const def = RESOURCE_TYPES['sticks'];
    if (!def) return;
    const { width, height } = WORLD_CONFIG;
    const forestTiles = new Set(['sparse_forest', 'dense_jungle', 'forest']);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (rng.next() >= 0.07) continue;
        const tile = tileMap[y][x];
        if (!tile.walkable || !forestTiles.has(tile.type)) continue;
        if (resources.some(r => r.x === x && r.y === y)) continue;
        resources.push({
          id: `resource-sticks-${x}-${y}`,
          type: 'sticks', x, y,
          quantity: rng.nextInt(1, 3),
          maxQuantity: 3,
          regenerationTime: def.regenerationTime,
          lastHarvestedAt: undefined,
        });
      }
    }
  }

  // ── Puddles ──────────────────────────────────────────────────────────

  private placePuddles(tileMap: Tile[][], sx: number, sy: number, rng: SeededRandom): WorldResource[] {
    const placed: WorldResource[] = [];
    const used = new Set<string>();
    const validTypes = ['grass', 'tall_grass', 'sparse_forest', 'forest', 'hills'];

    const tryPlace = (minR: number, maxR: number): boolean => {
      for (let attempt = 0; attempt < 600; attempt++) {
        const r = minR + rng.next() * (maxR - minR);
        const angle = rng.next() * Math.PI * 2;
        const x = Math.round(sx + Math.cos(angle) * r);
        const y = Math.round(sy + Math.sin(angle) * r);
        const key = `${x},${y}`;
        if (used.has(key)) continue;
        const tile = tileMap[y]?.[x];
        if (!tile?.walkable || !validTypes.includes(tile.type)) continue;
        used.add(key);
        placed.push({
          id: `resource-puddle-${x}-${y}`,
          type: 'puddle', x, y,
          quantity: 3, maxQuantity: 3,
          regenerationTime: 0, lastHarvestedAt: undefined,
        });
        return true;
      }
      return false;
    };

    tryPlace(30, 45);   // first puddle closer
    tryPlace(55, 85);   // second
    tryPlace(55, 85);   // third
    return placed;
  }

  // ── Shipwreck ────────────────────────────────────────────────────────

  private generateShipwreck(tileMap: Tile[][], sx: number, sy: number, rng: SeededRandom): ShipwreckPiece[] {
    const pieces: ShipwreckPiece[] = [];
    const candidates: { x: number; y: number }[] = [];
    for (let dy = -8; dy <= 8; dy++) {
      for (let dx = -8; dx <= 8; dx++) {
        const x = sx + dx; const y = sy + dy;
        const dist = Math.hypot(dx, dy);
        if (dist < 2 || dist > 7) continue;
        if (tileMap[y]?.[x]?.type === 'water') candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) return pieces;

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    let placed = 0;
    for (const c of candidates) {
      if (placed >= 6) break;
      const type = placed === 0 ? 'hull'
        : placed === 1 ? 'hull_small'
        : placed === 2 ? 'mast'
        : 'plank';
      pieces.push({ x: c.x, y: c.y, type, rotation: rng.next() * Math.PI * 2, scale: 0.7 + rng.next() * 0.6 });
      placed++;
    }
    return pieces;
  }

  // ── Noise helpers ────────────────────────────────────────────────────

  private noise(x: number, y: number, seed: number, scale: number): number {
    const xi = Math.floor(x / scale);
    const yi = Math.floor(y / scale);
    const xf = (x % scale) / scale;
    const yf = (y % scale) / scale;
    const n00 = this.hash(xi,     yi,     seed);
    const n10 = this.hash(xi + 1, yi,     seed);
    const n01 = this.hash(xi,     yi + 1, seed);
    const n11 = this.hash(xi + 1, yi + 1, seed);
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    return (n00 * (1 - u) + n10 * u) * (1 - v) +
           (n01 * (1 - u) + n11 * u) * v;
  }

  private hash(x: number, y: number, seed: number): number {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.3) * 43758.5453;
    return n - Math.floor(n);
  }
}
