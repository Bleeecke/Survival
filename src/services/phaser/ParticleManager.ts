/**
 * ParticleManager — a tiny world-space particle system rendered into one
 * shared Phaser Graphics object per frame. Designed for short-lived puffs
 * (footstep dust, build dust, hit-spark style fx) — not for thousands of
 * particles. All updates and draws happen in one pass during update().
 */

import Phaser from 'phaser';

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** ms remaining */
  life: number;
  /** initial life so we can compute fade */
  life0: number;
  /** start radius, in world px */
  r0: number;
  /** radius growth per ms */
  rGrow: number;
  /** RGB 0xRRGGBB */
  color: number;
  /** peak alpha (multiplied by life fade) */
  alpha: number;
  /** drag per ms — velocity multiplied by (1 - drag*dt) each step */
  drag: number;
  /** vertical acceleration (e.g. gravity) per ms² */
  gravity: number;
};

export class ParticleManager {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly particles: Particle[] = [];

  constructor(scene: Phaser.Scene, depth: number) {
    this.g = scene.add.graphics().setDepth(depth);
  }

  /** Light tan puff for footsteps on sand/beach. */
  footstepPuff(x: number, y: number, dirX: number, dirY: number): void {
    const tan = 0xd6c6a4;
    for (let i = 0; i < 2; i++) {
      const spread = (Math.random() - 0.5) * 8;
      this.particles.push({
        x: x + spread,
        y: y + (Math.random() - 0.5) * 2,
        vx: -dirX * 0.012 + (Math.random() - 0.5) * 0.015,
        vy: -dirY * 0.012 - 0.01 + (Math.random() - 0.5) * 0.01,
        life: 420 + Math.random() * 120,
        life0: 480,
        r0: 1.5 + Math.random() * 0.5,
        rGrow: 0.006,
        color: tan,
        alpha: 0.35,
        drag: 0.004,
        gravity: 0,
      });
    }
  }

  /** Bigger burst when placing a structure or harvesting something heavy. */
  buildDust(x: number, y: number): void {
    const tan = 0xc8b48a;
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.025 + Math.random() * 0.04;
      this.particles.push({
        x,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.5 - 0.03,
        life: 600 + Math.random() * 250,
        life0: 850,
        r0: 2 + Math.random() * 1.5,
        rGrow: 0.008,
        color: tan,
        alpha: 0.55,
        drag: 0.005,
        gravity: 0.00008,
      });
    }
  }

  /** Bright fleck — leaves, splinters, breaking. */
  breakPuff(x: number, y: number, color: number): void {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.04 + Math.random() * 0.06;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.05,
        life: 500 + Math.random() * 200,
        life0: 700,
        r0: 1.4,
        rGrow: 0,
        color,
        alpha: 0.8,
        drag: 0.003,
        gravity: 0.00018,
      });
    }
  }

  /** Step + draw every active particle. Called once per frame from GameManager. */
  update(deltaMs: number): void {
    const g = this.g;
    g.clear();
    const dt = deltaMs;
    const list = this.particles;
    let writeIdx = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      // Integrate
      const dragMul = Math.max(0, 1 - p.drag * dt);
      p.vx *= dragMul;
      p.vy *= dragMul;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Draw
      const t = p.life / p.life0;
      const a = p.alpha * t * t;
      const r = p.r0 + p.rGrow * (p.life0 - p.life);
      g.fillStyle(p.color, a);
      g.fillCircle(p.x, p.y, r);
      // Compact in place
      list[writeIdx++] = p;
    }
    list.length = writeIdx;
  }

  destroy(): void {
    this.particles.length = 0;
    this.g.destroy();
  }
}
