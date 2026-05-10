// Simple seeded random number generator
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextRange(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  // Perlin-like noise (simple implementation)
  perlin(x: number, y: number, scale: number): number {
    const xi = Math.floor(x / scale);
    const yi = Math.floor(y / scale);
    const xf = (x % scale) / scale;
    const yf = (y % scale) / scale;

    // Create seed for this cell
    const n00 = this.hash(xi, yi);
    const n10 = this.hash(xi + 1, yi);
    const n01 = this.hash(xi, yi + 1);
    const n11 = this.hash(xi + 1, yi + 1);

    // Interpolate
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);

    const n0 = n00 * (1 - u) + n10 * u;
    const n1 = n01 * (1 - u) + n11 * u;

    return n0 * (1 - v) + n1 * v;
  }

  private hash(x: number, y: number): number {
    let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }
}
