const fs = require('node:fs');
const path = require('node:path');
const { ArtGraphics } = require('./art-graphics.cjs');
const { drawTerrain, drawTerrainEdges } = require('../src/services/phaser/TerrainArt.ts');
const { drawCliffs } = require('../src/services/phaser/CliffArt.ts');
const { drawResourceArt } = require('../src/services/phaser/ResourceArt.ts');

const steps = [0, 0, 1, 1, 0, 0, -1, -1, 0, 0, 1, 1, 0, 0, -1, -1, 0, 0];
const tiles = Array.from({ length: 18 }, (_, y) => Array.from({ length: 22 }, (_, x) => {
  const edge = 8 + steps[y];
  const elevation = x < edge - 4 ? 3 : x < edge ? 2 : 1;
  const type = elevation === 3 ? 'dense_jungle' : elevation === 2 ? 'forest' : x < edge + 2 ? 'grass' : 'beach';
  return { x, y, type, elevation, walkable: true, isRamp: (y === 4 && x === edge) || (y === 12 && x === edge - 4) };
}));
const g = new ArtGraphics();
for (const row of tiles) for (const t of row) drawTerrain(g, t.type, t.x, t.y, 32);
for (const row of tiles) for (const t of row) drawTerrainEdges(g, tiles, t.x, t.y, 32);
drawCliffs(g, tiles, 0, 0, 21, 17, 32);
for (const [x, y] of [[5, 2], [3, 6], [6, 9], [3, 14], [6, 16]]) drawResourceArt(g, 'wood', x * 32 + 16, y * 32 + 28, y % 3, 5);
for (const [x, y] of [[14, 5], [16, 7], [17, 13]]) drawResourceArt(g, 'palm_tree', x * 32 + 16, y * 32 + 28, y % 3, 5);
const out = path.resolve(__dirname, '../artifacts/graphics');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'cliff-scene.svg'), g.svg(704, 576));

const atlas = new ArtGraphics();
atlas.fillStyle(0x263b32); atlas.fillRect(0, 0, 800, 320);
for (let sample = 0; sample < 4; sample++) {
  const map = Array.from({ length: 7 }, (_, y) => Array.from({ length: 6 }, (_, x) => ({
    type: x >= 1 && x <= 4 && y >= 1 && y <= 5 ? 'grass' : 'beach',
    elevation: x >= 1 && x <= 4 && y >= 1 && y <= 5 ? 2 : 1,
    walkable: true,
    isRamp: sample === 0 ? y === 0 && x === 2 : sample === 1 ? x === 5 && y === 3 : sample === 2 ? y === 6 && x === 2 : x === 0 && y === 3,
  })));
  if (sample === 3) { map[3][3].elevation = 1; map[3][4].elevation = 1; }
  const panel = new ArtGraphics();
  for (let y = 0; y < 7; y++) for (let x = 0; x < 6; x++) drawTerrain(panel, map[y][x].type, x, y, 32);
  drawCliffs(panel, map, 0, 0, 5, 6, 32);
  atlas.parts.push(`<g transform="translate(${sample * 200 + 4} 42)">${panel.parts.join('')}</g>`);
  atlas.parts.push(`<text x="${sample * 200 + 100}" y="25" text-anchor="middle" fill="#d8d5bf" font-family="sans-serif" font-size="14">${['Norden', 'Osten', 'Süden', 'Westen / Innenecke'][sample]}</text>`);
}
fs.writeFileSync(path.join(out, 'cliff-directions.svg'), atlas.svg(800, 320));
const variants = new ArtGraphics();
variants.fillStyle(0x263b32); variants.fillRect(0, 0, 864, 600);
for (const [row, biome] of ['beach', 'mountain', 'forest'].entries()) {
  for (let col = 0; col < 4; col++) {
    const panel = new ArtGraphics();
    const map = Array.from({ length: 5 }, (_, y) => Array.from({ length: 6 }, (_, x) => ({
      type: biome, elevation: y < 2 ? 2 : 1, walkable: true,
      isRamp: y === 1 && (x === (col < 3 ? col + 1 : 2) || (col === 3 && x === 3)),
    })));
    for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) drawTerrain(panel, biome, x, y, 32);
    drawCliffs(panel, map, 0, 0, 5, 4, 32);
    variants.parts.push(`<g transform="translate(${col * 216 + 12} ${row * 200 + 30})">${panel.parts.join('')}</g>`);
    variants.parts.push(`<text x="${col * 216 + 108}" y="${row * 200 + 20}" text-anchor="middle" fill="#e2dac3" font-family="sans-serif" font-size="13">${['Sand', 'Geröll', 'Erdpfad'][row]} · ${col === 3 ? 'breiter Übergang' : `Variante ${col + 1}`}</text>`);
  }
}
fs.writeFileSync(path.join(out, 'ramp-variants.svg'), variants.svg(864, 600));
console.log('Cliff reference scene and four-direction ramp sheet written (offline drawings).');
