const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ArtGraphics } = require('../scripts/art-graphics.cjs');
const { drawTerrain, drawTerrainEdges, isLowShore, TERRAIN_COLORS } = require('../src/services/phaser/TerrainArt.ts');
const { drawResourceArt, RESOURCE_ART_TYPES } = require('../src/services/phaser/ResourceArt.ts');
const { SpriteFactory } = require('../src/services/phaser/SpriteFactory.ts');
const { collectCliffEdges, connectCliffEdges, cliffSurface, drawCliffs } = require('../src/services/phaser/CliffArt.ts');
const fs = require('node:fs');
const ts = require('typescript');
const { buildTrails, drawTrails } = require('../src/services/phaser/TrailArt.ts');

test('subtle trails connect water to ramps without crossing blockers or unmarked cliffs', () => {
  const tiles = Array.from({ length: 14 }, (_, y) => Array.from({ length: 14 }, (_, x) => ({
    x, y, type: 'grass', walkable: x > 0 && y > 0 && x < 13 && y < 13,
    elevation: y < 6 ? 2 : 1, isRamp: y === 5 && x === 7,
  })));
  const resources = [{ type: 'puddle', x: 7, y: 10 }, { type: 'stone', x: 7, y: 8 }];
  const before = JSON.stringify({ tiles, resources });
  const trails = buildTrails(tiles, resources);
  assert.deepEqual(buildTrails(tiles, resources), trails);
  assert.ok(trails.some(t => [t.from, t.to].some(p => p.x === 7 && p.y === 10)));
  for (const { from, to } of trails) {
    assert.equal(Math.abs(from.x - to.x) + Math.abs(from.y - to.y), 1);
    const a = tiles[from.y][from.x], b = tiles[to.y][to.x];
    assert.ok(a.walkable && b.walkable);
    assert.ok(a.elevation === b.elevation || (Math.abs(a.elevation - b.elevation) === 1 && (a.isRamp || b.isRamp)));
    assert.ok(![from, to].some(p => p.x === 7 && p.y === 8));
  }
  assert.equal(JSON.stringify({ tiles, resources }), before);
  const hidden = new ArtGraphics();
  drawTrails(hidden, trails, 30, 30, 40, 40, 32);
  assert.equal(hidden.parts.length, 0);
  const drawn = new ArtGraphics();
  drawTrails(drawn, trails, 0, 0, 13, 13, 32);
  assert.ok(drawn.parts.length > 0);
});

const tile = (type, elevation = type === 'water' ? 0 : 1) => ({ type, elevation });

test('only low sandy shores suppress cliff art; high coastal cliffs remain', () => {
  for (const type of ['sand', 'beach']) {
    assert.equal(isLowShore(tile(type), tile('water')), true);
    assert.equal(isLowShore(tile('water'), tile(type)), true);
    assert.equal(isLowShore(tile(type, 2), tile('water')), false);
  }
  assert.equal(isLowShore(tile('grass'), tile('water')), false);
  assert.equal(isLowShore(tile('mountain', 3), tile('water')), false);
  assert.equal(isLowShore(undefined, tile('water')), false);
});

test('edge rendering stays in the owner tile and never mutates world/collision data', () => {
  for (const here of ['beach', 'grass', 'tall_grass']) {
    for (const neighbor of ['water', 'grass', 'forest', 'mountain']) {
      const tiles = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => tile(neighbor)));
      tiles[1][1] = tile(here);
      const before = structuredClone(tiles);
      const g = new ArtGraphics();
      drawTerrainEdges(g, tiles, 1, 1, 32);
      for (const [x, y] of g.bounds) assert.ok(x >= 32 && x <= 64 && y >= 32 && y <= 64, `${here}/${neighbor}: ${x},${y}`);
      assert.deepEqual(tiles, before);
    }
  }
});

test('terrain variation is deterministic across redraw order and uses bounded decoration', () => {
  for (const type of Object.keys(TERRAIN_COLORS)) {
    for (let x = 0; x < 12; x++) {
      const a = new ArtGraphics(), b = new ArtGraphics();
      drawTerrain(a, type, x, 5, 32);
      drawTerrain(b, 'water', 100, 100, 32);
      b.clear();
      drawTerrain(b, type, x, 5, 32);
      assert.deepEqual(a.parts, b.parts);
      assert.ok(a.parts.length <= 9, `${type} has ${a.parts.length} primitives`);
    }
  }
});

test('water wave endpoints match across tile seams', () => {
  for (let x = 0; x < 20; x++) {
    const a = new ArtGraphics(), b = new ArtGraphics();
    drawTerrain(a, 'water', x, 3, 32);
    drawTerrain(b, 'water', x + 1, 3, 32);
    assert.equal(a.path.at(-1).slice(1), b.path[0].slice(1));
  }
});

test('all resource variants and palm harvest states fit their cached texture', () => {
  for (const type of RESOURCE_ART_TYPES) for (let variant = 0; variant < 3; variant++) for (const quantity of [0, 1, 3]) {
    const g = new ArtGraphics();
    const layout = SpriteFactory.layout(type);
    assert.equal(drawResourceArt(g, type, layout.width / 2, layout.base, variant, quantity), true);
    for (const [x, y] of g.bounds) assert.ok(x >= 2 && x <= layout.width - 2 && y >= 2 && y <= layout.height - 2, `${type}: ${x},${y}`);
  }
});

test('leaf bedding stays below the player from north, south and on the same tile', () => {
  const source = fs.readFileSync(require.resolve('../src/services/phaser/GameManager.ts'), 'utf8');
  const ast = ts.createSourceFile('GameManager.ts', source, ts.ScriptTarget.Latest, true);
  const cls = ast.statements.find(ts.isClassDeclaration);
  const methods = cls.members.filter(m => ['createStructureObject', 'objectDepth'].includes(m.name?.getText(ast))).map(m => m.getText(ast));
  const js = ts.transpileModule(`class Preview { ${methods.join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const preview = new Function('TS', `${js}; return new Preview();`)(32);
  Object.assign(preview, {
    scene: { add: { graphics: () => ({ setDepth(depth) { this.depth = depth; }, setData() {} }) } },
    structureObjects: new Map(), drawStructure() {},
  });
  for (const y of [1, 10, 100]) {
    preview.createStructureObject({ id: 'bed', type: 'sleeping_spot', x: 5, y });
    const bed = preview.structureObjects.get('bed');
    assert.ok(bed.depth > 0, 'bedding must remain above the terrain');
    for (const playerY of [y - 1, y, y + 1]) assert.ok(bed.depth < playerY * 1000 + 3);
    preview.createStructureObject({ id: 'shelter', type: 'palm_shelter', x: 5, y });
    assert.ok(preview.structureObjects.get('shelter').depth > (y - 1) * 1000 + 3, 'upright shelters still occlude a player behind them');
  }
});

test('landmark trees remain at least three times taller than ordinary wood trees', () => {
  const height = type => {
    const g = new ArtGraphics();
    drawResourceArt(g, type, 0, 0, 0, 3);
    return -Math.min(...g.bounds.map(point => point[1]));
  };
  assert.ok(height('large_tree') >= height('wood') * 3);
  assert.ok(height('banyan_tree') >= height('wood') * 3);
});

test('active jungle tree drawing removes vines when stripped but retains the tree', () => {
  const source = fs.readFileSync(require.resolve('../src/services/phaser/GameManager.ts'), 'utf8');
  const ast = ts.createSourceFile('GameManager.ts', source, ts.ScriptTarget.Latest, true);
  const cls = ast.statements.find(ts.isClassDeclaration);
  const method = cls.members.find(m => m.name?.getText(ast) === 'drawJungleCanopyTree').getText(ast);
  const js = ts.transpileModule(`class Preview { ${method} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const preview = new Function('drawTreeArt', 'TS', `${js}; return new Preview();`)(require('../src/services/phaser/TreeArt.ts').drawTreeArt, 32);
  const full = new ArtGraphics(), stripped = new ArtGraphics();
  preview.drawJungleCanopyTree(full, 4, 5, 12, false);
  preview.drawJungleCanopyTree(stripped, 4, 5, 12, true);
  assert.ok(stripped.parts.length > 0);
  assert.ok(full.parts.length > stripped.parts.length);
  assert.deepEqual(full.parts.slice(0, stripped.parts.length), stripped.parts);
});

test('texture cache reuses variants and only distinguishes meaningful harvest states', () => {
  const textures = new Set();
  let generated = 0, destroyed = 0;
  const scene = {
    textures: { exists: key => textures.has(key) },
    add: { graphics: () => Object.assign(new ArtGraphics(), {
      generateTexture(key, w, h) { assert.equal(w, 160); assert.equal(h, 192); textures.add(key); generated++; },
      destroy() { destroyed++; },
    }) },
  };
  for (let i = 0; i < 100; i++) SpriteFactory.texture(scene, 'wood', i % 3, i);
  assert.equal(generated, 3);
  for (let i = 0; i < 100; i++) SpriteFactory.texture(scene, 'palm_tree', 0, i);
  assert.equal(generated, 6);
  assert.notEqual(SpriteFactory.texture(scene, 'palm_tree', 0, 0), SpriteFactory.texture(scene, 'palm_tree', 0, 1));
  assert.equal(SpriteFactory.texture(scene, 'palm_tree', 0, 3), SpriteFactory.texture(scene, 'palm_tree', 0, 20));
  for (let i = 0; i < 100; i++) SpriteFactory.texture(scene, 'berry_bush', 0, i);
  assert.equal(generated, 9);
  assert.notEqual(SpriteFactory.texture(scene, 'berry_bush', 0, 0), SpriteFactory.texture(scene, 'berry_bush', 0, 1));
  assert.notEqual(SpriteFactory.texture(scene, 'berry_bush', 0, 1), SpriteFactory.texture(scene, 'berry_bush', 0, 3));
  assert.equal(SpriteFactory.texture(scene, 'berry_bush', 0, 3), SpriteFactory.texture(scene, 'berry_bush', 0, 20));
  for (const type of ['exotic_fruit', 'breadfruit_tree', 'cacao_tree']) {
    assert.notEqual(SpriteFactory.texture(scene, type, 0, 0), SpriteFactory.texture(scene, type, 0, 1));
    assert.notEqual(SpriteFactory.texture(scene, type, 0, 1), SpriteFactory.texture(scene, type, 0, 3));
    assert.equal(SpriteFactory.texture(scene, type, 0, 3), SpriteFactory.texture(scene, type, 0, 100));
    const empty = new ArtGraphics(), full = new ArtGraphics();
    drawResourceArt(empty, type, 80, 156, 0, 0);
    drawResourceArt(full, type, 80, 156, 0, 3);
    assert.ok(full.parts.length > empty.parts.length, 'harvested fruit must disappear from the crown');
  }
  assert.equal(SpriteFactory.texture(scene, 'unknown', 0, 1), null);
  assert.equal(destroyed, generated);
});

test('persistent construction art survives task cancellation and culls offscreen sites', () => {
  const source = fs.readFileSync(require.resolve('../src/services/phaser/GameManager.ts'), 'utf8');
  const ast = ts.createSourceFile('GameManager.ts', source, ts.ScriptTarget.Latest, true);
  const frame = ast.statements.find(ts.isClassDeclaration).members.find(m => m.name?.getText(ast) === 'onUpdate').getText(ast);
  assert.match(frame, /this\.updateConstructionArt\(\)/, 'construction art must be refreshed by the live frame loop');
  const method = ast.statements.find(ts.isClassDeclaration).members.find(m => m.name?.getText(ast) === 'updateConstructionArt').getText(ast);
  const js = ts.transpileModule('class Preview { '+method+' }', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  let state = { world: { constructionSites: [{id:'site',target:'palm_shelter',x:2,y:3,width:2,work:1000,completed:200,phase:'build',supplied:true}] } };
  const draws = [];
  const preview = new Function('useWorldStore', 'drawConstruction', 'TS', js+';return new Preview();')(
    { getState: () => state }, (...args) => { draws.push(args); args[0].parts.push('site'); }, 32);
  const g = Object.assign(new ArtGraphics(), { setVisible(value) { this.visible = value; } });
  Object.assign(preview, { constructionGraphics: g, constructionArtKey: '', isInViewport: () => true });
  preview.updateConstructionArt();
  assert.equal(draws[0][5], 0.2);
  preview.updateConstructionArt();
  assert.equal(draws.length, 1);
  preview.isInViewport = () => false;
  preview.updateConstructionArt();
  assert.equal(g.parts.length, 0);
  preview.isInViewport = () => true;
  preview.updateConstructionArt();
  assert.equal(draws.length, 2);
  state.world.constructionSites=[];
  preview.updateConstructionArt();
  assert.equal(g.parts.length, 0);
});

test('active cliff renderer preserves high coasts and only marks traversable height steps as ramps', () => {
  const source = fs.readFileSync(require.resolve('../src/services/phaser/GameManager.ts'), 'utf8');
  const ast = ts.createSourceFile('GameManager.ts', source, ts.ScriptTarget.Latest, true);
  const cls = ast.statements.find(ts.isClassDeclaration);
  const method = cls.members.find(m => m.name?.getText(ast) === 'renderCliffFaces').getText(ast);
  const js = ts.transpileModule(`class Preview { ${method} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const preview = new Function('drawCliffs', 'TS', `${js};return new Preview();`)((g, tiles, ...bounds) => {
    faces = collectCliffEdges(tiles, ...bounds.slice(0, 4));
    drawCliffs(g, tiles, ...bounds);
  }, 32);
  let faces = [];
  const check = (high, low) => {
    faces = [];
    preview.renderCliffFaces(new ArtGraphics(), { tileMap: [[high, low], [low, low]] }, 0, 0, 1, 1);
    return faces;
  };
  assert.equal(check(tile('beach'), tile('water')).length, 0);
  assert.ok(check(tile('beach', 2), tile('water')).length > 0);
  assert.ok(check(tile('forest', 2), { ...tile('forest', 1), isRamp: true }).every(edge => edge.ramp));
  assert.ok(check(tile('forest', 3), { ...tile('forest', 1), isRamp: true }).every(edge => !edge.ramp));
  assert.ok(check(tile('forest', 2), { ...tile('forest', 1), isRamp: true, walkable: false }).every(edge => !edge.ramp));
});

test('height contours include all four directions, but never duplicate a shared edge', () => {
  const tiles = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => tile('grass', 1)));
  tiles[1][1] = { ...tile('forest', 2), isRamp: true };
  const before = structuredClone(tiles);
  const edges = collectCliffEdges(tiles, 0, 0, 2, 2);
  assert.deepEqual(edges.map(e => e.side).sort(), [0, 1, 2, 3]);
  assert.ok(edges.every(e => e.ramp));
  drawCliffs(new ArtGraphics(), tiles, 0, 0, 2, 2, 32);
  assert.deepEqual(tiles, before);
  assert.deepEqual(collectCliffEdges([], 0, 0, 2, 2), []);
});

test('ramps select terrain materials and join wide paths even at a camera boundary', () => {
  for (const [biome, material] of [['beach', 'sand'], ['mountain', 'stone'], ['forest', 'earth']]) {
    const tiles = Array.from({ length: 6 }, (_, y) => Array.from({ length: 6 }, (_, x) => ({
      ...tile(biome, y < 3 ? 2 : 1), isRamp: y === 2 && (x === 2 || x === 3),
    })));
    const edges = collectCliffEdges(tiles, 0, 0, 5, 5).filter(e => e.ramp);
    assert.equal(edges.length, 2);
    assert.ok(edges.every(e => e.rampMaterial === material));
    assert.ok(edges.every(e => e.joinsBefore || e.joinsAfter));
    const cropped = collectCliffEdges(tiles, 2, 2, 2, 2);
    assert.deepEqual(cropped[0], edges.find(e => e.x === 2));
    const a = new ArtGraphics(), b = new ArtGraphics();
    drawCliffs(a, tiles, 0, 0, 5, 5, 32);
    drawCliffs(b, tiles, 0, 0, 5, 5, 32);
    assert.deepEqual(a.parts, b.parts);
  }
});

test('diagonally touching plateaus keep separate closed contours', () => {
  const tiles = Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => tile('grass', 1)));
  tiles[1][1] = tile('forest', 2); tiles[2][2] = tile('forest', 2);
  const edges = collectCliffEdges(tiles, 0, 0, 3, 3);
  const { next, previous } = connectCliffEdges(edges, 32);
  assert.equal(edges.length, 8);
  for (let i = 0; i < edges.length; i++) {
    let cursor = i;
    for (let step = 0; step < 4; step++) {
      assert.equal(previous[next[cursor]], cursor);
      cursor = next[cursor];
    }
    assert.equal(cursor, i);
  }
});

test('convex and concave corners meet without seams and stay stable during camera movement', () => {
  const tiles = Array.from({ length: 9 }, (_, y) => Array.from({ length: 9 }, (_, x) => tile('forest',
    x >= 2 && x <= 6 && y >= 2 && y <= 6 && !(x >= 5 && y === 4) ? 3 : 1)));
  const full = collectCliffEdges(tiles, 0, 0, 8, 8);
  const { previous, next } = connectCliffEdges(full, 32);
  for (let i = 0; i < full.length; i++) {
    assert.ok(next[i] >= 0 && previous[i] >= 0);
    const current = cliffSurface(full[i], full[previous[i]], full[next[i]], 32);
    const following = cliffSurface(full[next[i]], full[i], full[next[next[i]]], 32);
    for (const key of ['x', 'y', 'nx', 'ny']) assert.ok(Math.abs(current.at(-1)[key] - following[0][key]) < 1e-8);
    for (const p of current) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(Math.hypot(p.nx, p.ny) - 1) < 1e-8);
  }
  const cropped = collectCliffEdges(tiles, 1, 1, 7, 7);
  assert.deepEqual(cropped, full);
  const a = new ArtGraphics(), b = new ArtGraphics();
  drawCliffs(a, tiles, 0, 0, 8, 8, 32); drawCliffs(b, tiles, 1, 1, 7, 7, 32);
  assert.deepEqual(a.parts, b.parts);
  for (const [x, y] of a.bounds) assert.ok(Number.isFinite(x) && Number.isFinite(y));
});
