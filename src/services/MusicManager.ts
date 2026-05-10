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

  crossfadeTo(track: Track) {
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
    if (this.current) {
      const s = this.sounds[this.current];
      if (s?.playing()) s.fade(s.volume(), this._volume, 500);
    }
  }

  get volume() { return this._volume; }

  stop() {
    if (this.current) {
      this.sounds[this.current]?.fade(this._volume, 0, FADE_MS);
      this.current = null;
    }
  }

  mute(v: boolean) { Howler.mute(v); }
}

export const musicManager = new MusicManager();
