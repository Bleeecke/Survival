const fs = require('node:fs');
const path = require('node:path');
require('./art-graphics.cjs');
const { WorldGenerator } = require('../src/services/phaser/WorldGenerator.ts');
const { ISLAND_PRESETS } = require('../src/data/islandConfig.ts');
const { summarizeIsland } = require('./island-summary.cjs');
const seeds = process.argv.slice(2).map(Number);
if (!seeds.length) seeds.push(42, 137, 2026);
const colors = ['#286d80', '#748951', '#405e3d', '#8d8b6b', '#c2beb0'];
const parts = [], report = [];
const names = { gentle: 'Sanft', balanced: 'Ausgewogen', rugged: 'Rau' };
const profiles = ['gentle', 'balanced', 'rugged'];
for (const [row, seed] of seeds.entries()) for (const [column, profile] of profiles.entries()) {
  const begin = performance.now(), world = new WorldGenerator().generate(seed, ISLAND_PRESETS[profile]);
  const result = { profile, ...summarizeIsland(world), generationMs: Math.round(performance.now() - begin) };
  report.push(result);
  const x = column * 280 + 15, y = row * 320 + 38;
  parts.push(`<text x="${x}" y="${y - 13}" fill="#e0dcc7" font-family="sans-serif" font-size="14">${names[profile]} · Seed ${seed}</text>`);
  for (let ty = 0; ty < world.height; ty++) {
    let start = 0;
    const color = t => t.type === 'beach' ? '#cbb784' : colors[t.elevation];
    for (let tx = 1; tx <= world.width; tx++) {
      if (tx < world.width && color(world.tileMap[ty][tx]) === color(world.tileMap[ty][start])) continue;
      parts.push(`<rect x="${x + start}" y="${y + ty}" width="${tx - start}" height="1" fill="${color(world.tileMap[ty][start])}"/>`);
      start = tx;
    }
  }
  parts.push(`<circle cx="${x + world.spawnX}" cy="${y + world.spawnY}" r="3" fill="#fae78d" stroke="#342e20"/>`);
  parts.push(`<text x="${x}" y="${y + 268}" fill="#c6c9b8" font-family="sans-serif" font-size="11">Land ${result.landPercent}% · Strand ${result.biomes.beach} · Kanten ${result.cliffEdges}</text>`);
  parts.push(`<text x="${x}" y="${y + 282}" fill="#c6c9b8" font-family="sans-serif" font-size="11">Erreichbar ${result.reachablePercent}% · ${result.generationMs} ms</text>`);
}
const out = path.resolve(__dirname, '../artifacts/islands'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'comparison.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="${seeds.length * 320 + 14}" viewBox="0 0 840 ${seeds.length * 320 + 14}"><rect width="100%" height="100%" fill="#20312e"/>${parts.join('')}</svg>`);
fs.writeFileSync(path.join(out, 'comparison.json'), JSON.stringify(report, null, 2));
console.table(report.map(({ levels, biomes, ...rest }) => ({ ...rest, beach: biomes.beach })));
