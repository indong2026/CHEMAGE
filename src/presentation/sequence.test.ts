import { afterEach, expect, it, vi } from 'vitest';
import { newGame, performAction } from '../game/engine';
import { battleSequence } from './sequence';
import { PlaybackController, eventDuration } from './playback';
import type { GameState } from '../game/types';
const rng = () => .85;
const guard = (s: GameState) => performAction(s, { type: 'endTurn' }, s.revision, rng);
const cast = (s: GameState, ids: number[]) => performAction(s, { type: 'cast', ids }, s.revision, rng);
afterEach(() => vi.useRealTimers());
it('전투 시작 YOUR TURN, 첫 시전은 배너 없음, 두 번째 뒤 ENEMY → YOUR 순서', () => {
  const s = newGame(rng);
  expect(battleSequence(s, false, true).events.map(e => [e.kind, e.target])).toEqual([['turn-banner', 'player']]);
  const first = cast(s, [1, 2, 3]); expect(battleSequence(first, false).events.some(e => e.kind === 'turn-banner')).toBe(false);
  const second = cast(first, [4]);
  const seq = battleSequence(second, false).events;
  expect(seq.filter(e => e.kind === 'turn-banner').map(e => e.target)).toEqual(['enemy', 'player']);
  expect(seq.findIndex(e => e.kind === 'turn-banner')).toBeLessThan(seq.findIndex(e => e.kind === 'enemy'));
  expect(seq.at(-1)?.target).toBe('player');
});
it('마력 100 알림은 재충전 주기마다 한 번, 적 행동과 순차 재생한다', () => {
  const s = newGame(rng); s.mana = 90;
  const first = cast(s, [1, 2, 3]), a = battleSequence(first, false);
  expect(a.events.filter(e => e.kind === 'ready')).toHaveLength(1);
  const next = guard(first), b = battleSequence(next, a.announced);
  expect(b.events.some(e => e.kind === 'ready')).toBe(false);
  const used = performAction(next, { type: 'burst' }, next.revision, rng), c = battleSequence(used, b.announced);
  expect(c.announced).toBe(false);
  used.mana = 90; used.inventory = [{ id: 100, element: 'Fe' }];
  expect(battleSequence(cast(used, [100]), c.announced).events.filter(e => e.kind === 'ready')).toHaveLength(1);
});
it('넘침으로 가득 찬 경우 적 행동 → 변환 → YOUR TURN → READY', () => {
  const s = newGame(rng); s.inventory = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, element: 'Na' as const })); s.mana = 90;
  const seq = battleSequence(guard(s), false).events;
  expect(seq.at(-1)?.kind).toBe('ready'); expect(seq.at(-2)?.kind).toBe('turn-banner');
  expect(seq.findIndex(e => e.kind === 'convert')).toBeGreaterThan(seq.findIndex(e => e.kind === 'enemy'));
});
it('처치 중 READY를 끼워 넣지 않고 다음 전투 시작에 한 번만 알린다', () => {
  const s = newGame(rng); s.enemy.hp = 1; s.mana = 90;
  const killed = cast(s, [1, 2, 3]), a = battleSequence(killed, false);
  expect(a.events.map(e => e.kind)).toEqual(['spell', 'damage', 'death', 'win']); expect(a.announced).toBe(false);
  const next = newGame(rng); next.mana = killed.mana;
  expect(battleSequence(next, a.announced, true).events.map(e => e.kind)).toEqual(['turn-banner', 'ready']);
});
it('패배 후 YOUR TURN/READY가 없으며 재시작하면 초기 배너만', () => {
  const s = newGame(rng); s.hp = 1; s.enemy.intent.value = 50;
  const seq = battleSequence(guard(s), false).events;
  expect(seq.filter(e => e.kind === 'turn-banner').map(e => e.target)).toEqual(['enemy']);
  expect(seq.at(-1)?.kind).toBe('defeat');
  expect(battleSequence(newGame(rng), false, true).events).toHaveLength(1);
});
it.each([1, 1.5])('%sx에서 배너/명중/완료가 누락되지 않고 규칙을 재실행하지 않는다', speed => {
  vi.useFakeTimers(); const game = guard(newGame(rng)), before = structuredClone(game);
  const seq = battleSequence(game, false).events, p = new PlaybackController(), seen = vi.fn(), done = vi.fn(); p.speed = speed;
  p.start(seq, seen, done); vi.advanceTimersByTime(eventDuration(seq[0]) / speed - 1); expect(seen).toHaveBeenCalledTimes(1);
  vi.runAllTimers(); expect(seen.mock.calls.map(c => c[0])).toEqual(seq); expect(done).toHaveBeenCalledTimes(1); expect(p.running).toBe(false); expect(game).toEqual(before);
});
it('재생 중 속도 변경과 간소화/움직임 줄이기도 잠금을 끝내고 순서를 유지한다', () => {
  vi.useFakeTimers(); const seq = battleSequence(guard(newGame(rng)), false).events;
  const p = new PlaybackController(), done = vi.fn(), step = vi.fn(); p.simpleBanners = true;
  p.start(seq, step, done); vi.advanceTimersByTime(350); expect(step).toHaveBeenCalledTimes(2);
  p.speed = 1.5; p.reducedMotion = true; vi.runAllTimers(); expect(done).toHaveBeenCalledTimes(1); expect(step).toHaveBeenCalledTimes(seq.length); expect(p.running).toBe(false);
});
