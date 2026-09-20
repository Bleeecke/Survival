const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { ArtGraphics } = require('./art-graphics.cjs');
const { drawTerrain, drawTerrainEdges, artHash } = require('../src/services/phaser/TerrainArt.ts');
const { drawResourceArt } = require('../src/services/phaser/ResourceArt.ts');
const { drawCamp, drawConstruction } = require('../src/services/phaser/CampArt.ts');

const out = path.resolve(__dirname, '../artifacts/graphics');
fs.mkdirSync(out, { recursive: true });
const g = new ArtGraphics();
const tiles = Array.from({ length: 17 }, (_, y) => Array.from({ length: 25 }, (_, x) => {
  const coast = 3 + Math.floor(x / 6);
  const type = y < coast ? 'water' : y < coast + 4 ? 'beach' : x > 15 ? 'forest' : x > 7 ? 'tall_grass' : 'grass';
  return { x, y, type, elevation: type === 'water' ? 0 : 1 };
}));
for (const row of tiles) for (const t of row) drawTerrain(g, t.type, t.x, t.y, 32);
for (const row of tiles) for (const t of row) drawTerrainEdges(g, tiles, t.x, t.y, 32);
const objects = [
  ['bamboo', 19, 15], ['bamboo', 24, 15], ['mushroom', 16, 12], ['berry_bush', 14, 12], ['berry_bush', 16, 15],
  ['palm_tree', 4, 7], ['palm_tree', 6, 7], ['palm_tree', 8, 8], ['palm_tree', 10, 8],
  ['palm_tree', 12, 9], ['palm_tree', 14, 9], ['wood', 18, 11], ['wood', 21, 12], ['wood', 23, 11],
  ['wood', 17, 14], ['wood', 22, 15], ['flint', 3, 7], ['sticks', 6, 10],
  ['fiber', 12, 12], ['pebbles', 8, 11], ['coconut', 7, 8], ['flint', 14, 14],
];
for (const [type, x, y] of objects.sort((a, b) => a[2] - b[2])) drawResourceArt(g, type, x * 32 + 16, y * 32 + 28, artHash(x, y) % 3, 5);
drawCamp(g, 'palm_shelter', 3 * 32, 14 * 32 - 2, 32);
drawCamp(g, 'sleeping_spot', 3 * 32, 15 * 32 - 2, 32);
drawCamp(g, 'arbeitsplatz', 8 * 32, 14 * 32 - 2, 32);
drawCamp(g, 'campfire', 6 * 32, 14 * 32 - 2, 32);
drawConstruction(g, 10 * 32, 15 * 32, 64, 32, 0.6, false);

// Include the actual player drawing method without loading Phaser's browser runtime.
const source = fs.readFileSync(path.resolve(__dirname, '../src/services/phaser/GameManager.ts'), 'utf8');
const ast = ts.createSourceFile('GameManager.ts', source, ts.ScriptTarget.Latest, true);
const cls = ast.statements.find(ts.isClassDeclaration);
const methods = cls.members.filter(m => ['renderPlayer', 'renderPlayerLying'].includes(m.name?.getText(ast))).map(m => m.getText(ast));
const js = ts.transpileModule(`class Preview { ${methods.join('\n')} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const preview = new Function('usePlayerStore', 'useGameStore', 'useCraftingStore', 'TS', `${js}; return new Preview();`)(
  { getState: () => ({ player: { direction: 'down' } }) }, { getState: () => ({}) }, { getState: () => ({ job: null, message: '' }) }, 32,
);
const pg = new ArtGraphics();
Object.assign(preview, { playerGraphics: pg, scene: { time: { now: 0 }, cameras: { main: { centerOn() {} } } }, playerPx: 6 * 32, playerPy: 12 * 32, walkFrame: 0, isMoving: false });
preview.renderPlayer();
g.parts.push(...pg.parts);
fs.writeFileSync(path.join(out, 'reference-scene.svg'), g.svg(800, 544));

const sheet = new ArtGraphics();
sheet.fillStyle(0x263c32); sheet.fillRect(0, 0, 800, 270);
for (let i = 0; i < 3; i++) {
  drawResourceArt(sheet, 'wood', 65 + i * 95, 110, i, 5);
  drawResourceArt(sheet, 'palm_tree', 385 + i * 110, 110, i, [5, 1, 0][i]);
}
for (const [i, type] of ['flint', 'pebbles', 'sticks', 'fiber', 'coconut'].entries()) {
  drawResourceArt(sheet, type, 70 + i * 150, 200, 0, 5);
  sheet.parts.push(`<text x="${70 + i * 150}" y="235" text-anchor="middle" fill="#d9d6bd" font-family="sans-serif" font-size="13">${type}</text>`);
}
fs.writeFileSync(path.join(out, 'asset-sheet.svg'), sheet.svg(800, 270));

const plants = new ArtGraphics();
plants.fillStyle(0x516b45); plants.fillRect(0, 0, 800, 380);
for (let i = 0; i < 3; i++) {
  drawResourceArt(plants, 'bamboo', 100 + i * 115, 160, i, 5);
  drawResourceArt(plants, 'mushroom', 490 + i * 110, 160, i, 5);
  drawResourceArt(plants, 'berry_bush', 150 + i * 240, 300, i, [5, 1, 0][i]);
  plants.parts.push(`<text x="${150 + i * 240}" y="335" text-anchor="middle" fill="#ede3c6" font-family="sans-serif" font-size="15">${['Reife Beeren', 'Wenige Beeren', 'Abgeerntet'][i]}</text>`);
}
fs.writeFileSync(path.join(out, 'plants-sheet.svg'), plants.svg(800, 380));

const trees = new ArtGraphics();
trees.fillStyle(0x516b45); trees.fillRect(0, 0, 1200, 750);
for (const [i, type] of ['wood', 'large_tree', 'banyan_tree', 'rubber_tree', 'cacao_tree', 'breadfruit_tree', 'exotic_fruit'].entries()) {
  const x = 130 + (i % 4) * 300, y = i < 4 ? 340 : 650;
  drawResourceArt(trees, type, x, y, i % 3, 5);
  trees.parts.push(`<text x="${x}" y="${y + 30}" text-anchor="middle" fill="#ede3c6" font-family="sans-serif" font-size="14">${type}</text>`);
}
drawResourceArt(trees, 'pandanus', 1030, 650, 0, 5);
trees.parts.push('<text x="1030" y="680" text-anchor="middle" fill="#ede3c6" font-family="sans-serif" font-size="14">Pandanus</text>');
fs.writeFileSync(path.join(out, 'trees-sheet.svg'), trees.svg(1200, 750));

const vines = new ArtGraphics();
vines.fillStyle(0x516b45); vines.fillRect(0, 0, 500, 240);
const vineMethod = cls.members.find(m => m.name?.getText(ast) === 'drawJungleCanopyTree').getText(ast);
const vineJs = ts.transpileModule(`class Preview { ${vineMethod} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const vinePreview = new Function('drawTreeArt', 'TS', `${vineJs};return new Preview();`)(require('../src/services/phaser/TreeArt.ts').drawTreeArt, 32);
vinePreview.drawJungleCanopyTree(vines, 3, 5, 12, false);
vinePreview.drawJungleCanopyTree(vines, 11, 5, 12, true);
fs.writeFileSync(path.join(out, 'vine-trees.svg'), vines.svg(500, 240));

const icons = path.resolve(__dirname, '../public/art');
fs.mkdirSync(icons, { recursive: true });
for (const type of ['flint', 'pebbles', 'sticks', 'fiber', 'coconut', 'herbs']) {
  const icon = new ArtGraphics();
  drawResourceArt(icon, type, 16, 28, 0, 5);
  fs.writeFileSync(path.join(icons, `${type}.svg`), icon.svg(32, 32));
}
const bedding = new ArtGraphics();
bedding.fillStyle(0x516b45); bedding.fillRect(0, 0, 320, 140);
for (let i = 0; i < 3; i++) drawResourceArt(bedding, 'herbs', 45 + i * 100, 40, i, 3);
drawCamp(bedding, 'sleeping_spot', 29, 105, 32);
drawConstruction(bedding, 129, 77, 32, 32, 0.4, false, 'sleeping_spot');
drawConstruction(bedding, 229, 77, 32, 32, 0.8, false, 'sleeping_spot');
fs.writeFileSync(path.join(out, 'herbs-bedding.svg'), bedding.svg(320, 140));
console.log(`Reference drawings and shared inventory icons written. Scene: ${g.parts.length} SVG primitives (not GPU draw calls).`);
