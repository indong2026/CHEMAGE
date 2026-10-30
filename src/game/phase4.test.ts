import { describe, expect, it } from 'vitest';
import { AFFINITIES, multiplier } from '../data/affinities';
import { ENEMIES } from '../data/enemies';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import { battleSequence } from '../presentation/sequence';
import { chooseReward, newGame, performAction } from './engine';
import { previewSpell } from './preview';
import { recipeIds } from './suggestions';
import { directHits } from './incoming';
import { chooseAction } from '../test/strategy';
import { matchRecipe } from './recipes';
import type { Action, Affinity, EnemyId, GameState, SpellId } from './types';
const rng = () => .5;
function fixture(id: EnemyId, spell: SpellId) {
  const s = newGame(rng); s.enemy.id = id; s.enemy.hp = 200; s.enemy.intent = { type: 'wait', value: 0, label: '대기' };
  s.inventory = Object.entries(SPELL_BY_ID[spell].recipe).flatMap(([element, count]) => Array.from({ length: count }, () => ({ id: s.nextId++, element: element as GameState['inventory'][number]['element'] })));
  return s;
}
const act = (s: GameState, a: Action) => performAction(s, a, s.revision, rng);
const cast = (s: GameState, spell: SpellId) => act(s, { type: 'cast', ids: recipeIds(s.inventory, SPELL_BY_ID[spell])! });
const hit = (s: GameState) => s.events.find(e => e.kind === 'damage' && e.target === 'enemy')!;

describe('속성과 직접 피해', () => {
  it('같은 손패의 마지막 시전에서 상성을 고려하면 화염 적에게 CH4 대신 더 강한 H2O를 고른다', () => {
    const s = fixture('flame', 'water'); s.spellsUsed = 1;
    s.inventory = ['H', 'H', 'H', 'H', 'H', 'H', 'O', 'C'].map((element, id) => ({ id, element: element as GameState['inventory'][number]['element'] }));
    const attack = chooseAction(s, 'attack'), affinity = chooseAction(s, 'affinity');
    const selected = (a: Action) => a.type === 'cast' ? matchRecipe(a.ids.map(id => s.inventory.find(t => t.id === id)!.element))?.id : a.type;
    expect(selected(attack)).toBe('methane'); expect(selected(affinity)).toBe('water');
    expect(hit(act(s, affinity)).value).toBe(19); expect(hit(act(s, attack)).value).toBe(17);
  });
  it.each([
    ['water', 'flame', 19, 1.5], ['acid', 'beetle', 5, 1.5], ['ironOxide', 'golem', 21, 1.5],
    ['water', 'golem', 9, .75], ['methane', 'flame', 17, .75], ['salt', 'beetle', 8, .75],
    ['water', 'slime', 13, 1], ['peroxide', 'golem', 8, 1],
  ] as const)('%s → %s는 실제 HP 피해 %s, 배율 %s', (spell, enemy, damage, scale) => {
    const s = fixture(enemy, spell), n = cast(s, spell);
    expect(hit(n)).toMatchObject({ value: damage, multiplier: scale }); expect(n.enemy.hp).toBe(200 - damage);
    expect(previewSpell(s, recipeIds(s.inventory, SPELL_BY_ID[spell])!)).toMatchObject({ damage, multiplier: scale });
  });
  it('명시한 6개 관계 외에는 모든 상성 조합이 중립이다', () => {
    const defined = ['WATER/FIRE','CORROSION/METAL','METAL/CRYSTAL','FIRE/FIRE','CRYSTAL/METAL','WATER/CRYSTAL'];
    for (const a of Object.keys(AFFINITIES) as Affinity[]) for (const b of Object.keys(AFFINITIES) as Affinity[]) if (!defined.includes(`${a}/${b}`)) expect(multiplier(a, b)).toBe(1);
  });
  it('강화 +4, 공격 강화 +10 후 상성 버림, 적 보호막 8 이후 HP 피해 32', () => {
    const s = fixture('flame', 'water'); s.boost = true; s.upgrades.waterDamage = 4; s.enemy.shield = 8;
    const n = cast(s, 'water'); // floor((13 + 4 + 10) * 1.5) = 40
    expect(hit(n)).toMatchObject({ value: 32, blocked: 8, shieldBreak: true }); expect(n.boost).toBe(false);
  });
  it('젖음 연계도 저항 적용 전 합산하고 NaCl 관통은 실제 방어력을 바꾸지 않는다', () => {
    const s = fixture('beetle', 'salt'); s.enemy.wet = 1; s.enemy.shield = 5;
    expect(hit(cast(s, 'salt'))).toMatchObject({ value: 6, blocked: 5, combo: 4 });
    expect(ENEMIES.beetle.armor).toBe(5);
  });
  it('HCl 명중은 기존 방어력, 이후 공격은 감소된 방어력이며 변화 프레임도 일치한다', () => {
    const s = fixture('beetle', 'acid'); const n = cast(s, 'acid');
    expect(hit(n)).toMatchObject({ value: 5, armorBefore: 5, armorAfter: 2 });
    n.inventory = [{ id: 100, element: 'H' }, { id: 101, element: 'Cl' }];
    expect(hit(cast(n, 'acid'))).toMatchObject({ value: 8, armorBefore: 2, armorAfter: 2 });
  });
  it.each(Object.keys(ENEMIES) as EnemyId[])('%s에서 ZERO 30, 지속 4, 반사 3에는 상성 미적용', enemy => {
    const s = fixture(enemy, 'graphite'); s.mana = 100;
    expect(hit(act(s, { type: 'burst' })).value).toBe(30);
    s.enemy.dot = 1; s.enemy.intent = { type: 'attack', value: 1, label: '공격' };
    const n = act(cast(s, 'graphite'), { type: 'endTurn' });
    expect(n.events.find(e => e.effect === 'dot')?.value).toBe(4);
    expect(n.events.find(e => e.effect === 'reflect')?.value).toBe(3);
  });
  it.each(SPELLS)('$formula 모든 적·방어막·강화·상태 조합에서 예상치와 실제 명중 일치', spell => {
    for (const enemy of Object.keys(ENEMIES) as EnemyId[]) for (const shield of [0, 8, 50]) {
      const s = fixture(enemy, spell.id); s.enemy.shield = shield; s.enemy.acid = 1; s.enemy.wet = 1; s.boost = true; s.upgrades.waterDamage = 4; s.upgrades.shieldBonus = 6;
      const before = structuredClone(s), p = previewSpell(s, recipeIds(s.inventory, spell)!);
      const n = cast(s, spell.id);
      if (spell.attack) expect(p).toMatchObject({ damage: hit(n).value, blocked: hit(n).blocked, multiplier: hit(n).multiplier });
      else if (spell.id !== 'oxygen') expect(p?.shield).toBe(n.events.find(e => e.kind === 'shield')?.value);
      else expect(p).toBeNull();
      expect(s).toEqual(before);
    }
  });
});
describe('무료 방어 제거 및 패턴', () => {
  it('턴 종료는 무료 보호막/회복/원소 소모 없이 진행하고 구 guard 명령은 거절한다', () => {
    const s = fixture('slime', 'iron'); s.hp = 40;
    expect(performAction(s, { type: 'guard' } as unknown as Action, s.revision, rng)).toBe(s);
    const n = act(s, { type: 'endTurn' }); expect(n.hp).toBe(40); expect(n.inventory[0]).toEqual(s.inventory[0]);
    expect(n.events.some(e => e.kind === 'shield')).toBe(false); expect(n.turn).toBe(2);
  });
  it('강화 보상 두 번은 모든 방어 마법에 +6, 중첩마다 반영된다', () => {
    let s = newGame(rng);
    for (let i = 0; i < 2; i++) { s.screen = 'reward'; s.rewards = ['guard']; s = chooseReward(s, 'guard', rng); }
    expect(s.upgrades.shieldBonus).toBe(6);
    for (const [spell, base] of [['iron', 16], ['carbon', 12], ['graphite', 10]] as const) {
      const state = fixture('slime', spell); state.upgrades = { ...s.upgrades };
      const first = cast(state, spell); expect(first.playerShield).toBe(base + 6);
      first.inventory = fixture('slime', spell).inventory;
      const second = cast(first, spell); expect(second.events.find(e => e.kind === 'shield')?.frame?.playerShield).toBe((base + 6) * 2);
    }
  });
  it('실제 모든 적 패턴의 타격 횟수·순서·피해와 예고가 일치하고 적 턴은 한 번이다', () => {
    for (const enemy of Object.keys(ENEMIES) as EnemyId[]) for (const intent of [...ENEMIES[enemy].pattern, ...(ENEMIES[enemy].phase2 ?? [])]) {
      const s = fixture(enemy, 'iron'); s.enemy.intent = structuredClone(intent); s.playerShield = 24;
      const n = act(s, { type: 'endTurn' }); const hits = directHits(intent);
      const launches = n.events.filter(e => e.kind === 'enemy');
      if (hits.length) expect(launches.map(e => e.value)).toEqual(hits.map(h => h.value));
      expect(n.stats.enemyActions).toBe(1); expect(n.turn).toBe(2); expect(n.playerShield).toBe(0);
      expect(battleSequence(n, false).events.filter(e => e.kind === 'turn-banner').map(e => e.target)).toEqual(['enemy','player']);
    }
  });
  it('새 연속 공격과 충전 강공격의 수치를 유지한다', () => {
    expect(ENEMIES.beetle.pattern.find(i => i.hits)?.hits?.map(h => h.value)).toEqual([6, 6]);
    expect(ENEMIES.elite.pattern.find(i => i.hits)?.hits?.map(h => h.value)).toEqual([7, 7, 7]);
    expect(ENEMIES.golem.phase2?.find(i => i.hits)?.hits?.map(h => h.value)).toEqual([10, 10]);
    for (const [pattern, value] of [[ENEMIES.flame.pattern, 20], [ENEMIES.golem.phase2!, 28]] as const) {
      const index = pattern.findIndex(i => i.value === value); expect(pattern[index - 1].type).toBe('charge');
    }
  });
});
