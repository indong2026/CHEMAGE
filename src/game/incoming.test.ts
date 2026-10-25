import { describe, expect, it } from 'vitest';
import { battleFrame, newGame, performAction } from './engine';
import { incomingAction, intentDamageLabel } from './incoming';
import type { DirectHit, Element, GameState, Intent } from './types';

const rng = () => .5;
function fixture(elements: Element[], hits: DirectHit[]) {
  const s = newGame(rng);
  s.enemy.hp = 120;
  s.enemy.intent = { type: hits[0].type, value: hits.reduce((n, h) => n + h.value, 0), label: '검증 공격', hits };
  s.inventory = elements.map((element, i) => ({ id: i + 1, element })); s.nextId = 100;
  return s;
}
const cast = (s: GameState, ids: number[]) => performAction(s, { type: 'cast', ids }, s.revision, rng);
const guard = (s: GameState) => performAction(s, { type: 'endTurn' }, s.revision, rng);
const impacts = (s: GameState) => s.events.filter(e => e.kind === 'damage' && e.target === 'player');
const cleared = (s: GameState) => {
  expect(s.playerShield).toBe(0); expect(s.turnEffects.fireReduction).toBe(0); expect(s.turnEffects.reflect).toBe(0);
};

describe('13번 보호막 소모 순서', () => {
  it.each([
    { type: 'attack', value: 20, hp: 60, left: 8, blocked: 20 },
    { type: 'fire', value: 40, hp: 53, left: 0, blocked: 28 },
  ] as const)('Fe + CO₂: $type $value → HP $hp, 명중 직후 잔량 $left', ({ type, value, hp, left, blocked }) => {
    const s = fixture(['Fe', 'C', 'O', 'O'], [{ type, value }]);
    const n = cast(cast(s, [1]), [2, 3, 4]);
    expect(n.hp).toBe(hp); expect(impacts(n)[0]).toMatchObject({ blocked, value: 60 - hp, frame: { playerShield: left } });
    expect(n.events.filter(e => e.kind === 'shield-end')).toHaveLength(1); cleared(n);
  });
  it('Fe 후 턴 종료는 추가 보호막 없이 일반 공격 30에서 HP 피해 14', () => {
    const n = guard(cast(fixture(['Fe'], [{ type: 'attack', value: 30 }]), [1]));
    expect(impacts(n)[0]).toMatchObject({ blocked: 16, value: 14 }); expect(n.hp).toBe(46); cleared(n);
  });
  it('연속 10, 20 사이에 보호막 14를 유지하고 끝에서 한 번만 해제한다', () => {
    const s = fixture([], [{ type: 'attack', value: 10 }, { type: 'attack', value: 20 }]); s.playerShield = 24; const n = guard(s);
    expect(impacts(n).map(e => [e.blocked, e.value, e.frame?.playerShield])).toEqual([[10, 0, 14], [14, 6, 0]]);
    expect(n.hp).toBe(54); expect(n.stats.enemyActions).toBe(1); expect(n.turn).toBe(2);
    const end = n.events.findIndex(e => e.kind === 'shield-end');
    expect(end).toBeGreaterThan(n.events.lastIndexOf(impacts(n)[1]));
    expect(n.events.filter(e => e.kind === 'shield-end')).toHaveLength(1);
    expect(impacts(n).every(e => e.wardActive)).toBe(true);
    expect(n.events.at(-1)?.wardActive).toBe(false); cleared(n);
  });
  it('CO₂ 2회는 보호막 24, 연속 화염 10 + 20 감소량은 전체 5', () => {
    const s = fixture(['C', 'O', 'O', 'C', 'O', 'O'], [{ type: 'fire', value: 10 }, { type: 'fire', value: 20 }]);
    const n = cast(cast(s, [1, 2, 3]), [4, 5, 6]);
    expect(impacts(n).map(e => [e.blocked, e.value])).toEqual([[5, 0], [19, 1]]);
    expect(n.hp).toBe(59); cleared(n);
  });
  it('일반 타격은 CO₂를 소모하지 않고 첫 화염에만 적용하며 음수 피해를 만들지 않는다', () => {
    const intent: Intent = { type: 'attack', value: 6, label: '혼합', hits: [{ type: 'attack', value: 1 }, { type: 'fire', value: 2 }, { type: 'fire', value: 3 }] };
    const result = incomingAction(60, 1, intent, { fireReduction: 5, reflect: 0, wetApplied: false, acidApplied: false });
    expect(result.hits.map(h => [h.reduction, h.blocked, h.damage])).toEqual([[0, 1, 0], [2, 0, 0], [0, 0, 3]]);
    expect(intentDamageLabel(intent)).toBe('1 + 2 + 3');
  });
  it('C 2회는 완전 방어한 연속 공격도 모두 끝난 후 반사 3을 한 번 처리한다', () => {
    const n = cast(cast(fixture(['C', 'C'], [{ type: 'attack', value: 5 }, { type: 'attack', value: 8 }]), [1]), [2]);
    expect(n.hp).toBe(60); expect(n.enemy.hp).toBe(117);
    const reflections = n.events.filter(e => e.effect === 'reflect'); expect(reflections).toHaveLength(1); expect(reflections[0].value).toBe(3);
    expect(n.events.indexOf(reflections[0])).toBeGreaterThan(n.events.indexOf(impacts(n)[1])); cleared(n);
  });
  it('CO₂와 C는 함께 유지되며 화염 감소와 반사가 각각 한 번 적용된다', () => {
    const n = cast(cast(fixture(['C', 'C', 'O', 'O'], [{ type: 'fire', value: 15 }, { type: 'fire', value: 15 }]), [1]), [2, 3, 4]);
    expect(impacts(n).map(e => [e.blocked, e.value])).toEqual([[10, 0], [12, 3]]);
    expect(n.enemy.hp).toBe(117); expect(n.hp).toBe(57); cleared(n);
  });
  it.each(['wait', 'charge', 'shield'] as const)('비공격 $type 행동에도 보호막/특수 효과가 만료되며 반사하지 않는다', type => {
    const s = fixture(['C', 'C', 'O', 'O'], [{ type: 'attack', value: 10 }]);
    s.enemy.intent = { type, value: type === 'shield' ? 10 : 0, label: '비공격' };
    const n = cast(cast(s, [1]), [2, 3, 4]);
    expect(impacts(n)).toHaveLength(0); expect(n.enemy.hp).toBe(120);
    expect(n.events.filter(e => e.kind === 'shield-end')).toHaveLength(1); cleared(n);
  });
  it('반사로 양쪽이 사망하면 패배 우선, 잔류 방어 효과도 모두 제거한다', () => {
    const s = fixture(['C'], [{ type: 'attack', value: 20 }, { type: 'attack', value: 20 }]); s.hp = 1; s.enemy.hp = 3;
    const n = guard(cast(s, [1]));
    expect(n.hp).toBe(0); expect(n.enemy.hp).toBe(0); expect(n.screen).toBe('defeat');
    expect(n.events.some(e => e.kind === 'win' || e.kind === 'death')).toBe(false);
    expect(impacts(n).map(e => e.value)).toEqual([1, 0]); cleared(n);
  });
  it('플레이어 마법으로 전투가 끝나도 보호막과 특수 효과를 지운다', () => {
    const s = fixture(['C', 'H', 'H', 'O'], [{ type: 'attack', value: 10 }]); s.enemy.hp = 1;
    const n = cast(cast(s, [1]), [2, 3, 4]);
    expect(n.screen).toBe('reward'); cleared(n);
    expect(n.events.find(e => e.kind === 'death')?.frame?.playerShield).toBe(0);
  });
  it('연속 공격 스냅샷과 입력 상태가 서로 변하지 않는다', () => {
    const s = fixture([], [{ type: 'attack', value: 5 }, { type: 'fire', value: 8 }]); const before = structuredClone(s);
    const n = guard(s); expect(s).toEqual(before);
    const frame = battleFrame(s); frame.enemy.intent.hits![0].value = 100;
    expect(s.enemy.intent.hits![0].value).toBe(5); expect(n.events[0].frame?.enemy.intent.hits![0].value).toBe(5);
  });
});
