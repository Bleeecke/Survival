import { widenRamps } from './RampLayout';
import { ISLAND_RESOURCE_CLUSTERS, ISLAND_RESOURCE_LAYOUT } from '../../data/islandResources';
import { resolveIslandSettings } from '../../data/islandConfig';
import type { IslandSettings } from '../../types/generation';
import { islandDistances, quantile, smoothField } from './IslandTerrain';
import type { Tile, WorldState, WorldResource, ShipwreckPiece } from '../../types';
import { TILE_TYPES } from '../../data/tiles';
import { RESOURCE_TYPES } from '../../data/resources';
import { WORLD_CONFIG } from '../../data/worldConfig';
import { SeededRandom } from '../../utils/random';


export class WorldGenerator {
  private settings = resolveIslandSettings();
  private readonly plants = new Set(['wood', 'berry_bush', 'sticks', 'coconut', 'herbs', 'fiber', 'grass_tuft', 'mushroom', 'exotic_fruit', 'vine', 'rubber_tree', 'cacao_tree', 'pandanus', 'breadfruit_tree', 'bamboo', 'palm_tree', 'resin_tree', 'fern']);

  generate(seed: number, overrides: Partial<IslandSettings> = {}): WorldState {
    if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('Der Insel-Seed muss eine nichtnegative ganze Zahl sein.');
    this.settings = resolveIslandSettings(overrides);
    const rng = new SeededRandom(seed);
    const { width, height } = WORLD_CONFIG;

    // === Phase 1: Build heightfield (Diamond-Square + tectonic seams) ===
    const field = this.buildHeightField(width, height, rng);

    // === Phase 2: Project biomes onto heightfield ===
    const tileMap: Tile[][] = this.projectBiomesOntoHeight(field, width, height, seed);

    this.normalizeElevationSteps(tileMap, width, height);

    // === Phase 3: Find spawn (needed before ramp placement) ===
    const { spawnX, spawnY } = this.findSouthBeachSpawn(tileMap, width, height);

    // === Phase 4: Place ramps at cliff edges ===
    this.placeRamps(tileMap, width, height);

    // Clear walkable area around spawn
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const tile = tileMap[spawnY + dy]?.[spawnX + dx];
        if (tile && tile.type !== 'water' && !tile.walkable) {
          tile.type = 'beach';
          tile.walkable = true;
          tile.elevation = 1;
          tile.spriteIndex = TILE_TYPES['beach'].spriteIndex;
        }
      }
    }

    // Recheck reachability after preparing the spawn area.
    this.verifyConnectivity(tileMap, width, height, spawnX, spawnY);

    const resources = this.generateScattered(tileMap, rng);
    this.generateClusters(resources, tileMap, rng, spawnX, spawnY);
    this.generateSticks(resources, tileMap, rng);
    this.generateLargeTrees(resources, tileMap, rng, spawnX, spawnY);

    const puddles = this.placePuddles(tileMap, spawnX, spawnY, rng);
    resources.push(...puddles);

    for (let i = resources.length - 1; i >= 0; i--) {
      if (Math.abs(resources[i].x - spawnX) <= 1 && Math.abs(resources[i].y - spawnY) <= 1) resources.splice(i, 1);
    }
    resources.push(...this.guaranteeFlintNearSpawn(resources, tileMap, spawnX, spawnY));

    // DEV: 5×5 ore test block north of spawn on the beach
    const oreTypes = ['stone', 'stone', 'iron_ore', 'stone', 'granite'];
    if (this.settings.debugOreBlock) for (let dy = -12; dy <= -8; dy++) {
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
    widenRamps(tileMap);

    return { seed, width, height, tileMap, resources, structures: [], droppedItems: [], spawnX, spawnY, shipwreck, generation: { version: 2, settings: { ...this.settings } } };
  }

  // ── Heightfield: Diamond-Square + tectonic seams + island mask ──────

  private buildHeightField(w: number, h: number, rng: SeededRandom): Float32Array {
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
      scale *= 0.32 + this.settings.terrainRoughness * 0.36; // reduce roughness each octave
    }

    // Tectonic ridges lift interior terrain into cohesive mountain ranges
    this.applyTectonicSeams(grid, S, rng);

    // Ellipse island mask: enforce water at edges
    let baseMin = Infinity, baseMax = -Infinity;
    for (const value of grid) { baseMin = Math.min(baseMin, value); baseMax = Math.max(baseMax, value); }
    for (let i = 0; i < grid.length; i++) grid[i] = (grid[i] - baseMin) / (baseMax - baseMin || 1);
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
    const center = S / 2;
    for (let i = 0; i < this.settings.mountainRidges; i++) {
      const ax = center + (rng.next() - 0.5) * S * 0.28;
      const ay = center + (rng.next() - 0.5) * S * 0.28;
      const angle = rng.next() * Math.PI * 2;
      const length = S * (0.20 + rng.next() * 0.12);
      const vx = Math.cos(angle) * length, vy = Math.sin(angle) * length;
      const width = this.settings.ridgeWidth;
      for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
        const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (length * length)));
        const distance = Math.hypot(x - ax - t * vx, y - ay - t * vy);
        if (distance > width * 2) continue;
        grid[y * S + x] += this.settings.ridgeStrength * Math.exp(-distance * distance / (width * width * 0.5));
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
    const distances = islandDistances(field, w, h, this.settings, seed);
    const terrain = smoothField(field, w, h, Math.floor(this.settings.plateauSize / 2));
    const inland = Array.from(terrain).filter((_, i) => distances[i] > this.settings.beachWidth);
    const plateau = quantile(inland, 1 - this.settings.plateauFraction - this.settings.mountainFraction);
    const mountain = quantile(inland, 1 - this.settings.mountainFraction);
    const peak = quantile(inland, 1 - this.settings.mountainFraction * 0.15);

    for (let y = 0; y < h; y++) {
      tileMap[y] = [];
      for (let x = 0; x < w; x++) {
        const raw = terrain[y * w + x];
        const coastDistance = distances[y * w + x];
        const moisture = this.noise(x + 1000, y + 1000, seed,     this.settings.moistureScale);
        const rocky    = this.noise(x + 3000, y + 3000, seed + 1, this.settings.rockScale);

        let type: string;
        let elevation: number;

        if (coastDistance === 0) {
          // Deep water
          type = 'water'; elevation = 0;
        } else if (coastDistance <= this.settings.beachWidth) {
          // Beach / coast — same elevation tier as grassland (no cliff at shoreline)
          type = 'beach'; elevation = 1;
        } else if (raw < plateau) {
          // Tier 1: lowland grassland
          elevation = 1;
          if      (moisture > 0.66) type = 'sparse_forest';
          else if (moisture > 0.44) type = 'tall_grass';
          else                       type = 'grass';
        } else if (raw < mountain) {
          // Tier 2: forest plateau
          elevation = 2;
          if      (moisture > 0.58) type = 'dense_jungle';
          else if (moisture > 0.32) type = 'forest';
          else                       type = 'sparse_forest';
        } else if (raw < peak) {
          // Tier 3: highland hills / mountain
          elevation = 3;
          if      (rocky > 0.56)  type = 'mountain';
          else if (moisture > 0.5) type = 'forest';
          else                      type = 'hills';
        } else {
          // Tier 4: impassable peaks
          elevation = 4;
          type = (rocky > 0.62) ? 'impassable' : 'mountain';
        }

        tileMap[y][x] = this.makeTile(x, y, type, elevation);
      }
    }

    return tileMap;
  }

  private normalizeElevationSteps(tiles: Tile[][], w: number, h: number) {
    for (let pass = 0; pass < 4; pass++) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const tile = tiles[y][x];
        const limit = Math.min(tiles[y - 1][x].elevation, tiles[y + 1][x].elevation, tiles[y][x - 1].elevation, tiles[y][x + 1].elevation) + 1;
        if (tile.elevation <= limit) continue;
        let type = tile.type;
        if (type === 'impassable') type = 'mountain';
        if (limit === 1 && ['mountain', 'hills'].includes(type)) type = 'grass';
        tiles[y][x] = this.makeTile(x, y, type, limit);
      }
    }
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

  private placeRamps(tileMap: Tile[][], w: number, h: number): void {
    const placed: { x: number; y: number }[] = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const high = tileMap[y][x];
      if (!high.walkable) continue;
      for (const [dx, dy, direction] of [[0, -1, 'n'], [1, 0, 'e'], [0, 1, 's'], [-1, 0, 'w']] as const) {
        const low = tileMap[y + dy][x + dx];
        if (!low.walkable || high.elevation - low.elevation !== 1) continue;
        if (placed.some(p => Math.hypot(p.x - x, p.y - y) < this.settings.rampSpacing)) continue;
        high.isRamp = true; high.rampDir = direction; placed.push({ x, y }); break;
      }
    }
  }

  private verifyConnectivity(tileMap: Tile[][], w: number, h: number, spawnX: number, spawnY: number): void {
    const visited = new Uint8Array(w * h);
    const queue = [spawnY * w + spawnX]; visited[queue[0]] = 1;
    let head = 0;
    const directions = [[0, -1, 'n'], [1, 0, 'e'], [0, 1, 's'], [-1, 0, 'w']] as const;
    while (true) {
      while (head < queue.length) {
        const current = queue[head++], x = current % w, y = Math.floor(current / w);
        for (const [dx, dy] of directions) {
          const nx = x + dx, ny = y + dy, next = tileMap[ny]?.[nx];
          if (!next || visited[ny * w + nx] || !next.walkable) continue;
          const from = tileMap[y][x], difference = next.elevation - from.elevation;
          if (difference === 0 || difference === -1 || (difference === 1 && (from.isRamp || next.isRamp))) {
            visited[ny * w + nx] = 1; queue.push(ny * w + nx);
          }
        }
      }
      let repaired = false;
      for (let i = 0; i < queue.length && !repaired; i++) {
        const current = queue[i], x = current % w, y = Math.floor(current / w);
        for (const [dx, dy, direction] of directions) {
          const nx = x + dx, ny = y + dy, next = tileMap[ny]?.[nx];
          if (!next?.walkable || visited[ny * w + nx] || next.elevation !== tileMap[y][x].elevation + 1) continue;
          tileMap[y][x].isRamp = true; tileMap[y][x].rampDir = direction;
          visited[ny * w + nx] = 1; queue.push(ny * w + nx); repaired = true; break;
        }
      }
      if (!repaired) {
        const hasIsolatedLand = tileMap.some((row, y) => row.some((tile, x) => tile.walkable && !visited[y * w + x]));
        if (!hasIsolatedLand) break;
        // A tiny walkable pocket can be enclosed by impassable peaks. Open the shortest land passage.
        const parents = new Int32Array(w * h).fill(-1), search = [...queue];
        for (const i of search) parents[i] = -2;
        let target = -1;
        for (let cursor = 0; cursor < search.length && target < 0; cursor++) {
          const current = search[cursor], x = current % w, y = Math.floor(current / w);
          for (const [dx, dy] of directions) {
            const nx = x + dx, ny = y + dy, next = tileMap[ny]?.[nx], index = ny * w + nx;
            if (!next || next.type === 'water' || parents[index] !== -1 || Math.abs(next.elevation - tileMap[y][x].elevation) > 1) continue;
            parents[index] = current; search.push(index);
            if (next.walkable && !visited[index]) { target = index; break; }
          }
        }
        if (target < 0) break;
        while (parents[target] >= 0) {
          const x = target % w, y = Math.floor(target / w), parent = parents[target];
          if (!tileMap[y][x].walkable) {
            const old = tileMap[y][x];
            tileMap[y][x] = { ...this.makeTile(x, y, 'mountain', old.elevation), isRamp: old.isRamp, rampDir: old.rampDir };
          }
          const a = tileMap[y][x], b = tileMap[Math.floor(parent / w)][parent % w];
          if (a.elevation !== b.elevation) {
            const high = a.elevation > b.elevation ? a : b, low = high === a ? b : a;
            high.isRamp = true;
            high.rampDir = low.x > high.x ? 'e' : low.x < high.x ? 'w' : low.y > high.y ? 's' : 'n';
          }
          if (!visited[target]) { visited[target] = 1; queue.push(target); }
          target = parent;
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

  private guaranteeFlintNearSpawn(resources: WorldResource[], tiles: Tile[][], sx: number, sy: number): WorldResource[] {
    const queue = [{ x: sx, y: sy, distance: 0 }], seen = new Set([`${sx},${sy}`]);
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      if (current.distance >= 14) continue;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const x = current.x + dx, y = current.y + dy, next = tiles[y]?.[x];
        if (!next?.walkable || seen.has(`${x},${y}`)) continue;
        const from = tiles[current.y][current.x], difference = next.elevation - from.elevation;
        if (!(difference === 0 || difference === -1 || (difference === 1 && (from.isRamp || next.isRamp)))) continue;
        seen.add(`${x},${y}`); queue.push({ x, y, distance: current.distance + 1 });
      }
    }
    const occupied = new Set(resources.map(r => `${r.x},${r.y}`));
    const candidates = queue.filter(p => p.distance >= 5 && tiles[p.y][p.x].type === 'beach' && !occupied.has(`${p.x},${p.y}`));
    const added: WorldResource[] = [];
    for (const [type, count] of [['flint', 2], ['pebbles', 1]] as const) {
      const existing = resources.filter(r => r.type === type && r.quantity > 0 && seen.has(`${r.x},${r.y}`)).length;
      for (let i = existing; i < count; i++) {
        const spot = candidates.shift();
        if (!spot) throw new Error('Kein freier, erreichbarer Strandplatz f?r Startressourcen.');
        added.push({ id: `starter-${type}-${spot.x}-${spot.y}`, type, x: spot.x, y: spot.y, quantity: 2, maxQuantity: 2,
          regenerationTime: RESOURCE_TYPES[type]?.regenerationTime });
      }
    }
    return added;
  }

  private generateScattered(tileMap: Tile[][], rng: SeededRandom): WorldResource[] {
    const resources: WorldResource[] = [];
    const { width, height, resources: resourceConfig } = WORLD_CONFIG;

    for (const [resourceId, config] of Object.entries(resourceConfig)) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (rng.next() >= config.frequency * (this.plants.has(resourceId) ? this.settings.vegetationDensity : 1)) continue;
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
    for (const [type, cfg] of ISLAND_RESOURCE_CLUSTERS) {
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
            if (rng.next() >= cfg.density * (this.plants.has(type) ? this.settings.vegetationDensity : 1)) continue;
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
        if (rng.next() >= ISLAND_RESOURCE_LAYOUT.extraSticksFrequency * this.settings.vegetationDensity) continue;
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
    const MIN_SPACING = ISLAND_RESOURCE_LAYOUT.largeTreeSpacing;
    const MIN_DIST_SPAWN = ISLAND_RESOURCE_LAYOUT.largeTreeSpawnDistance;

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
      while (placed < Math.round(count * this.settings.vegetationDensity) && pool.length > 0) {
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

    tryPlace('large_tree', ['sparse_forest', 'forest', 'dense_jungle', 'grass', 'tall_grass'], ISLAND_RESOURCE_LAYOUT.largeTreeCount);
    tryPlace('banyan_tree', ['dense_jungle', 'forest'], ISLAND_RESOURCE_LAYOUT.banyanCount);
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
