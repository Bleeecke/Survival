import type Phaser from 'phaser';

export const TREE_ART_TYPES = new Set(['wood', 'large_tree', 'banyan_tree', 'rubber_tree', 'cacao_tree', 'breadfruit_tree', 'exotic_fruit']);

export function drawTreeArt(g: Phaser.GameObjects.Graphics, type: string, cx: number, base: number, variant: number, quantity: number) {
  const banyan = type === 'banyan_tree', large = type === 'large_tree';
  const scale = (large ? 3.5 : banyan ? 3.2 : type === 'vine_tree' ? 1.6 : type === 'exotic_fruit' || type === 'cacao_tree' ? 0.72 : 1) * (0.94 + variant * 0.04);
  const p = (color: number, points: number[][], alpha = 1) => {
    g.fillStyle(color, alpha); g.beginPath();
    g.moveTo(cx + points[0][0] * scale, base + points[0][1] * scale);
    for (const [x, y] of points.slice(1)) g.lineTo(cx + x * scale, base + y * scale);
    g.closePath(); g.fillPath();
  };
  const line = (width: number, color: number, x: number, y: number, ex: number, ey: number) => {
    g.lineStyle(width * scale, color); g.lineBetween(cx + x * scale, base + y * scale, cx + ex * scale, base + ey * scale);
  };
  g.fillStyle(0x203b30, 0.25); g.fillEllipse(cx + 5, base + 3, (banyan ? 86 : large ? 74 : 52) * scale, (large || banyan ? 22 : 11) * scale);
  if (banyan) for (const x of [-32, -22, 23, 34]) {
    p(0x61533c, [[x - 1, -50], [x + 1, -49], [x + 2, -2], [x + 6, 2], [x - 3, 1]]);
    line(0.8, 0xa29166, x, -46, x + 1, -4);
  }
  p(type === 'rubber_tree' ? 0x7b7057 : 0x5c4935, [[-12, 3], [-5, -8], [-4, -44], [1, -58], [5, -48], [4, -10], [13, 4], [3, 1], [0, -6], [-4, 2]]);
  p(0xa08a60, [[-5, -5], [-3, -43], [0, -52], [0, -14], [3, 1], [-1, -4]]);
  for (const [x, y] of [[-23, -52], [25, -57], [-11, -68]]) {
    p(0x5c4935, [[-2, -25], [x - 2, y], [x + 1, y - 4], [4, -34]]);
    line(1, 0xa08a60, 0, -33, x, y);
  }
  line(1, 0x403e2c, 2, -8, 2, -27);
  const crown = banyan ? [[-29, -51, 20], [27, -53, 22], [-9, -67, 23], [12, -65, 24], [0, -48, 19]] :
    [[-20, -48, 18], [20, -52, 18], [-9, -65, 22], [12, -69, 20], [2, -48, 19]];
  for (const [index, [x, y, radius]] of crown.entries()) {
    const points: number[][] = [];
    for (let j = 0; j < 14; j++) {
      const a = j * Math.PI * 2 / 14;
      const r = radius * (j % 2 ? 0.86 : 1) * (1 + Math.sin(j * 3 + variant + index) * 0.08);
      points.push([x + Math.cos(a) * r, y + Math.sin(a) * r * 0.72]);
    }
    p(index === 4 ? 0x34573e : 0x2c4c39, points);
    p(index % 2 ? 0x587a49 : 0x496d43, points.map(([px, py]) => [x + (px - x) * 0.86 - 2, y + (py - y) * 0.8 - 3]));
    for (let j = 0; j < 7; j++) {
      const lx = x - radius * 0.6 + (j % 4) * radius * 0.35, ly = y - 8 + Math.floor(j / 4) * 9;
      p(j < 4 ? 0x829954 : 0x63834b, [[lx - 5, ly], [lx - 2, ly - 4], [lx + 4, ly - 3], [lx + 7, ly], [lx + 1, ly + 2]], 0.8);
    }
  }
  if (quantity > 0 && ['exotic_fruit', 'breadfruit_tree', 'cacao_tree'].includes(type)) {
    for (const [i, x] of [-17, 14, -4, 22, 5].entries()) {
      if (quantity < 3 && i > 1) break;
      const y = type === 'cacao_tree' ? -22 - i * 5 : -43 - (i % 3) * 5;
      const fx = type === 'cacao_tree' ? (i % 2 ? -4 : 4) : x;
      line(1, 0x514a2d, fx, y - 6, fx, y);
      g.fillStyle(type === 'breadfruit_tree' ? 0x94a15a : type === 'cacao_tree' ? 0xae7944 : 0xc99a51);
      g.fillEllipse(cx + fx * scale, base + y * scale, 6 * scale, (type === 'cacao_tree' ? 10 : 7) * scale);
      line(1, 0xd7bd76, fx - 1, y - 2, fx - 1, y + 2);
    }
  }
  if (type === 'rubber_tree') {
    line(1, 0x4b4434, -3, -19, 3, -22);
    g.fillStyle(0xded9b7); g.fillEllipse(cx + scale, base - 16 * scale, 2 * scale, 5 * scale);
  }
}
