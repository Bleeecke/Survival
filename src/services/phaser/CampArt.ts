import type Phaser from 'phaser';

function drawPalmBedding(g: Phaser.GameObjects.Graphics, x: number, base: number, size: number, count = 7) {
  const cx = x + size / 2;
  // Close contact shadow, with no raised frame or upright headboard.
  g.fillStyle(0x233328, 0.2);
  g.fillEllipse(cx + 1, base - 10, size - 1, 18);
  for (let i = 0; i < count; i++) {
    const startX = x + 5 + i * (size - 10) / 6;
    const startY = base - 1 - (i % 2);
    const endX = startX + (i % 2 ? -4 : 3);
    const endY = base - 23 + (i % 3) * 1.5;
    const dx = endX - startX, dy = endY - startY;
    g.lineStyle(1.4, 0x647744);
    g.lineBetween(startX, startY, endX, endY);
    for (let rib = 1; rib <= 6; rib++) {
      const t = rib / 7;
      const sx = startX + dx * t, sy = startY + dy * t;
      const spread = Math.sin(t * Math.PI) * 5;
      for (const dir of [-1, 1]) {
        g.fillStyle([0x688448, 0x829651, 0x536f41][(i + (dir > 0 ? 1 : 0)) % 3]);
        g.fillTriangle(sx, sy + 2, sx + dir * spread, sy - 3.5, sx + dx / 7, sy - 3);
      }
    }
    g.lineStyle(0.8, i % 2 ? 0xb4b377 : 0x9da765, 0.9);
    g.lineBetween(startX, startY, endX, endY);
  }
}

export function drawCamp(g: Phaser.GameObjects.Graphics, type: string, x: number, base: number, size: number): boolean {
  if (!['arbeitsplatz', 'sleeping_spot', 'palm_shelter', 'campfire'].includes(type)) return false;
  if (type === 'sleeping_spot') {
    drawPalmBedding(g, x, base, size);
    return true;
  }
  const width = type === 'palm_shelter' ? size * 2 : size;
  const cx = x + width / 2;
  g.fillStyle(0x1c2d26, 0.26);
  g.fillEllipse(cx + 3, base + 2, width, 8);
  if (type === 'palm_shelter') {
    g.fillStyle(0x54422e);
    g.fillRect(x + 4, base - 47, 4, 47);
    g.fillRect(x + width - 8, base - 47, 4, 47);
    g.fillStyle(0xb29a69);
    g.fillRect(x + 4, base - 47, 1.5, 47);
    g.fillRect(x + width - 8, base - 47, 1.5, 47);
    g.fillStyle(0x202c24, 0.85);
    g.fillTriangle(x + 8, base - 3, cx + 5, base - 43, x + width - 8, base - 3);
    g.fillStyle(0x87915a);
    g.fillTriangle(x - 3, base - 10, cx + 5, base - 54, x + width + 3, base - 18);
    g.fillStyle(0x617442);
    g.fillTriangle(x - 3, base - 10, x + width + 3, base - 18, x + width, base - 8);
    g.lineStyle(2, 0xb0ad77, 0.8);
    g.lineBetween(x - 3, base - 10, cx + 5, base - 54);
    g.lineStyle(1.5, 0x445636, 0.7);
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      g.lineBetween(cx + 5 + (width / 2 - 2) * t, base - 54 + 36 * t, x - 3 + (width + 6) * t, base - 10 - 8 * t);
    }
    g.lineStyle(2, 0xc4ae7e);
    g.lineBetween(cx + 2, base - 49, cx + 8, base - 51);
  } else if (type === 'campfire') {
    g.fillStyle(0x41453a); g.fillEllipse(cx, base - 4, 23, 11);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI * 2 / 7;
      const sx = cx + Math.cos(angle) * 11, sy = base - 4 + Math.sin(angle) * 5;
      g.fillStyle(0x70776a); g.fillEllipse(sx, sy, 6, 5);
      g.fillStyle(0xb3b29b); g.fillEllipse(sx - 1, sy - 1, 4, 2);
    }
    g.lineStyle(3, 0x5b4632);
    g.lineBetween(cx - 6, base - 8, cx + 6, base - 2);
    g.lineBetween(cx + 6, base - 8, cx - 6, base - 2);
  } else {
    g.fillStyle(0x66794a);
    g.fillRoundedRect(x + 3, base - 20, size - 6, 20, 3);
    g.lineStyle(1, 0xa5a574, 0.65);
    for (let i = 0; i < 5; i++) g.lineBetween(x + 6 + i * 4, base - 18, x + 7 + i * 4, base - 2);
    if (type === 'arbeitsplatz') {
      g.fillStyle(0x505c50); g.fillEllipse(cx, base - 9, 22, 13);
      g.fillStyle(0xa1aa90); g.fillEllipse(cx - 1, base - 12, 19, 8);
      g.lineStyle(2.5, 0xb99b6c); g.lineBetween(cx - 6, base - 10, cx + 4, base - 15);
      g.fillStyle(0x384d50); g.fillTriangle(cx + 2, base - 18, cx + 8, base - 14, cx + 1, base - 12);
    }
  }
  return true;
}

export function drawConstruction(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, size: number, progress: number, paused: boolean, type = '') {
  const step = Math.floor(Math.max(0, Math.min(1, progress)) * 20);
  if (step > 0) {
    const base = y + size - 4;
    if (type === 'sleeping_spot') {
      drawPalmBedding(g, x, base, size, Math.ceil(step * 7 / 20));
    } else if (type.includes('campfire')) {
      for (let i = 0; i < Math.ceil(step / 3); i++) {
        const angle = i * Math.PI * 2 / 7;
        g.fillStyle(0x9a9d84); g.fillEllipse(x + size / 2 + Math.cos(angle) * 11, base - 4 + Math.sin(angle) * 5, 6, 5);
      }
    } else if (type === 'arbeitsplatz') {
      g.fillStyle(0x6c824e); g.fillRoundedRect(x + 4, base - 20, width - 8, 20, 3);
      for (let i = 0; i < Math.ceil(step / 5); i++) {
        g.fillStyle(i % 2 ? 0x9fa78b : 0x647363); g.fillEllipse(x + 8 + i * 5, base - 9, 9, 10);
      }
    } else {
      g.lineStyle(4, 0x92794f);
      for (let i = 0; i < Math.min(4, Math.ceil(step / 2)); i++) {
        const px = x + 5 + (width - 10) * i / 3;
        g.lineBetween(px, base, px, base - 32);
      }
      if (step >= 7) { g.lineStyle(3, 0xb9a073); g.lineBetween(x + 5, base - 32, x + width - 5, base - 32); }
      if (step >= 10 && ['palm_shelter', 'wooden_shelter', 'log_cabin'].includes(type)) for (let i = 0; i < step - 9; i++) {
        g.fillStyle(i % 2 ? 0x637c49 : 0x87965d);
        const px = x + i * width / 11;
        g.fillTriangle(px, base - 20, px + width / 11 + 2, base - 20, x + width / 2, base - 48);
      }
    }
  }
  if (step === 0) {
    g.fillStyle(0x9c8860, 0.24);
    g.fillRoundedRect(x + 2, y + 3, width - 4, size - 5, 3);
    g.lineStyle(2, 0xb5a073);
    for (const dx of [4, width - 4]) {
      g.lineBetween(x + dx, y + 5, x + dx, y + size - 3);
  }
  g.lineStyle(1, 0xc9bc93, 0.75);
  g.lineBetween(x + 4, y + 8, x + width - 4, y + 8);
  g.lineStyle(3, 0x7b6142);
  g.lineBetween(x + 9, y + size - 9, x + width - 8, y + 15);
  }
  g.fillStyle(0x24372f); g.fillRoundedRect(x + 3, y + size + 3, width - 6, 4, 2);
  g.fillStyle(paused ? 0xc5a563 : 0x9cb77e);
  g.fillRect(x + 4, y + size + 4, (width - 8) * Math.max(0, Math.min(1, progress)), 2);
}
