import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlaybackController, eventDuration } from './playback';
import { SynthAudio } from './sound';
import type { GameEvent } from '../game/types';
const events: GameEvent[] = [
  { kind: 'spell', cue: 'launch', effect: 'water', text: '물 발사' },
  { kind: 'damage', cue: 'impact', effect: 'water', value: 13, text: '13 피해' },
  { kind: 'spell', cue: 'launch', effect: 'salt', text: '소금 발사' },
  { kind: 'damage', cue: 'impact', effect: 'salt', value: 15, text: '15 피해' },
];
beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
it('이벤트가 순서대로 실행되고 발사 시간 전에는 명중하지 않는다', () => {
  const p = new PlaybackController(), step = vi.fn(), done = vi.fn(); p.start(events, step, done);
  expect(step).toHaveBeenCalledTimes(1); expect(step.mock.calls[0][0]).toBe(events[0]);
  vi.advanceTimersByTime(eventDuration(events[0]) - 1); expect(step).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(1); expect(step.mock.calls[1][0]).toBe(events[1]);
  vi.runAllTimers(); expect(step.mock.calls.map(call => call[0])).toEqual(events); expect(done).toHaveBeenCalledTimes(1);
});
it('건너뛰기를 여러 번 눌러도 완료는 한 번만 확정한다', () => {
  const p = new PlaybackController(), step = vi.fn(), done = vi.fn(); p.start(events, step, done);
  p.skip(); p.skip(); vi.runAllTimers(); expect(step).toHaveBeenCalledTimes(1); expect(done).toHaveBeenCalledTimes(1);
});
it('취소 후 새 재생은 이전 타이머나 완료 콜백에 영향을 받지 않는다', () => {
  const p = new PlaybackController(), old = vi.fn(), fresh = vi.fn();
  p.start(events, vi.fn(), old); p.cancel(); p.start(events, vi.fn(), fresh); vi.runAllTimers();
  expect(old).not.toHaveBeenCalled(); expect(fresh).toHaveBeenCalledTimes(1);
});
it('2배속과 움직임 줄이기는 순서를 유지하면서 재생 시간만 단축한다', () => {
  const p = new PlaybackController(), step = vi.fn(); p.speed = 2; p.start(events, step, vi.fn());
  vi.advanceTimersByTime(eventDuration(events[0]) / 2); expect(step).toHaveBeenCalledTimes(2);
  p.cancel(); p.reducedMotion = true; step.mockClear(); p.start(events, step, vi.fn());
  vi.advanceTimersByTime(55); expect(step).toHaveBeenCalledTimes(2); p.cancel();
});
it('오디오 미지원 또는 초기화 실패가 게임 실행을 중단하지 않는다', () => {
  const audio = new SynthAudio(); expect(() => { audio.unlock(); audio.select(); audio.complete(); audio.event(events[1]); audio.close(); }).not.toThrow();
  vi.stubGlobal('AudioContext', class { constructor() { throw new Error('no device'); } });
  const failed = new SynthAudio(); expect(() => failed.unlock()).not.toThrow(); expect(failed.supported).toBe(false); vi.unstubAllGlobals();
});
