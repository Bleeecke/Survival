const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
require('../scripts/art-graphics.cjs');
const { WorldGenerator } = require('../src/services/phaser/WorldGenerator.ts');
const { LegacyWorldGenerator } = require('../src/services/phaser/LegacyWorldGenerator.ts');
const { restoreWorld } = require('../src/services/phaser/restoreWorld.ts');
const { ISLAND_DEFAULTS, ISLAND_PRESETS, resolveIslandSettings } = require('../src/data/islandConfig.ts');
const { summarizeIsland, reachableTiles } = require('../scripts/island-summary.cjs');
const { smoothField } = require('../src/services/phaser/IslandTerrain.ts');
const { widenRamps } = require('../src/services/phaser/RampLayout.ts');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cache = new Map();
const generate = (seed, settings = {}) => {
  const key = JSON.stringify([seed, settings]);
  if (!cache.has(key)) cache.set(key, new WorldGenerator().generate(seed, settings));
  return cache.get(key);
};

test('seed and resolved settings reproduce terrain, ramps, resources and spawn', () => {
  const world = generate(42);
  assert.equal(hash(new WorldGenerator().generate(42, world.generation.settings)), hash(world));
  assert.notEqual(hash(generate(137).tileMap), hash(world.tileMap));
  assert.equal(world.generation.version, 2);
  assert.notEqual(world.generation.settings, ISLAND_DEFAULTS);
});

test('nine preset/seed combinations have an ocean border, valid spawn and reachable height tiers', () => {
  for (const seed of [42, 137, 2026]) for (const settings of Object.values(ISLAND_PRESETS)) {
    const world = generate(seed, settings), stats = summarizeIsland(world);
    assert.equal(stats.unreachable, 0, `${seed}: unreachable land`);
    assert.equal(stats.heightJumps, 0, `${seed}: height jump greater than one`);
    assert.equal(world.tileMap[world.spawnY][world.spawnX].type, 'beach');
    assert.ok(stats.landPercent > 40 && stats.landPercent < 65);
    for (let i = 0; i < world.width; i++) {
      assert.equal(world.tileMap[0][i].type, 'water');
      assert.equal(world.tileMap.at(-1)[i].type, 'water');
      assert.equal(world.tileMap[i][0].type, 'water');
      assert.equal(world.tileMap[i].at(-1).type, 'water');
    }
    const near = reachableTiles(world, 14);
    for (const [type, count] of [['flint', 2], ['pebbles', 1]]) {
      assert.ok(world.resources.filter(r => r.type === type && r.quantity > 0 && near[r.y * world.width + r.x] >= 0).length >= count, `${seed}: missing ${type}`);
    }
    assert.ok(!world.resources.some(r => r.id.startsWith('dev-ore-')));
    assert.ok(!world.resources.some(r => Math.abs(r.x - world.spawnX) <= 1 && Math.abs(r.y - world.spawnY) <= 1));
  }
});

test('land target, beach width and mountain share affect the intended measurements', () => {
  const small = summarizeIsland(generate(42, { landFraction: 0.4 }));
  const large = summarizeIsland(generate(42, { landFraction: 0.65 }));
  assert.ok(large.landPercent > small.landPercent + 10);
  const narrow = summarizeIsland(generate(42, { beachWidth: 2 }));
  const wide = summarizeIsland(generate(42, { beachWidth: 8 }));
  assert.ok(wide.biomes.beach > narrow.biomes.beach * 2);
  assert.equal(narrow.landPercent, wide.landPercent);
  const low = summarizeIsland(generate(42, { mountainFraction: 0.08 }));
  const high = summarizeIsland(generate(42, { mountainFraction: 0.35 }));
  assert.ok(high.levels[3] + high.levels[4] > (low.levels[3] + low.levels[4]) * 2);
});

test('coast roughness, smoothing and ramp spacing have independently measurable effects', () => {
  assert.ok(summarizeIsland(generate(42, { coastRoughness: 0.8 })).coastlineEdges > summarizeIsland(generate(42, { coastRoughness: 0 })).coastlineEdges);
  assert.ok(summarizeIsland(generate(42, { plateauSize: 18 })).cliffEdges < summarizeIsland(generate(42, { plateauSize: 2 })).cliffEdges);
  assert.ok(summarizeIsland(generate(42, { rampSpacing: 8 })).ramps > summarizeIsland(generate(42, { rampSpacing: 45 })).ramps);
  const flat = new Float32Array(64).fill(0.5);
  assert.deepEqual(smoothField(flat, 8, 8, 3), flat);
});

test('new defaults create more passages than the previous spacing', () => {
  assert.ok(summarizeIsland(generate(42)).ramps > summarizeIsland(generate(42, { rampSpacing: 22 })).ramps);
});

test('wider ramps only add valid adjacent passages and preserve terrain and old routes', () => {
  const tiles = Array.from({ length: 12 }, (_, y) => Array.from({ length: 12 }, (_, x) => ({
    x, y, type: 'grass', walkable: true, elevation: y < 6 ? 2 : 1,
    isRamp: y === 5 && [2, 5, 8].includes(x),
  })));
  tiles[6][3].walkable = false;
  const before = structuredClone(tiles);
  widenRamps(tiles);
  const added = tiles.flat().filter(t => t.isRamp && !before[t.y][t.x].isRamp);
  assert.ok(added.length > 0);
  for (const row of tiles) for (const t of row) {
    const old = before[t.y][t.x];
    assert.equal(t.elevation, old.elevation);
    assert.equal(t.walkable, old.walkable);
    assert.equal(t.type, old.type);
    if (old.isRamp) assert.equal(t.isRamp, true);
  }
  for (const t of added) {
    assert.ok(t.walkable && tiles[t.y + 1][t.x].walkable);
    assert.equal(t.elevation - tiles[t.y + 1][t.x].elevation, 1);
  }
});

test('vegetation density leaves terrain unchanged and does not disable starter resources', () => {
  const empty = generate(42, { vegetationDensity: 0 });
  const lush = generate(42, { vegetationDensity: 1.5 });
  assert.equal(hash(empty.tileMap), hash(lush.tileMap));
  for (const type of ['wood', 'palm_tree', 'bamboo', 'large_tree', 'banyan_tree', 'fiber']) {
    assert.ok(!empty.resources.some(r => r.type === type));
  }
  assert.ok(lush.resources.length > empty.resources.length);
  assert.ok(empty.resources.filter(r => r.type === 'flint').length >= 2);
});

test('debug ore block requires an explicit opt-in', () => {
  assert.ok(!generate(42).resources.some(r => r.id.startsWith('dev-ore-')));
  assert.ok(generate(42, { debugOreBlock: true }).resources.some(r => r.id.startsWith('dev-ore-')));
});

test('save restoration preserves the original generator and player changes', () => {
  const legacy = new LegacyWorldGenerator().generate(42);
  assert.equal(hash(legacy.tileMap), '5271ca6e60eb9c393b6dac789a710131f4ce8f7f409ac2c4c23697799d9ef773');
  for (const world of [legacy, generate(42, ISLAND_PRESETS.gentle)]) {
    const save = structuredClone(world);
    save.resources[0].quantity = 0;
    save.structures = [{ id: 'test-shelter', type: 'palm_shelter', x: save.spawnX, y: save.spawnY, health: 77, maxHealth: 100 }];
    save.droppedItems = [{ id: 'knife', resourceId: 'flint_knife', quantity: 1, x: save.spawnX, y: save.spawnY, quality: 'good', durability: 61, maxDurability: 140 }];
    save.tileMap = [];
    const restored = restoreWorld(save);
    assert.equal(hash(restored.tileMap), hash(world.tileMap));
    assert.deepEqual(restored.resources, save.resources);
    assert.deepEqual(restored.structures, save.structures);
    assert.deepEqual(restored.droppedItems, save.droppedItems);
    assert.deepEqual(restored.generation, save.generation);
  }
});

test('world persistence includes the resolved generation settings', () => {
  global.window = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  const { useWorldStore } = require('../src/store/worldStore.ts');
  const world = generate(137, ISLAND_PRESETS.rugged);
  const snapshot = useWorldStore.persist.getOptions().partialize({ world });
  const serialized = JSON.parse(JSON.stringify(snapshot));
  assert.deepEqual(serialized.world.generation, world.generation);
  assert.deepEqual(serialized.world.tileMap, []);
  assert.equal(hash(restoreWorld(serialized.world).tileMap), hash(world.tileMap));
});

test('extreme small rugged islands do not leave walkable pockets sealed behind peaks', () => {
  for (const seed of [999999, 4567]) {
    const world = generate(seed, { landFraction: 0.25, beachWidth: 1, coastRoughness: 1, terrainRoughness: 1, plateauSize: 2, mountainFraction: 0.4 });
    assert.equal(summarizeIsland(world).unreachable, 0);
    assert.ok(world.tileMap.flat().some(t => t.type === 'impassable'), 'peak repair should not remove all rock barriers');
  }
});

test('invalid settings and unsupported save versions fail before generating a world', () => {
  for (const settings of [{ landFraction: NaN }, { beachWidth: 1.5 }, { vegetationDensity: -1 }, { plateauFraction: 0.6, mountainFraction: 0.4 }, { debugOreBlock: 'yes' }]) {
    assert.throws(() => resolveIslandSettings(settings));
  }
  for (const seed of [-1, 0.5, Infinity]) assert.throws(() => new WorldGenerator().generate(seed));
  assert.throws(() => restoreWorld({ generation: { version: 99 }, seed: 42 }), /Version/);
  assert.throws(() => restoreWorld({ ...generate(42), width: 123 }), /Kartengröße/);
  assert.throws(() => restoreWorld({ ...generate(42), generation: { version: 2, settings: {} } }), /unvollständig/);
});
