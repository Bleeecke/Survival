const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const color = n => `#${n.toString(16).padStart(6, '0')}`;
const number = n => Number(n.toFixed(3));

// Records the production drawing calls as SVG for offline inspection, not a browser/GPU simulation.
class ArtGraphics {
  parts = [];
  bounds = [];
  path = [];
  fill = '#000000';
  alpha = 1;
  line = '#000000';
  lineAlpha = 1;
  width = 1;
  clear() { this.parts = []; this.bounds = []; return this; }
  setDepth() { return this; }
  fillStyle(c, a = 1) { this.fill = color(c); this.alpha = a; return this; }
  lineStyle(w, c, a = 1) { this.width = w; this.line = color(c); this.lineAlpha = a; return this; }
  track(x, y) { this.bounds.push([x, y]); }
  shape(tag, attrs, stroke = false) {
    this.parts.push(`<${tag} ${attrs} ${stroke ? `fill="none" stroke="${this.line}" stroke-width="${this.width}" stroke-opacity="${this.lineAlpha}" stroke-linecap="round"` : `fill="${this.fill}" fill-opacity="${this.alpha}"`}/>`);
    return this;
  }
  fillRect(x, y, w, h) { this.track(x, y); this.track(x + w, y + h); return this.shape('rect', `x="${x}" y="${y}" width="${w}" height="${h}"`); }
  fillRoundedRect(x, y, w, h, r) { this.track(x, y); this.track(x + w, y + h); return this.shape('rect', `x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"`); }
  fillEllipse(x, y, w, h) { this.track(x - w / 2, y - h / 2); this.track(x + w / 2, y + h / 2); return this.shape('ellipse', `cx="${x}" cy="${y}" rx="${w / 2}" ry="${h / 2}"`); }
  fillCircle(x, y, r) { return this.fillEllipse(x, y, r * 2, r * 2); }
  fillTriangle(...coords) { for (let i = 0; i < coords.length; i += 2) this.track(coords[i], coords[i + 1]); return this.shape('polygon', `points="${coords.map(number).join(' ')}"`); }
  beginPath() { this.path = []; return this; }
  moveTo(x, y) { this.track(x, y); this.path.push(`M${number(x)} ${number(y)}`); return this; }
  lineTo(x, y) { this.track(x, y); this.path.push(`L${number(x)} ${number(y)}`); return this; }
  closePath() { this.path.push('Z'); return this; }
  fillPath() { return this.shape('path', `d="${this.path.join(' ')}"`); }
  strokePath() { return this.shape('path', `d="${this.path.join(' ')}"`, true); }
  lineBetween(x, y, x2, y2) { this.beginPath(); this.moveTo(x, y); this.lineTo(x2, y2); return this.strokePath(); }
  svg(width, height, viewBox = `0 0 ${width} ${height}`) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${this.parts.join('\n')}</svg>`; }
}
module.exports = { ArtGraphics };
