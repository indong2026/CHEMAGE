import { describe, expect, it } from 'vitest';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import { ENEMIES } from '../data/enemies';
import { chooseReward, newGame, performAction } from './engine';
import { recipeIds } from './suggestions';
import { previewSpell } from './preview';
import { isDangerous } from './danger';
import type { Element, GameState, SpellId } from './types';
const rng = () => .5;
function fixture(elements: Element[]) {
  const s = newGame(rng); s.enemy.id = 'golem'; s.enemy.hp = 120;
  s.enemy.intent = { type: 'fire', value: 40, label: '검증용 화염' };
  s.inventory = elements.map((element, i) => ({ id: i + 1, element })); s.nextId = 100;
  return s;
}
const cast = (s: GameState, id: SpellId) => performAction(s, { type: 'cast', ids: recipeIds(s.inventory, SPELL_BY_ID[id])! }, s.revision, rng);
const ward = (s: GameState) => s.events.find(e => e.kind === 'shield' && e.target === 'player')!;

describe('합산 보호막', () => {
  it.each([
    { elements: ['Fe', 'Fe'], a: 'iron', b: 'iron', total: 32, reduction: 0, reflection: 0 },
    { elements: ['Fe', 'C', 'O', 'O'], a: 'iron', b: 'carbon', total: 28, reduction: 5, reflection: 0 },
    { elements: ['C', 'Fe'], a: 'graphite', b: 'iron', total: 26, reduction: 0, reflection: 3 },
    { elements: ['C', 'C', 'O', 'O'], a: 'graphite', b: 'carbon', total: 22, reduction: 5, reflection: 3 },
    { elements: ['C', 'O', 'O', 'C', 'O', 'O'], a: 'carbon', b: 'carbon', total: 24, reduction: 5, reflection: 0 },
    { elements: ['C', 'C'], a: 'graphite', b: 'graphite', total: 20, reduction: 0, reflection: 3 },
  ])('$a → $b 합계 $total, 특수 효과는 한 번만', ({ elements, a, b, total, reduction, reflection }) => {
    const s = fixture(elements as Element[]), first = cast(s, a as SpellId), n = cast(first, b as SpellId);
    expect(ward(n).frame?.playerShield).toBe(total);
    expect(ward(n).value).toBe(total - first.playerShield);
    const hit = n.events.find(e => e.kind === 'damage' && e.target === 'player')!;
    expect(hit.blocked).toBe(total); expect(hit.value).toBe(40 - reduction - total);
    expect(hit.frame?.playerShield).toBe(0); expect(n.playerShield).toBe(0);
    expect(n.enemy.hp).toBe(120 - reflection); expect(n.stats.enemyActions).toBe(1); expect(n.stats.casts).toBe(2); expect(n.turn).toBe(2);
  });
  it('Fe + 강화 방어를 더하며 중복 revision은 거절한다', () => {
    const s = cast(fixture(['Fe']), 'iron'); s.upgrades.guard = 11;
    const n = performAction(s, { type: 'guard' }, s.revision, rng);
    expect(ward(n).value).toBe(11); expect(ward(n).frame?.playerShield).toBe(27);
    expect(performAction(n, { type: 'guard' }, s.revision, rng)).toBe(n);
    expect(n.stats.enemyActions).toBe(1); expect(n.playerShield).toBe(0);
  });
  it('실제 방어 보상은 다음 전투의 보호막 증가량에 적용된다', () => {
    const s = fixture([]); s.screen = 'reward'; s.rewards = ['guard'];
    const next = chooseReward(s, 'guard', rng), n = performAction(next, { type: 'guard' }, next.revision, rng);
    expect(ward(n).value).toBe(11); expect(next.upgrades.guard).toBe(11);
  });
  it('흡수 후 남은 보호막도 대기/공격 행동 종료 시 사라진다', () => {
    for (const type of ['wait', 'attack'] as const) {
      const s = fixture(['Fe']); s.enemy.intent = { type, value: type === 'wait' ? 0 : 5, label: '검증' };
      const n = performAction(cast(s, 'iron'), { type: 'guard' }, 1, rng);
      if (type === 'attack') expect(n.events.find(e => e.kind === 'damage' && e.target === 'player')?.frame?.playerShield).toBe(19);
      expect(n.hp).toBe(60); expect(n.playerShield).toBe(0); expect(n.turnEffects.reflect).toBe(0);
    }
  });
});

describe('피해 예측과 위험 예고', () => {
  it.each(SPELLS)('$formula 예측이 방어/버프/디버프/강화/방어막을 반영한 실제 명중과 같다', spell => {
    for (const shield of [0, 6, 50]) for (const hp of [5, 120]) {
      const elements = Object.entries(spell.recipe).flatMap(([e, n]) => Array(n).fill(e) as Element[]);
      const s = fixture(elements); s.enemy.id = 'beetle'; s.enemy.hp = hp; s.enemy.shield = shield; s.enemy.acid = 1; s.enemy.wet = 1;
      s.boost = true; s.upgrades.waterDamage = 4; s.playerShield = 16;
      const before = structuredClone(s), ids = recipeIds(s.inventory, spell)!;
      const p = previewSpell(s, ids), actual = cast(s, spell.id);
      const hit = actual.events.find(e => e.kind === 'damage' && e.target === 'enemy');
      if (hit) { expect(p?.damage).toBe(hit.value); expect(p?.blocked).toBe(hit.blocked); }
      else if (spell.id !== 'oxygen') { expect(p?.shield).toBe(ward(actual).value); expect(p?.totalShield).toBe(ward(actual).frame?.playerShield); }
      else expect(p).toBeNull();
      expect(s).toEqual(before);
    }
  });
  it('젖음 NaCl은 15, 방어막 7이면 실제 HP 8과 방어막 7로 구분한다', () => {
    const s = fixture(['Na', 'Cl']); s.enemy.wet = 1;
    expect(previewSpell(s, [1, 2])).toMatchObject({ damage: 15, blocked: 0, combo: true });
    s.enemy.shield = 7; expect(previewSpell(s, [1, 2])).toMatchObject({ damage: 8, blocked: 7, combo: true });
  });
  it('HCl 자신의 명중에는 아직 부여하지 않은 부식을 적용하지 않는다', () => {
    const s = fixture(['H', 'Cl']); s.enemy.id = 'beetle';
    expect(previewSpell(s, [1, 2])?.damage).toBe(2);
  });
  it('일반 공격과 대기는 경고하지 않고 현재 예고된 강공격만 경고한다', () => {
    expect(isDangerous(ENEMIES.slime.pattern[0])).toBe(false);
    expect(isDangerous(ENEMIES.golem.pattern[1])).toBe(false);
    expect(isDangerous(ENEMIES.golem.pattern[2])).toBe(true);
    expect(isDangerous(ENEMIES.flame.pattern[2])).toBe(true);
    const s = fixture([]); s.enemy.intent = { ...ENEMIES.golem.pattern[2] };
    const n = performAction(s, { type: 'guard' }, s.revision, rng);
    expect(n.events.find(e => e.kind === 'enemy')?.value).toBe(24);
    expect(n.hp).toBe(44);
  });
});
