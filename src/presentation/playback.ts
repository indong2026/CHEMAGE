import type { GameEvent } from '../game/types';

export function eventDuration(event: GameEvent) {
  if (event.kind === 'convert') return 550;
  if (event.effect === 'zero') return event.cue === 'launch' ? 400 : 460;
  if (event.kind === 'death') return 380;
  if (event.kind === 'win' || event.kind === 'defeat' || event.kind === 'phase') return 360;
  if (event.kind === 'turn') return 180;
  if (event.cue === 'launch') return event.effect?.startsWith('enemy-') ? 330 : 270;
  return event.cue === 'impact' ? 310 : 260;
}

/** Timers only present resolved events. They never execute or repeat game rules. */
export class PlaybackController {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private done: (() => void) | null = null;
  speed = 1;
  reducedMotion = false;
  get running() { return this.done !== null; }

  start(events: GameEvent[], onEvent: (event: GameEvent, index: number) => void, onComplete: () => void) {
    this.cancel();
    this.done = onComplete;
    const generation = this.generation;
    const advance = (index: number) => {
      if (generation !== this.generation || !this.done) return;
      if (index >= events.length) { this.skip(); return; }
      onEvent(events[index], index);
      const duration = this.reducedMotion ? 110 : eventDuration(events[index]);
      this.timer = setTimeout(() => advance(index + 1), duration / this.speed);
    };
    advance(0);
  }
  skip() {
    const complete = this.done;
    this.cancel();
    complete?.();
  }
  cancel() {
    clearTimeout(this.timer); this.generation++; this.done = null;
  }
}

