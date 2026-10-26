import type { GameEvent } from '../game/types';

export function eventDuration(event: GameEvent) {
  if (event.kind === 'reconstruct-ready') return 1200;
  if (event.kind === 'reconstruct') return 850;
  if (event.kind === 'reaction') return 650;
  if (event.kind === 'shield-end') return 200;
  if (event.kind === 'turn-banner') return 700;
  if (event.kind === 'ready') return 800;
  if (event.kind === 'convert') return 550;
  if (event.effect === 'zero') return event.cue === 'launch' ? 400 : 460;
  if (event.kind === 'death') return event.frame?.enemy.id === 'golem' ? 750 : 600;
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
  simpleBanners = false;
  get running() { return this.done !== null; }

  start(events: GameEvent[], onEvent: (event: GameEvent, index: number) => void, onComplete: () => void) {
    this.cancel();
    this.done = onComplete;
    const generation = this.generation;
    const advance = (index: number) => {
      if (generation !== this.generation || !this.done) return;
      if (index >= events.length) { this.skip(); return; }
      onEvent(events[index], index);
      const event = events[index];
      const notice = event.kind === 'turn-banner' || event.kind === 'ready' || event.kind === 'reconstruct-ready';
      const duration = notice && (this.reducedMotion || this.simpleBanners) ? 350 : this.reducedMotion ? (event.kind === 'death' ? 250 : 110) : eventDuration(event);
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

