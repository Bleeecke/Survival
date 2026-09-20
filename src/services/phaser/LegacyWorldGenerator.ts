// Frozen generator for pre-versioned saves. Do not tune this implementation.
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

export class LegacyWorldGenerator {
  generate(seed: number): WorldState {
    const rng = new SeededRandom(seed);
    const { width, height } = WORLD_CONFIG;

    // === Phase 1: Build heightfield (Diamond-Square + tectonic seams) ===
    const field = this.buildHeightField(width, height, seed, rng);

    // === Phase 2: Project biomes onto heightfield ===
    const tileMap: Tile[][] = this.projectBiomesOntoHeight(field, width, height, seed);

    // === Phase 3: Find spawn (needed before ramp placement) ===
    const { spawnX, spawnY } = this.findSouthBeachSpawn(tileMap, width, height);

    // === Phase 4: Place ramps at cliff edges ===
    this.placeRamps(tileMap, width, height, rng);

    // === Phase 5: Guarantee connectivity (force ramps for isolated regions) ===
    this.verifyConnectivity(tileMap, width, height, spawnX, spawnY);

    // Clear walkable area around spawn
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const tile = tileMap[spawnY + dy]?.[spawnX + dx];
        if (tile && !tile.walkable) {
          tile.type = 'beach';
          tile.walkable = true;
          tile.elevation = 1;
          tile.spriteIndex = TILE_TYPES['beach'].spriteIndex;
        }
      }
    }

    // Guarantee flint cluster very close to spawn (5–12 tiles)
    this.guaranteeFlintNearSpawn(tileMap, spawnX, spawnY, rng);

    const resources = this.generateScattered(tileMap, rng);
    this.generateClusters(resources, tileMap, rng, spawnX, spawnY);
    this.generateSticks(resources, tileMap, rng);
    this.generateLargeTrees(resources, tileMap, rng, spawnX, spawnY);

    const puddles = this.placePuddles(tileMap, spawnX, spawnY, rng);
    resources.push(...puddles);

    // DEV: 5×5 ore test block north of spawn on the beach
    const oreTypes = ['stone', 'stone', 'iron_ore', 'stone', 'granite'];
    for (let dy = -12; dy <= -8; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const bx = spawnX + dx, by = spawnY + dy;
        if (bx < 1 || by < 1 || bx >= width - 1 || by >= height - 1) continue;
        if (resources.some(r => r.x === bx && r.y === by)) continue;
        const tile = tileMap[by][bx];
        if (!tile.walkable) continue;
        const type = oreTypes[(dx + 2 + (dy + 12) * 5) % oreTypes.length];
        resources.push({
          id: `dev-ore-${bx}-${by}`, type, x: bx, y: by,
          quantity: 6, maxQuantity: 6, regenerationTime: 180000, lastHarvestedAt: undefined,
        });
      }
    }

    const shipwreck = this.generateShipwreck(tileMap, spawnX, spawnY, rng);

    return { seed, width, height, tileMap, resources, structures: [], droppedItems: [], spawnX, spawnY, shipwreck };
  }

  // ── Heightfield: Diamond-Square + tectonic seams + island mask ──────

  private buildHeightField(w: number, h: number, _seed: number, rng: SeededRandom): Float32Array {
    const S = 257; // 2^8 + 1 — required size for Diamond-Square
    const grid = new Float32Array(S * S);

    // Low corner values → island edges stay as water
    grid[0] = 0.05;
    grid[S - 1] = 0.05;
    grid[(S - 1) * S] = 0.05;
    grid[(S - 1) * S + S - 1] = 0.05;

    // Diamond-Square fractal heightmap
    let step = S - 1;
    let scale = 0.65;
    while (step >= 2) {
      const half = step >> 1;

      // Diamond step: fill center of each square
      for (let y = 0; y < S - 1; y += step) {
        for (let x = 0; x < S - 1; x += step) {
          const avg = (
            grid[y * S + x] +
            grid[y * S + (x + step)] +
            grid[(y + step) * S + x] +
            grid[(y + step) * S + (x + step)]
          ) / 4;
          grid[(y + half) * S + (x + half)] = avg + (rng.next() * 2 - 1) * scale;
        }
      }

      // Square step: fill edge midpoints
      for (let y = 0; y < S; y += half) {
        for (let x = (Math.floor(y / half) % 2 === 0) ? half : 0; x < S; x += step) {
          let sum = 0, count = 0;
          if (y - half >= 0) { sum += grid[(y - half) * S + x]; count++; }
          if (y + half < S)  { sum += grid[(y + half) * S + x]; count++; }
          if (x - half >= 0) { sum += grid[y * S + (x - half)]; count++; }
          if (x + half < S)  { sum += grid[y * S + (x + half)]; count++; }
          grid[y * S + x] = sum / count + (rng.next() * 2 - 1) * scale;
        }
      }

      step >>= 1;
      scale *= 0.52; // reduce roughness each octave
    }

    // Tectonic ridges lift interior terrain into cohesive mountain ranges
    this.applyTectonicSeams(grid, S, rng);

    // Ellipse island mask: enforce water at edges
    this.applyIslandMask(grid, S);

    // Normalize to 0–1
    let lo = grid[0], hi = grid[0];
    for (let i = 1; i < grid.length; i++) {
      if (grid[i] < lo) lo = grid[i];
      if (grid[i] > hi) hi = grid[i];
    }
    const range = hi - lo || 1;

    // Resample 257×257 → w×h
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = Math.round((x / (w - 1)) * (S - 1));
        const sy = Math.round((y / (h - 1)) * (S - 1));
        out[y * w + x] = (grid[sy * S + sx] - lo) / range;
      }
    }
    return out;
  }

  private applyTectonicSeams(grid: Float32Array, S: number, rng: SeededRandom): void {
    const numSeams = 2 + Math.floor(rng.next() * 2); // 2–3 ridges
    const center = S / 2;

    for (let i = 0; i < numSeams; i++) {
      const startX = center + (rng.next() - 0.5) * S * 0.28;
      const startY = center + (rng.next() - 0.5) * S * 0.28;
      const angle = rng.next() * Math.PI * 2;
      const length = S * 0.20 + rng.next() * S * 0.12;
      const endX = startX + Math.cos(angle) * length;
      const endY = startY + Math.sin(angle) * length;
      const strength = 0.30 + rng.next() * 0.22;
      const width = 14 + rng.next() * 10;

      const steps = Math.ceil(length * 2);
      for (let t = 0; t <= steps; t++) {
        const px = startX + (endX - startX) * (t / steps);
        const py = startY + (endY - startY) * (t / steps);
        const r = Math.ceil(width);
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const ix = Math.round(px + dx);
            const iy = Math.round(py + dy);
            if (ix < 1 || iy < 1 || ix >= S - 1 || iy >= S - 1) continue;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > width) continue;
            const influence = Math.exp(-(dist * dist) / (width * width * 0.25));
            grid[iy * S + ix] = Math.min(1.2, grid[iy * S + ix] + strength * influence);
          }
        }
      }
    }
  }

  private applyIslandMask(grid: Float32Array, S: number): void {
    const cx = S / 2, cy = S / 2;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const ndx = (x - cx) / (cx * 0.87);
        const ndy = (y - cy) / (cy * 0.82); // slightly taller island
        const dist = Math.sqrt(ndx * ndx + ndy * ndy);
        const mask = Math.max(0, 1 - Math.pow(Math.max(0, dist), 1.6));
        grid[y * S + x] *= mask;
      }
    }
  }

  // ── Biome projection: height → tile type + elevation ────────────────

  private projectBiomesOntoHeight(
    field: Float32Array, w: number, h: number, seed: number
  ): Tile[][] {
    const tileMap: Tile[][] = [];

    for (let y = 0; y < h; y++) {
      tileMap[y] = [];
      for (let x = 0; x < w; x++) {
        const raw = field[y * w + x];
        const moisture = this.noise(x + 1000, y + 1000, seed,     24);
        const rocky    = this.noise(x + 3000, y + 3000, seed + 1, 18);

        let type: string;
        let elevation: number;

        if (raw < 0.17) {
          // Deep water
          type = 'water'; elevation = 0;
        } else if (raw < 0.24) {
          // Beach / coast — same elevation tier as grassland (no cliff at shoreline)
          type = 'beach'; elevation = 1;
        } else if (raw < 0.50) {
          // Tier 1: lowland grassland
          elevation = 1;
          if      (moisture > 0.66) type = 'sparse_forest';
          else if (moisture > 0.44) type = 'tall_grass';
          else                       type = 'grass';
        } else if (raw < 0.71) {
          // Tier 2: forest plateau
          elevation = 2;
          if      (moisture > 0.58) type = 'dense_jungle';
          else if (moisture > 0.32) type = 'forest';
          else                       type = 'sparse_forest';
        } else if (raw < 0.87) {
          // Tier 3: highland hills / mountain
          elevation = 3;
          if      (rocky > 0.56)  type = 'mountain';
          else if (moisture > 0.5) type = 'forest';
          else                      type = 'hills';
        } else {
          // Tier 4: impassable peaks
          elevation = 4;
          type = (raw > 0.94 || rocky > 0.62) ? 'impassable' : 'mountain';
        }

        tileMap[y][x] = this.makeTile(x, y, type, elevation);
      }
    }

    return tileMap;
  }

  private makeTile(x: number, y: number, type: string, elevation: number): Tile {
    const tileTypeDef = TILE_TYPES[type] ?? TILE_TYPES['impassable'];
    return {
      id: `tile-${x}-${y}`,
      type,
      walkable: tileTypeDef.walkable,
      x, y,
      spriteIndex: tileTypeDef.spriteIndex,
      elevation,
      isRamp: false,
      rampDir: undefined,
    };
  }

  // ── Ramp placement: traversal passages between elevation tiers ───────

  private placeRamps(tileMap: Tile[][], w: number, h: number, _rng: SeededRandom): void {
    const MAX_SPACING = 22; // tiles between ramps on same cliff line

    // South-facing ramps (player walks south to descend)
    for (let ty = 1; ty < h - 2; ty++) {
      let runStart = -1;
      let lastRampX = -MAX_SPACING - 1;

      for (let tx = 0; tx <= w; tx++) {
        const here  = tx < w ? tileMap[ty][tx]     : null;
        const below = tx < w ? tileMap[ty + 1]?.[tx] : null;

        const isEdge = here && below &&
          here.walkable && below.walkable &&
          here.elevation - below.elevation === 1;

        if (isEdge) {
          if (runStart < 0) runStart = tx;
          if (tx - lastRampX >= MAX_SPACING) {
            here!.isRamp = true;
            here!.rampDir = 's';
            lastRampX = tx;
          }
        } else {
          // End of run: ensure at least one ramp was placed
          if (runStart >= 0 && lastRampX < runStart) {
            const midTx = Math.floor((runStart + tx - 1) / 2);
            if (tileMap[ty][midTx]?.isRamp === false) {
              tileMap[ty][midTx].isRamp = true;
              tileMap[ty][midTx].rampDir = 's';
            }
          }
          runStart = -1;
        }
      }
    }

    // North-facing ramps (for cliffs that only have a north-facing side)
    for (let ty = 2; ty < h - 1; ty++) {
      let runStart = -1;
      let lastRampX = -MAX_SPACING - 1;

      for (let tx = 0; tx <= w; tx++) {
        const here  = tx < w ? tileMap[ty][tx]     : null;
        const above = tx < w ? tileMap[ty - 1]?.[tx] : null;

        const isEdge = here && above &&
          here.walkable && above.walkable &&
          here.elevation - above.elevation === 1 &&
          !(above.isRamp); // already covered by south-facing pass

        if (isEdge) {
          if (runStart < 0) runStart = tx;
          if (tx - lastRampX >= MAX_SPACING) {
            here!.isRamp = true;
            here!.rampDir = 'n';
            lastRampX = tx;
          }
        } else {
          if (runStart >= 0 && lastRampX < runStart) {
            const midTx = Math.floor((runStart + tx - 1) / 2);
            if (tileMap[ty]?.[midTx] && !tileMap[ty][midTx].isRamp) {
              tileMap[ty][midTx].isRamp = true;
              tileMap[ty][midTx].rampDir = 'n';
            }
          }
          runStart = -1;
        }
      }
    }
  }

  // ── Connectivity guarantee: BFS + force-ramp isolated regions ────────

  private verifyConnectivity(tileMap: Tile[][], w: number, h: number, spawnX: number, spawnY: number): void {
    const visited = new Uint8Array(w * h);
    const queue: number[] = [];
    const idx = (x: number, y: number) => y * w + x;

    const canTraverse = (from: Tile, to: Tile): boolean => {
      if (!to.walkable) return false;
      const diff = to.elevation - from.elevation;
      if (diff === 0) return true;
      if (diff === -1) return true; // ledge down
      if (diff === 1 && (to.isRamp || from.isRamp)) return true;
      return false;
    };

    const start = idx(spawnX, spawnY);
    visited[start] = 1;
    queue.push(start);

    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const tx = cur % w, ty = Math.floor(cur / w);
      const tile = tileMap[ty][tx];

      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = idx(nx, ny);
        if (visited[ni]) continue;
        const neighbor = tileMap[ny][nx];
        if (canTraverse(tile, neighbor)) {
          visited[ni] = 1;
          queue.push(ni);
        }
      }
    }

    // Find walkable land tiles not yet reachable and force ramps
    for (let ty = 1; ty < h - 1; ty++) {
      for (let tx = 1; tx < w - 1; tx++) {
        const tile = tileMap[ty][tx];
        if (!tile.walkable || tile.elevation < 2) continue;
        if (visited[idx(tx, ty)]) continue;

        // Find nearest reachable neighbor at lower elevation and place ramp
        const below = tileMap[ty + 1]?.[tx];
        if (below && below.walkable && below.elevation === tile.elevation - 1 && visited[idx(tx, ty + 1)]) {
          tile.isRamp = true;
          tile.rampDir = 's';
        } else {
          const above = tileMap[ty - 1]?.[tx];
          if (above && above.walkable && above.elevation === tile.elevation - 1 && visited[idx(tx, ty - 1)]) {
            tile.isRamp = true;
            tile.rampDir = 'n';
          }
        }
      }
    }
  }

  // ── Spawn on SOUTH beach ─────────────────────────────────────────────

  private findSouthBeachSpawn(tileMap: Tile[][], w: number, h: number): { spawnX: number; spawnY: number } {
    const cx = Math.floor(w / 2);
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
      const r = 5 + rng.next() * 10;
      const angle = rng.next() * Math.PI * 2;
      const x = Math.round(sx + Math.cos(angle) * r);
      const y = Math.round(sy + Math.sin(angle) * r);
      const tile = tileMap[y]?.[x];
      if (!tile?.walkable || tile.type !== 'beach') continue;
      tileMap[y][x] = { ...tile, id: tile.id };
      placed++;
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
        clusterCount: 20, radius: 6, density: 0.35,
        spawnOn: ['beach', 'grass'], minQ: 3, maxQ: 5, minDistFromSpawn: 0,
      },
      resin_tree: {
        clusterCount: 8, radius: 7, density: 0.20,
        spawnOn: ['sparse_forest', 'forest', 'dense_jungle'], minQ: 3, maxQ: 5, minDistFromSpawn: 30,
      },
      rubber_tree: {
        clusterCount: 6, radius: 6, density: 0.15,
        spawnOn: ['dense_jungle'], minQ: 1, maxQ: 1, minDistFromSpawn: 55,
      },
      cacao_tree: {
        clusterCount: 7, radius: 5, density: 0.18,
        spawnOn: ['dense_jungle', 'forest'], minQ: 1, maxQ: 1, minDistFromSpawn: 40,
      },
      fern: {
        clusterCount: 20, radius: 5, density: 0.30,
        spawnOn: ['grass', 'tall_grass', 'sparse_forest', 'dense_jungle'], minQ: 1, maxQ: 1, minDistFromSpawn: 5,
      },
      pandanus: {
        clusterCount: 12, radius: 6, density: 0.22,
        spawnOn: ['sparse_forest', 'beach', 'grass'], minQ: 1, maxQ: 1, minDistFromSpawn: 10,
      },
      breadfruit_tree: {
        clusterCount: 10, radius: 6, density: 0.18,
        spawnOn: ['forest', 'sparse_forest'], minQ: 1, maxQ: 1, minDistFromSpawn: 20,
      },
      obsidian: {
        clusterCount: 3, radius: 5, density: 0.20,
        spawnOn: ['mountain'], minQ: 1, maxQ: 2, minDistFromSpawn: 80,
      },
      granite: {
        clusterCount: 5, radius: 8, density: 0.25,
        spawnOn: ['mountain', 'hills'], minQ: 1, maxQ: 3, minDistFromSpawn: 60,
      },
    };

    const rockFormationPasses: Array<[string, ClusterConfig]> = [
      ['granite', { clusterCount: 5, radius: 5, density: 0.40, spawnOn: ['hills', 'grass'],        minQ: 3, maxQ: 5, minDistFromSpawn: 40 }],
      ['stone',   { clusterCount: 7, radius: 4, density: 0.35, spawnOn: ['grass', 'sparse_forest'], minQ: 2, maxQ: 4, minDistFromSpawn: 35 }],
      ['stone',   { clusterCount: 5, radius: 3, density: 0.35, spawnOn: ['beach'],                  minQ: 1, maxQ: 3, minDistFromSpawn: 40 }],
    ];

    const bambooPasses: ClusterConfig[] = [
      { clusterCount: 5,  radius: 12, density: 0.28, spawnOn: ['forest', 'dense_jungle'],              minQ: 1, maxQ: 1, minDistFromSpawn: 20 },
      { clusterCount: 22, radius: 3,  density: 0.45, spawnOn: ['forest', 'dense_jungle', 'sparse_forest'], minQ: 1, maxQ: 1, minDistFromSpawn: 15 },
    ];
    const allConfigs: Array<[string, ClusterConfig]> = [
      ...Object.entries(configs),
      ...bambooPasses.map(cfg => ['bamboo', cfg] as [string, ClusterConfig]),
      ...rockFormationPasses,
    ];

    for (const [type, cfg] of allConfigs) {
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

  // ── Large trees (large_tree + banyan_tree) ───────────────────────────

  private generateLargeTrees(
    resources: WorldResource[],
    tileMap: Tile[][],
    rng: SeededRandom,
    spawnX: number,
    spawnY: number,
  ) {
    const placements: { x: number; y: number }[] = [];
    const MIN_SPACING = 10;
    const MIN_DIST_SPAWN = 25;

    const tryPlace = (type: 'large_tree' | 'banyan_tree', validBiomes: string[], count: number) => {
      const def = RESOURCE_TYPES[type];
      if (!def) return;

      const candidates: { x: number; y: number }[] = [];
      for (let y = 8; y < WORLD_CONFIG.height - 8; y++) {
        for (let x = 8; x < WORLD_CONFIG.width - 8; x++) {
          const tile = tileMap[y]?.[x];
          if (!tile?.walkable || !validBiomes.includes(tile.type)) continue;
          if (Math.hypot(x - spawnX, y - spawnY) < MIN_DIST_SPAWN) continue;
          candidates.push({ x, y });
        }
      }

      let pool = [...candidates];
      let placed = 0;
      while (placed < count && pool.length > 0) {
        const idx = Math.floor(rng.next() * pool.length);
        const { x, y } = pool[idx];

        const tooClose = placements.some(p => Math.hypot(p.x - x, p.y - y) < MIN_SPACING);
        if (!tooClose) {
          placements.push({ x, y });
          for (let i = resources.length - 1; i >= 0; i--) {
            if (Math.hypot(resources[i].x - x, resources[i].y - y) < 2) {
              resources.splice(i, 1);
            }
          }
          resources.push({
            id: `resource-${type}-${x}-${y}`,
            type, x, y,
            quantity: 1, maxQuantity: 1,
            regenerationTime: 0, lastHarvestedAt: undefined,
          });
          placed++;
        }
        pool = pool.filter(p => Math.hypot(p.x - x, p.y - y) > MIN_SPACING / 2);
      }
    };

    tryPlace('large_tree', ['sparse_forest', 'forest', 'dense_jungle', 'grass', 'tall_grass'], 50);
    tryPlace('banyan_tree', ['dense_jungle', 'forest'], 20);
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

    tryPlace(20, 35);
    tryPlace(45, 75);
    tryPlace(45, 75);
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
