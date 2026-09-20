import type Phaser from 'phaser';
import { drawTreeArt, TREE_ART_TYPES } from './TreeArt';

export const RESOURCE_ART_TYPES = new Set([...TREE_ART_TYPES, 'pandanus', 'palm_tree', 'sticks', 'pebbles', 'flint', 'fiber', 'coconut', 'bamboo', 'mushroom', 'berry_bush', 'herbs']);

export function drawResourceArt(g: Phaser.GameObjects.Graphics, type: string, cx: number, base: number, variant: number, quantity: number): boolean {
  if (!RESOURCE_ART_TYPES.has(type)) return false;
  if (TREE_ART_TYPES.has(type)) {
    drawTreeArt(g, type, cx, base, variant, quantity);
    return true;
  }
  const polygon = (color: number, points: number[][], alpha = 1) => {
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(cx + points[0][0], base + points[0][1]);
    for (const [x, y] of points.slice(1)) g.lineTo(cx + x, base + y);
    g.closePath();
    g.fillPath();
  };
  const shadow = (w: number, h = 5) => {
    g.fillStyle(0x182e27, 0.27);
    g.fillEllipse(cx + 3, base + 2, w, h);
  };

  if (type === 'herbs') {
    shadow(24, 6);
    // A small, branching herb clump with paired leaves and pale flower tips.
    for (const [i, [ox, height, lean]] of [[-7, 15, -4], [0, 23, variant - 1], [6, 18, 5]].entries()) {
      const tipX = ox + lean, tipY = -height;
      g.lineStyle(1.3, 0x537349);
      g.lineBetween(cx + ox, base, cx + tipX, base + tipY);
      for (let pair = 0; pair < 3; pair++) {
        const t = 0.25 + pair * 0.23;
        const sx = ox + lean * t, sy = -height * t;
        for (const dir of [-1, 1]) {
          const length = 7 - pair;
          polygon(dir < 0 ? 0x537d50 : 0x86a568, [
            [sx, sy], [sx + dir * length * 0.35, sy - 4],
            [sx + dir * length, sy - 5], [sx + dir * length * 0.8, sy - 1],
            [sx + dir * 2, sy + 1],
          ]);
          g.lineStyle(0.65, 0xb2bd84, 0.7);
          g.lineBetween(cx + sx, base + sy, cx + sx + dir * length * 0.8, base + sy - 3);
        }
      }
      if (i !== variant) {
        g.fillStyle(0xc5b7cd);
        g.fillEllipse(cx + tipX - 1.5, base + tipY, 3, 3);
        g.fillEllipse(cx + tipX + 1.5, base + tipY - 1, 3, 3);
        g.fillStyle(0xeee1bd);
        g.fillCircle(cx + tipX, base + tipY - 0.5, 1);
      }
    }
  } else if (type === 'pandanus') {
    shadow(37, 8);
    for (const x of [-14, -7, 8, 15]) {
      polygon(0x6a5940, [[-2, -24], [3, -23], [x + 2, 2], [x - 1, 1]]);
      g.lineStyle(1, 0xb49a6b); g.lineBetween(cx, base - 22, cx + x, base);
    }
    polygon(0x756044, [[-4, -17], [-3, -46], [4, -46], [5, -18]]);
    for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 9; i++) {
      const a = (i * 40 + variant * 12 + layer * 18) * Math.PI / 180;
      const x = Math.cos(a) * (29 + layer * 5), y = -43 + Math.sin(a) * 15 + layer * 7;
      const mx = x * 0.55, my = -55 + (y + 43) * 0.3;
      polygon(i % 2 ? 0x64844b : 0x426443, [[0, -43], [mx - 3, my], [x, y], [mx + 2, my + 5]]);
      g.lineStyle(0.8, 0xa7b477, 0.65);
      g.beginPath(); g.moveTo(cx, base - 43); g.lineTo(cx + mx, base + my + 2); g.lineTo(cx + x, base + y); g.strokePath();
    }
    g.fillStyle(0xb99750); g.fillEllipse(cx - 6, base - 34, 7, 10);
    g.lineStyle(1, 0x7b673c); g.lineBetween(cx - 8, base - 36, cx - 4, base - 33);
  } else if (type === 'palm_tree') {
    const height = 49 + variant * 8, lean = (variant - 1) * 7;
    shadow(30, 8);
    polygon(0x725737, [[-4, 0], [lean - 2, -height], [lean + 3, -height], [4, 0]]);
    g.lineStyle(2, 0xb19a61, 0.8);
    g.lineBetween(cx - 2, base - 2, cx + lean, base - height);
    g.lineStyle(1, 0x453e29, 0.65);
    for (let i = 1; i <= 5; i++) {
      const offset = lean * i / 6;
      g.lineBetween(cx + offset - 2, base - height * i / 6, cx + offset + 3, base - height * i / 6 + 1);
    }
    const fronds = quantity >= 3 ? 7 : quantity >= 1 ? 5 : 3;
    for (let i = 0; i < fronds; i++) {
      const angle = (-165 + i * 26 + variant * 4) * Math.PI / 180;
      const length = 29 + (i % 3) * 6;
      const ex = lean + Math.cos(angle) * length, ey = -height + Math.sin(angle) * length + 15;
      const mx = lean + (ex - lean) * 0.53, my = -height + (ey + height) * 0.5 - 9;
      polygon(i % 2 ? 0x648447 : 0x3f6740, [[lean, -height], [mx - 4, my - 3], [ex, ey], [mx + 4, my + 4]]);
      g.lineStyle(1, 0xa5b570, 0.5);
      g.beginPath(); g.moveTo(cx + lean, base - height); g.lineTo(cx + mx, base + my); g.lineTo(cx + ex, base + ey); g.strokePath();
    }
    if (quantity > 0) {
      g.fillStyle(0x685036);
      g.fillEllipse(cx + lean - 3, base - height + 4, 5, 7);
      g.fillEllipse(cx + lean + 3, base - height + 5, 5, 6);
    }
  } else if (type === 'bamboo') {
    shadow(32, 8);
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 6, height = 65 + ((i * 7 + variant * 11) % 4) * 13;
      const lean = (i - 2) * 3;
      polygon(0x365444, [[x - 2, 0], [x + lean - 2, -height], [x + lean + 2, -height], [x + 3, 0]]);
      g.lineStyle(2, i % 2 ? 0x819459 : 0x647e4b);
      g.lineBetween(cx + x, base - 2, cx + x + lean, base - height);
      for (let y = 13; y < height; y += 17) {
        const sx = x + lean * y / height;
        g.lineStyle(1, 0xb0b780, 0.8);
        g.lineBetween(cx + sx - 2, base - y, cx + sx + 2, base - y);
      }
      for (let j = 0; j < 3; j++) {
        const y = -height + 10 + j * 19, sx = x - lean * y / height;
        const dir = (i + j) % 2 ? 1 : -1;
        g.lineStyle(1, 0x516b43);
        g.lineBetween(cx + sx, base + y, cx + sx + dir * 18, base + y - 8);
        for (let k = 0; k < 3; k++) {
          const lx = sx + dir * (5 + k * 5), ly = y - 2 - k * 2;
          polygon(k % 2 ? 0x809453 : 0x4d7549, [[lx, ly], [lx + dir * 5, ly - 8], [lx + dir * 13, ly - 12], [lx + dir * 7, ly - 2]]);
          polygon(0x61814a, [[lx, ly], [lx + dir * 9, ly + 2], [lx + dir * 12, ly + 9], [lx + dir * 3, ly + 4]]);
        }
      }
    }
  } else if (type === 'mushroom') {
    shadow(25);
    for (const [x, y, scale] of [[-7, -2, 0.65], [4, 0, 1], [11, 2, 0.5]]) {
      polygon(0xc4b895, [[x - 2 * scale, y], [x - scale, y - 12 * scale], [x + 2 * scale, y - 12 * scale], [x + 3 * scale, y]]);
      g.fillStyle(0x594735); g.fillEllipse(cx + x, base + y - 10 * scale, 19 * scale, 5 * scale);
      polygon(variant === 1 ? 0x987347 : 0xa07958, [[x - 10 * scale, y - 11 * scale], [x - 7 * scale, y - 17 * scale], [x - 2 * scale, y - 20 * scale], [x + 4 * scale, y - 19 * scale], [x + 9 * scale, y - 14 * scale], [x + 10 * scale, y - 11 * scale]]);
      g.fillStyle(0xd5b684, 0.8); g.fillEllipse(cx + x - 2 * scale, base + y - 17 * scale, 8 * scale, 3 * scale);
      g.lineStyle(1, 0xe0ceb0, 0.8);
      g.lineBetween(cx + x - 7 * scale, base + y - 11 * scale, cx + x + 7 * scale, base + y - 11 * scale);
    }
  } else if (type === 'berry_bush') {
    shadow(34, 7);
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 7, y = -14 - ((i + variant) % 3) * 5;
      g.lineStyle(2, 0x69553a);
      g.lineBetween(cx, base, cx + x, base + y);
      polygon(0x2e503d, [[x - 8, y + 8], [x - 10, y], [x - 5, y - 7], [x + 3, y - 9], [x + 9, y - 3], [x + 8, y + 6], [x, y + 10]]);
      for (let j = 0; j < 4; j++) {
        const lx = x - 5 + (j % 2) * 8, ly = y - 4 + Math.floor(j / 2) * 7;
        polygon(j < 2 ? 0x7d9656 : 0x527447, [[lx - 4, ly], [lx - 1, ly - 3], [lx + 5, ly - 2], [lx + 2, ly + 2]]);
      }
      if (quantity > 0 && (quantity >= 3 || i === 1 || i === 3)) {
        for (const [bx, by] of [[x - 2, y + 2], [x + 2, y + 3], [x, y + 6]]) {
          g.fillStyle(0x743343); g.fillCircle(cx + bx, base + by, 2.3);
          g.fillStyle(0xc5686b); g.fillCircle(cx + bx - 0.6, base + by - 0.7, 1);
        }
      }
    }
  } else if (type === 'flint') {
    shadow(19);
    polygon(0x293b3e, [[-9, 0], [-7, -7], [2, -13], [8, -7], [7, 0], [0, 3]]);
    polygon(0x809698, [[-7, -7], [2, -13], [0, -4], [-6, -1]]);
    polygon(0xc2cbb8, [[-7, -7], [2, -13], [-1, -9]]);
    polygon(0x526c72, [[0, -4], [2, -13], [8, -7], [7, 0]]);
  } else if (type === 'pebbles') {
    shadow(21);
    for (let i = 0; i < 3; i++) {
      const x = cx - 6 + i * 6, y = base - (i === 1 ? 5 : 1);
      g.fillStyle(0x555e52); g.fillEllipse(x, y, 8, 6);
      g.fillStyle(0xb1b19a); g.fillEllipse(x - 1, y - 1, 6, 3);
    }
  } else if (type === 'sticks') {
    shadow(25);
    g.lineStyle(4, 0x493b2d);
    g.lineBetween(cx - 10, base, cx + 7, base - 10);
    g.lineBetween(cx - 5, base - 9, cx + 10, base - 3);
    g.lineStyle(2, 0xb99b6c);
    g.lineBetween(cx - 10, base - 1, cx + 7, base - 11);
    g.lineBetween(cx - 5, base - 10, cx + 10, base - 4);
    g.lineStyle(1.5, 0xceb589);
    g.lineBetween(cx + 3, base - 8, cx + 3, base - 13);
  } else if (type === 'fiber') {
    shadow(21);
    for (let i = 0; i < 5; i++) {
      const tip = -12 + i * 6, height = 14 + (i % 3) * 5;
      polygon(i % 2 ? 0xa9b36d : 0x7f9957, [[-2, 0], [tip - 1, -height], [tip + 3, -height + 5], [3, 0]]);
    }
    g.fillStyle(0xcec193); g.fillEllipse(cx, base - 1, 6, 4);
  } else if (type === 'coconut') {
    shadow(17);
    g.fillStyle(0x59422e); g.fillEllipse(cx, base - 5, 14, 13);
    g.fillStyle(0xb29661); g.fillEllipse(cx - 2, base - 7, 9, 8);
    g.fillStyle(0x443b2c); g.fillCircle(cx + 2, base - 7, 1.2);
  }
  return true;
}
