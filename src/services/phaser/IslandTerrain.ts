import type { IslandSettings } from '../../types/generation';

export function smoothField(input: Float32Array, w: number, h: number, radius: number): Float32Array {
  const summed = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += input[y * w + x];
      summed[(y + 1) * (w + 1) + x + 1] = summed[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Float32Array(input.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - radius), x1 = Math.min(w, x + radius + 1);
    const y0 = Math.max(0, y - radius), y1 = Math.min(h, y + radius + 1);
    out[y * w + x] = (summed[y1 * (w + 1) + x1] - summed[y0 * (w + 1) + x1]
      - summed[y1 * (w + 1) + x0] + summed[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
  }
  return out;
}

export function quantile(values: number[], fraction: number): number {
  if (!values.length) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

/** Separate coastline selection from inland height tiers. Keep only the main island. */
export function islandDistances(field: Float32Array, w: number, h: number, settings: IslandSettings, seed: number): Int32Array {
  const calm = smoothField(field, w, h, 4);
  const noise = (x: number, y: number, scale: number) => {
    const ix = Math.floor(x / scale), iy = Math.floor(y / scale);
    const hash = (a: number, b: number) => { const value = Math.sin(a * 127.1 + b * 311.7 + seed * 0.713) * 43758.5453; return value - Math.floor(value); };
    let u = x / scale - ix, v = y / scale - iy;
    u = u * u * (3 - 2 * u); v = v * v * (3 - 2 * v);
    return (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v)
      + (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v;
  };
  const coast = Array.from(field, (value, i) => {
    const x = i % w, y = Math.floor(i / w);
    const edgeDistance = 1 - Math.max(Math.abs(x - w / 2) / (w / 2), Math.abs(y - h / 2) / (h / 2));
    const envelope = Math.min(1, Math.max(0, edgeDistance * 4));
    return calm[i] * (1 - settings.coastRoughness) + value * settings.coastRoughness
      + ((noise(x, y, 48) - 0.5) * 0.22
      + (noise(x + 500, y + 500, 11) - 0.5) * settings.coastRoughness * 0.18) * envelope;
  });
  const threshold = quantile(coast, 1 - settings.landFraction);
  const land = Uint8Array.from(coast, (v, i) => v > threshold && i % w > 1 && i % w < w - 2 && Math.floor(i / w) > 1 && Math.floor(i / w) < h - 2 ? 1 : 0);
  const neighbors = (i: number) => [i % w ? i - 1 : -1, i % w < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < w * (h - 1) ? i + w : -1];
  const seen = new Uint8Array(land.length);
  let largest: number[] = [];
  for (let i = 0; i < land.length; i++) {
    if (!land[i] || seen[i]) continue;
    const queue = [i]; seen[i] = 1;
    for (let head = 0; head < queue.length; head++) for (const n of neighbors(queue[head])) {
      if (n >= 0 && land[n] && !seen[n]) { seen[n] = 1; queue.push(n); }
    }
    if (queue.length > largest.length) largest = queue;
  }
  land.fill(0); for (const i of largest) land[i] = 1;
  const distance = new Int32Array(land.length).fill(-1);
  const queue: number[] = [];
  for (let i = 0; i < land.length; i++) if (!land[i]) { distance[i] = 0; queue.push(i); }
  for (let head = 0; head < queue.length; head++) for (const n of neighbors(queue[head])) {
    if (n >= 0 && distance[n] < 0) { distance[n] = distance[queue[head]] + 1; queue.push(n); }
  }
  return distance;
}
