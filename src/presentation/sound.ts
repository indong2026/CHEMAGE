import type { GameEvent, Effect } from '../game/types';

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
type Voice = { frequency: number; end: number; duration: number; type: OscillatorType };
const VOICES: Partial<Record<Effect, Voice>> = {
  hydrogen: { frequency: 980, end: 440, duration: .15, type: 'sine' },
  alkali: { frequency: 480, end: 980, duration: .2, type: 'triangle' },
  ferrous: { frequency: 1500, end: 120, duration: .24, type: 'square' },
  water: { frequency: 780, end: 220, duration: .18, type: 'sine' },
  salt: { frequency: 1600, end: 620, duration: .12, type: 'triangle' },
  acid: { frequency: 180, end: 760, duration: .18, type: 'sawtooth' },
  peroxide: { frequency: 490, end: 70, duration: .16, type: 'square' },
  methane: { frequency: 120, end: 28, duration: .32, type: 'sawtooth' },
  ironOxide: { frequency: 360, end: 50, duration: .22, type: 'square' },
  oxygen: { frequency: 350, end: 1400, duration: .25, type: 'sine' },
  iron: { frequency: 760, end: 380, duration: .19, type: 'triangle' },
  carbon: { frequency: 220, end: 480, duration: .22, type: 'sine' },
  graphite: { frequency: 150, end: 75, duration: .19, type: 'triangle' },
  zero: { frequency: 180, end: 25, duration: .48, type: 'sawtooth' },
};
export class SynthAudio {
  enabled = true;
  supported = true;
  private context: AudioContext | null = null;

  /** Only invoke from a real input event; browsers retain control of autoplay. */
  unlock() {
    if (!this.enabled || !this.supported) return;
    try {
      const Constructor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
      if (!Constructor) { this.supported = false; return; }
      this.context ??= new Constructor();
      if (this.context.state === 'suspended') void this.context.resume().catch(() => undefined);
    } catch { this.supported = false; }
  }
  private tone(frequency: number, end: number, duration: number, type: OscillatorType = 'triangle', volume = .035, delay = 0) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    try {
      const start = ctx.currentTime + delay, oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
      gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .008);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(start); oscillator.stop(start + duration + .02);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    } catch { /* Audio support must never affect the turn. */ }
  }
  private noise(duration: number, volume: number, frequency: number) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== 'running') return;
    try {
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + duration);
      source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); source.start();
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    } catch { /* A missing audio device is non-fatal. */ }
  }
  select() { this.tone(600, 950, .045, 'triangle', .018); }
  complete() { [523, 659, 784].forEach((f, i) => this.tone(f, f, .12, 'sine', .025, i * .035)); }
  event(event: GameEvent) {
    if (event.kind === 'reaction') { [440, 660, 880].forEach((f,i) => this.tone(f,f * 1.2,.16,'triangle',.03,i * .06)); return; }
    if (event.kind === 'turn-banner') {
      if (event.target === 'enemy') { this.tone(220, 110, .18, 'square', .025); this.tone(165, 82, .16, 'triangle', .025, .18); }
      return;
    }
    if (event.kind === 'ready') { [392, 587, 784, 1174].forEach((f, i) => this.tone(f, f * 1.1, .18, 'sine', .035, i * .065)); return; }
    if (event.kind === 'death') { this.noise(.2, .05, 1800); [784, 1046].forEach((f, i) => this.tone(f, f / 2, .2, 'triangle', .035, i * .1)); return; }
    if (event.cue === 'launch') { this.tone(event.target === 'player' ? 140 : 380, event.target === 'player' ? 90 : 700, .12, 'triangle', .018); return; }
    if (event.kind === 'win') { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, f, .2, 'triangle', .025, i * .07)); return; }
    if (event.shieldBreak) this.noise(.12, .04, 3200);
    if (event.target === 'player' && event.kind === 'damage') {
      if (!event.value) this.tone(940, 560, .17, 'triangle', .04);
      else { this.tone(130, 40, .2, 'square', .025); this.noise(.13, .04, 1200); }
      return;
    }
    if ((event.multiplier ?? 1) > 1) { this.tone(1100, 600, .12, 'triangle', .045); this.noise(.09, .04, 2200); }
    const voice = event.effect ? VOICES[event.effect] : undefined;
    if (voice) this.tone(voice.frequency, voice.end, voice.duration, voice.type, event.effect === 'zero' ? .065 : .035);
    else if (event.kind === 'damage') this.tone(270, 80, .12, 'triangle');
    if (event.effect === 'zero') { this.noise(.45, .14, 1800); this.tone(60, 25, .5, 'sine', .1); }
    else if (event.effect === 'methane') this.noise(.3, .085, 1500);
    else if (event.effect === 'water') this.noise(.13, .035, 2600);
    else if (event.effect === 'ironOxide') this.tone(1400, 320, .13, 'square', .02);
    else if (event.effect === 'peroxide' || event.effect === 'dot') this.noise(.1, .04, 3600);
  }
  close() { if (this.context) void this.context.close().catch(() => undefined); this.context = null; }
}
