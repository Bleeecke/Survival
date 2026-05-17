import { Howl, Howler } from 'howler';

type Track = 'menu' | 'day' | 'night';

const TRACKS: Record<Track, string> = {
  menu:  '/music/Main.mp3',
  day:   '/music/Day.mp3',
  night: '/music/night.mp3',
};

const FADE_MS = 3000;

class MusicManager {
  private sounds: Partial<Record<Track, Howl>> = {};
  private current: Track | null = null;
  private introSound: Howl | null = null;
  private _volume = (() => {
    const v = localStorage.getItem('survival-music-volume');
    return v !== null ? parseFloat(v) : 0.4;
  })();

  constructor() {
    if (localStorage.getItem('survival-music-muted') === 'true') {
      Howler.mute(true);
    }
  }

  private getOrCreate(track: Track): Howl {
    if (!this.sounds[track]) {
      this.sounds[track] = new Howl({
        src: [TRACKS[track]],
        loop: true,
        volume: 0,
        preload: true,
      });
    }
    return this.sounds[track]!;
  }

  get introPlaying() { return this.introSound?.playing() ?? false; }

  crossfadeTo(track: Track) {
    // Never interrupt a playing intro
    if (this.introPlaying) return;
    if (this.current === track) return;

    // Fade out current
    if (this.current) {
      const old = this.sounds[this.current];
      if (old) {
        old.fade(old.volume(), 0, FADE_MS);
        old.once('fade', () => old.stop());
      }
    }

    // Fade in new
    const next = this.getOrCreate(track);
    if (!next.playing()) next.play();
    next.fade(0, this._volume, FADE_MS);

    this.current = track;
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    localStorage.setItem('survival-music-volume', String(this._volume));
    if (this.current) {
      const s = this.sounds[this.current];
      if (s?.playing()) s.fade(s.volume(), this._volume, 500);
    }
    if (this.introSound?.playing()) {
      this.introSound.fade(this.introSound.volume(), this._volume, 500);
    }
  }

  get volume() { return this._volume; }

  stop() {
    if (this.current) {
      this.sounds[this.current]?.fade(this._volume, 0, FADE_MS);
      this.current = null;
    }
  }

  playIntro(onEnd: () => void) {
    // Fade out menu music over 1.5s, then start intro
    if (this.current) {
      const old = this.sounds[this.current];
      if (old) {
        old.fade(old.volume(), 0, 1500);
        old.once('fade', () => old.stop());
      }
      this.current = null;
    }

    this.introSound = new Howl({
      src: ['/music/Salz im Mund.mp3'],
      loop: false,
      volume: 0,
    });
    this.introSound.once('end', () => {
      this.introSound = null;
      onEnd();
    });
    this.introSound.play();
    this.introSound.fade(0, this._volume, 1500);
  }

  stopIntro() {
    if (this.introSound) {
      this.introSound.fade(this.introSound.volume(), 0, FADE_MS);
      this.introSound.once('fade', () => { this.introSound?.stop(); this.introSound = null; });
    }
  }

  mute(v: boolean) { Howler.mute(v); }
}

export const musicManager = new MusicManager();
