const fs = require('node:fs');
const path = require('node:path');
const { ArtGraphics } = require('./art-graphics.cjs');
const { drawConstruction, drawCamp } = require('../src/services/phaser/CampArt.ts');
const g = new ArtGraphics();
g.fillStyle(0x516b45); g.fillRect(0, 0, 1000, 550);
for (const [row, type] of ['sleeping_spot', 'campfire', 'arbeitsplatz', 'palm_shelter'].entries()) {
  for (const [col, progress] of [0, 0.2, 0.5, 0.85, 1].entries()) {
    const x = 80 + col * 185, y = 65 + row * 125;
    if (progress === 1) drawCamp(g, type, x, y + 28, 32);
    else drawConstruction(g, x, y, type === 'palm_shelter' ? 64 : 32, 32, progress, false, type);
    g.parts.push(`<text x="${x}" y="${y + 65}" fill="#e1ddbf" font-size="13">${type} ${progress * 100}%</text>`);
  }
}
const out = path.resolve(__dirname, '../artifacts/graphics');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'construction-stages.svg'), g.svg(1000, 550));
console.log('Construction stages rendered from the actual game drawing functions (offline SVG).');
