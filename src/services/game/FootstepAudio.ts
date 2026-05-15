/**
 * Procedural footstep sounds via Web Audio API.
 * Each tile surface has its own synthesis recipe.
 */

type Surface = 'sand' | 'grass' | 'jungle' | 'default';

export class FootstepAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  /** Map tile type string → surface */
  static surface(tileType: string): Surface {
    if (tileType === 'beach') return 'sand';
    if (tileType === 'grass') return 'grass';
    if (tileType === 'jungle') return 'jungle';
    return 'default';
  }

  play(surface: Surface) {
    try {
      const ctx = this.getCtx();
      switch (surface) {
        case 'sand':    this.playSand(ctx);   break;
        case 'grass':   this.playGrass(ctx);  break;
        case 'jungle':  this.playJungle(ctx); break;
        default:        this.playGrass(ctx);  break;
      }
    } catch {
      // AudioContext blocked — silently ignore
    }
  }

  /** Sand: soft noise burst, heavily low-pass filtered, short */
  private playSand(ctx: AudioContext) {
    const bufLen = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 1.5);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 400;
    lp.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    src.connect(lp).connect(gain).connect(this.master!);
    src.start();
    src.stop(ctx.currentTime + 0.1);
  }

  /** Grass: crisper noise, band-pass, two quick micro-bursts */
  private playGrass(ctx: AudioContext) {
    const now = ctx.currentTime;
    for (let burst = 0; burst < 2; burst++) {
      const t = now + burst * 0.025;
      const bufLen = Math.floor(ctx.sampleRate * 0.04);
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100 + Math.random() * 200;
      bp.Q.value = 1.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

      src.connect(bp).connect(gain).connect(this.master!);
      src.start(t);
      src.stop(t + 0.06);
    }
  }

  /** Jungle: dry wooden crack — short low-freq thud + noise click */
  private playJungle(ctx: AudioContext) {
    const now = ctx.currentTime;

    // Thud: short sine at ~80 Hz
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.04);

    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.4, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(thudGain).connect(this.master!);
    osc.start(now);
    osc.stop(now + 0.07);

    // Click: very short noise transient
    const bufLen = Math.floor(ctx.sampleRate * 0.02);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.3, now);

    src.connect(hp).connect(clickGain).connect(this.master!);
    src.start(now);
    src.stop(now + 0.025);
  }

  setVolume(v: number) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  destroy() {
    this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
