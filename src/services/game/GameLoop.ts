export interface GameLoopState {
  time: number;
  deltaTime: number;
  tick: number;
  tickRate: number;
  isPaused: boolean;
}

export class GameLoop {
  private state: GameLoopState = {
    time: 0,
    deltaTime: 0,
    tick: 0,
    tickRate: 100,
    isPaused: false,
  };

  private lastTickTime = 0;
  private tickCallbacks: Array<() => void> = [];
  private tickFired = false;

  update(deltaMs: number) {
    if (this.state.isPaused) return;

    this.state.time += deltaMs;
    this.state.deltaTime = deltaMs;

    // Reset tick flag each frame
    this.tickFired = false;

    if (this.state.time - this.lastTickTime >= this.state.tickRate) {
      this.executeTick();
      this.lastTickTime = this.state.time;
      this.state.tick++;
      this.tickFired = true;
    }
  }

  private executeTick() {
    for (const callback of this.tickCallbacks) {
      callback();
    }
  }

  onTick(callback: () => void) {
    this.tickCallbacks.push(callback);
  }

  isTickReady(): boolean {
    return !this.state.isPaused && this.tickFired;
  }

  getState(): GameLoopState {
    return { ...this.state };
  }

  pause() {
    this.state.isPaused = true;
  }

  resume() {
    this.state.isPaused = false;
    // Reset tick timer so we don't fire a storm of ticks after a long pause
    this.lastTickTime = this.state.time;
  }

  reset() {
    this.state = {
      time: 0,
      deltaTime: 0,
      tick: 0,
      tickRate: 100,
      isPaused: false,
    };
    this.lastTickTime = 0;
    this.tickCallbacks = [];
  }
}
