import { expect, it } from 'vitest';
import { newGame, performAction } from './engine';
import { suggestions, recipeIds } from './suggestions';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import type { Action, Element, GameState } from './types';
function setup(elements: Element[] = []) {
  const s = newGame(() => .1);
  s.inventory = elements.map((element, i) => ({ id: i + 1, element })); s.nextId = 100; s.freshIds = [];
  s.enemy.hp = 200; s.enemy.intent = { type: 'attack', value: 12, label: '공격' };
  return s;
}
const run = (s: GameState, action: Action) => performAction(s, action, s.revision, () => .1);
it('가방 12개가 꽉 차면 새 원소 3개만 변환하며 기존 ID를 보존한다', () => {
  const s = setup(Array(12).fill('H')); const n = run(s, { type: 'endTurn' });
  expect(n.inventory).toEqual(s.inventory); expect(n.mana).toBe(45); expect(n.stats.converted).toBe(3);
  expect(n.events.find(e => e.kind === 'convert')?.tiles?.map(t => t.id)).toEqual([100, 101, 102]);
  expect(n.enemy.hp).toBe(200); expect(n.turn).toBe(2);
});
it('빈 칸만큼 먼저 저장하고 새 초과분만 마력으로 변환한다', () => {
  const s = setup(Array(10).fill('Na')); const n = run(s, { type: 'endTurn' });
  expect(n.inventory).toHaveLength(12); expect(n.inventory.slice(0, 10)).toEqual(s.inventory); expect(n.mana).toBe(15);
  expect(n.freshIds).toEqual([100, 101]); expect(n.events.find(e => e.kind === 'convert')?.tiles?.[0].id).toBe(102);
});
it('가방 확장이 적용되며 정상 획득에서는 마력이 생기지 않는다', () => {
  const s = setup(Array(11).fill('Na')); s.upgrades.capacity = 14;
  const n = run(s, { type: 'endTurn' }); expect(n.inventory).toHaveLength(14); expect(n.mana).toBe(0);
});
it('마법과 초과 변환 모두 마력 100에서 제한되며 실제 획득량을 표시한다', () => {
  const s = setup(Array(12).fill('Na')); s.mana = 95;
  const n = run(s, { type: 'endTurn' }); expect(n.mana).toBe(100); expect(n.events.find(e => e.kind === 'convert')?.value).toBe(5);
  const c = setup(['C']); c.mana = 95; expect(run(c, { type: 'cast', ids: [1] }).mana).toBe(100);
});
it('마력 99에서는 필살기를 거절하며 가방을 비워도 자동 발동하지 않는다', () => {
  const s = setup(['C', 'Fe']); s.mana = 79;
  const n = run(run(s, { type: 'cast', ids: [1] }), { type: 'cast', ids: [2] });
  expect(n.mana).toBe(99); expect(n.stats.bursts).toBe(0); expect(run(n, { type: 'burst' })).toBe(n);
});
it('ZERO는 원소와 별개로 30 피해, 방어력 관통, 보호막 적용 후 턴을 끝낸다', () => {
  const s = setup(['Na']); s.enemy.id = 'beetle'; s.enemy.shield = 7; s.mana = 100;
  const n = run(s, { type: 'burst' }); expect(n.enemy.hp).toBe(177); expect(n.mana).toBe(0);
  expect(n.inventory[0]).toEqual(s.inventory[0]); expect(n.turn).toBe(2); expect(n.stats.bursts).toBe(1); expect(n.hp).toBe(48);
});
it('첫 마법으로 채운 마력은 즉시 사용할 수 있고 방어 마법의 보호막을 유지한다', () => {
  const s = setup(['Fe']); s.mana = 90;
  const first = run(s, { type: 'cast', ids: [1] }); expect(first.mana).toBe(100); expect(first.turn).toBe(1);
  const n = run(first, { type: 'burst' }); expect(n.hp).toBe(60); expect(n.stats.turns).toBe(1); expect(n.stats.casts).toBe(1);
});
it('ZERO 처치 시 적 공격과 다음 턴 원소 획득을 취소한다', () => {
  const s = setup(['Na']); s.enemy.hp = 30; s.mana = 100;
  const n = run(s, { type: 'burst' }); expect(n.screen).toBe('reward'); expect(n.mana).toBe(0); expect(n.inventory).toHaveLength(1);
  expect(n.events.some(e => e.kind === 'enemy' || e.kind === 'turn')).toBe(false);
});
it('ZERO를 넘긴 직후 생긴 초과 마력은 새로운 획득이며 이전 100을 재사용하지 않는다', () => {
  const s = setup(Array(12).fill('Na')); s.mana = 100;
  const n = run(s, { type: 'burst' }); expect(n.mana).toBe(45); expect(run(n, { type: 'burst' })).toBe(n);
});
it('명중 프레임에서만 HP가 감소하고 적 발사 때는 플레이어 HP를 유지한다', () => {
  const s = setup(['H', 'H', 'O']); s.spellsUsed = 1;
  const n = run(s, { type: 'cast', ids: [1, 2, 3] });
  const launch = n.events.find(e => e.kind === 'spell')!, impact = n.events.find(e => e.target === 'enemy' && e.cue === 'impact')!;
  expect(launch.frame?.enemy.hp).toBe(200); expect(impact.frame?.enemy.hp).toBe(187);
  expect(n.events.find(e => e.kind === 'enemy')?.frame?.hp).toBe(60);
  expect(n.events.find(e => e.target === 'player' && e.cue === 'impact')?.frame?.hp).toBe(48);
  expect(n.events.at(-1)?.frame?.turn).toBe(2);
});
it('미발견 레시피는 추천하지 않고 발견+보유 조건을 만족한 최대 3개만 추천한다', () => {
  const s = setup(['H', 'H', 'O', 'O', 'C', 'Na', 'Cl', 'Fe']);
  expect(suggestions(s.inventory, [])).toEqual([]);
  expect(suggestions(s.inventory, ['water']).map(s => s.id)).toEqual(['water']);
  expect(suggestions(s.inventory, SPELLS.map(s => s.id))).toHaveLength(3);
  expect(suggestions(s.inventory, ['methane'])).toEqual([]);
});
it('자동 선택은 실제 타일 ID를 한 번씩만 사용하며 원본을 소비하지 않는다', () => {
  const s = setup(['O', 'H', 'Na', 'H', 'Cl']); const snapshot = structuredClone(s.inventory);
  const ids = recipeIds(s.inventory, SPELL_BY_ID.water)!;
  expect(ids).toHaveLength(3); expect(new Set(ids).size).toBe(3); expect(s.inventory).toEqual(snapshot);
  expect(recipeIds(s.inventory, SPELL_BY_ID.methane)).toBeUndefined();
});
