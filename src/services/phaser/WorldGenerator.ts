import type { Tile, WorldState, WorldResource } from '../../types';
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

    // Find beach spawn first so clusters can avoid it / be placed relative to it
    const { spawnX, spawnY } = this.findBeachSpawn(tileMap, width, height);

    // Force walkable clearing around spawn
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

    // Scattered frequency-based resources
    const resources = this.generateScattered(tileMap, rng);

    // Clustered resources
    this.generateClusters(resources, tileMap, rng, spawnX, spawnY);

    // Sticks: only under trees (forest/jungle tiles)
    this.generateSticks(resources, tileMap, rng);

    // Single spring inland from spawn
    const spring = this.placeSpring(tileMap, spawnX, spawnY, rng);
    if (spring) resources.push(spring);

    return { seed, width, height, tileMap, resources, structures: [], spawnX, spawnY };
  }

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
          resources.push({
            id: `resource-${resourceId}-${x}-${y}`,
            type: resourceId,
            x, y,
            quantity: rng.nextInt(config.minQuantity, config.maxQuantity),
            maxQuantity: config.maxQuantity,
            regenerationTime: resourceDef.regenerationTime,
            lastHarvestedAt: undefined,
          });
        }
      }
    }
    return resources;
  }

  private generateClusters(
    resources: WorldResource[],
    tileMap: Tile[][],
    rng: SeededRandom,
    spawnX: number,
    spawnY: number,
  ) {
    const configs: Record<string, ClusterConfig> = {
      // Stone quarries — deep inland, hills/mountain
      stone: {
        clusterCount: 3, radius: 13, density: 0.28,
        spawnOn: ['hills', 'mountain'],
        minQ: 2, maxQ: 5, minDistFromSpawn: 25,
      },
      // Pebble beds — on beach, reachable early
      pebbles: {
        clusterCount: 3, radius: 7, density: 0.40,
        spawnOn: ['beach'],
        minQ: 1, maxQ: 3, minDistFromSpawn: 5,
      },
      // Palm trees — beach clusters, main source of palm_leaf & fiber
      palm_tree: {
        clusterCount: 6, radius: 5, density: 0.28,
        spawnOn: ['beach'],
        minQ: 4, maxQ: 6, minDistFromSpawn: 0,
      },
      // Resin trees — deep in forest/jungle
      resin_tree: {
        clusterCount: 4, radius: 6, density: 0.18,
        spawnOn: ['sparse_forest', 'dense_jungle'],
        minQ: 3, maxQ: 5, minDistFromSpawn: 20,
      },
      // Coconut shells — scattered on beach near palms
      coconut_shell: {
        clusterCount: 5, radius: 4, density: 0.22,
        spawnOn: ['beach'],
        minQ: 1, maxQ: 2, minDistFromSpawn: 0,
      },
    };

    for (const [type, cfg] of Object.entries(configs)) {
      const def = RESOURCE_TYPES[type];
      if (!def) continue;

      // Collect valid center candidates
      const candidates: { x: number; y: number }[] = [];
      for (let y = 5; y < WORLD_CONFIG.height - 5; y++) {
        for (let x = 5; x < WORLD_CONFIG.width - 5; x++) {
          const tile = tileMap[y][x];
          if (!tile.walkable || !cfg.spawnOn.includes(tile.type)) continue;
          const dist = Math.hypot(x - spawnX, y - spawnY);
          if (dist < (cfg.minDistFromSpawn ?? 0)) continue;
          candidates.push({ x, y });
        }
      }

      // Pick cluster centers, spreading them apart
      const centers: { x: number; y: number }[] = [];
      let pool = [...candidates];
      for (let c = 0; c < cfg.clusterCount && pool.length > 0; c++) {
        const idx = Math.floor(rng.next() * pool.length);
        const center = pool[idx];
        centers.push(center);
        // Remove candidates too close to this center to spread clusters
        pool = pool.filter(p => Math.hypot(p.x - center.x, p.y - center.y) > cfg.radius * 2.5);
      }

      // Spawn resources within each cluster
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
              type,
              x, y,
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

  private generateSticks(resources: WorldResource[], tileMap: Tile[][], rng: SeededRandom) {
    const def = RESOURCE_TYPES['sticks'];
    if (!def) return;
    const { width, height } = WORLD_CONFIG;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (rng.next() >= 0.07) continue;
        const tile = tileMap[y][x];
        if (!tile.walkable) continue;
        if (!['sparse_forest', 'dense_jungle'].includes(tile.type)) continue;
        if (resources.some(r => r.x === x && r.y === y)) continue;
        resources.push({
          id: `resource-sticks-${x}-${y}`,
          type: 'sticks',
          x, y,
          quantity: rng.nextInt(1, 3),
          maxQuantity: 3,
          regenerationTime: def.regenerationTime,
          lastHarvestedAt: undefined,
        });
      }
    }
  }

  private placeSpring(tileMap: Tile[][], sx: number, sy: number, _rng: SeededRandom): WorldResource | null {
    for (let r = 10; r <= 22; r++) {
      for (let attempt = 0; attempt < r * 4; attempt++) {
        const angle = (attempt / (r * 4)) * Math.PI * 2;
        const x = Math.round(sx + Math.cos(angle) * r);
        const y = Math.round(sy + Math.sin(angle) * r);
        const tile = tileMap[y]?.[x];
        if (!tile?.walkable) continue;
        if (!['grass', 'tall_grass', 'hills', 'sparse_forest'].includes(tile.type)) continue;
        return {
          id: `resource-spring-${x}-${y}`,
          type: 'spring',
          x, y,
          quantity: 999,
          maxQuantity: 999,
          regenerationTime: 0,
          lastHarvestedAt: undefined,
        };
      }
    }
    return null;
  }

  private findBeachSpawn(tileMap: Tile[][], w: number, h: number): { spawnX: number; spawnY: number } {
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);
    for (let r = 1; r < Math.max(w, h) / 2; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3) continue;
          if (tileMap[y][x].type === 'beach') return { spawnX: x, spawnY: y };
        }
      }
    }
    return { spawnX: cx, spawnY: cy };
  }

  private generateTile(x: number, y: number, seed: number, w: number, h: number): Tile {
    const cx = w / 2;
    const cy = h / 2;
    const ndx = (x - cx) / (cx * 0.88);
    const ndy = (y - cy) / (cy * 0.88);
    const dist = Math.sqrt(ndx * ndx + ndy * ndy);
    const islandMask = Math.max(0, 1 - dist);

    const { elevationScale, moistureScale } = WORLD_CONFIG;
    const elev  = this.noise(x, y, seed, elevationScale) * islandMask;
    const moist = this.noise(x + 1000, y + 1000, seed, moistureScale);

    let type: string;
    if (elev < 0.05)       type = 'water';
    else if (elev < 0.18)  type = 'beach';
    else if (elev < 0.45) {
      if (moist < 0.35)      type = 'grass';
      else if (moist < 0.65) type = 'tall_grass';
      else                   type = 'sparse_forest';
    } else if (elev < 0.65) {
      if (moist < 0.40)      type = 'hills';
      else if (moist < 0.70) type = 'sparse_forest';
      else                   type = 'dense_jungle';
    } else if (elev < 0.82) type = 'hills';
    else if (elev < 0.93)   type = 'mountain';
    else                    type = 'impassable';

    const tileType = TILE_TYPES[type] ?? TILE_TYPES['impassable'];
    return {
      id: `tile-${x}-${y}`,
      type,
      walkable: tileType.walkable,
      x, y,
      spriteIndex: tileType.spriteIndex,
    };
  }

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
