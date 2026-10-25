import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { ELEMENTS } from '../data/elements';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import { REWARDS } from '../data/rewards';
import { chooseReward, enemyArmor, newGame, performAction, simulateAction } from './engine';
import { matchRecipe } from './recipes';
import { drawElement, seededRng } from './random';
import { CODEX_KEY, loadDiscoveries, saveDiscoveries } from './codex';
import { recipeIds } from './suggestions';
import type { Action, Element, EnemyId, GameState, RewardId, SpellId } from './types';
const fixed = () => .1;
function fixture(elements: Element[] = [], id: EnemyId = 'slime') {
  const s = newGame(fixed);
  s.enemy = { id, hp: 200, shield: 0, wet: 0, acid: 0, dot: 0, phase: 1, intent: { type: 'wait', value: 0, label: '대기' }, patternIndex: 0 };
  s.inventory = elements.map((element, i) => ({ id: i + 1, element })); s.nextId = 100; s.freshIds = [];
  return s;
}
const act = (s: GameState, a: Action) => performAction(s, a, s.revision, fixed);
const cast = (s: GameState, id: SpellId) => act(s, { type: 'cast', ids: recipeIds(s.inventory, SPELL_BY_ID[id])! });
const end = (s: GameState) => act(s, { type: 'endTurn' });
function recipe(s: GameState, id: SpellId) {
  s.inventory = Object.entries(SPELL_BY_ID[id].recipe).flatMap(([element, n]) => Array.from({ length: n }, () => ({ id: s.nextId++, element: element as Element })));
  return s;
}

describe('원소와 화학식: 기존 판정 유지', () => {
  it('확률 합계와 경계값을 유지한다', () => {
    expect(Object.values(ELEMENTS).reduce((n, e) => n + e.probability, 0)).toBeCloseTo(1);
    expect([0, .299, .301, .559, .561, .741, .841, .941].map(n => drawElement(() => n))).toEqual(['H', 'H', 'O', 'O', 'C', 'Na', 'Cl', 'Fe']);
  });
  it('순서와 무관하게 정확한 다중집합만 판정한다', () => {
    expect(matchRecipe(['O', 'H', 'H'])?.id).toBe('water'); expect(matchRecipe(['H', 'O', 'H'])?.id).toBe('water');
    for (const elements of [[], ['H', 'O'], ['H', 'H', 'O', 'C']] as Element[][]) expect(matchRecipe(elements)).toBeUndefined();
  });
  it.each(SPELLS)('마법 $formula의 레시피를 유지하고 실제 시전 시 10 마력을 얻는다', spell => {
    const s = recipe(fixture(), spell.id), n = cast(s, spell.id);
    expect(n.stats.casts).toBe(1); expect(n.mana).toBe(10); expect(n.spellsUsed).toBe(1);
    expect(n.inventory).toHaveLength(0); expect(n.discoveries).toEqual([spell.id]); expect(n.turn).toBe(1);
  });
  it('잘못된 조합, 중복/없는 ID, 빈 선택은 상태를 변경하지 않는다', () => {
    const s = fixture(['H', 'O']);
    for (const ids of [[1, 2], [1, 1, 2], [999], []]) expect(act(s, { type: 'cast', ids })).toBe(s);
    expect(s.mana).toBe(0); expect(s.revision).toBe(0);
  });
  it('같은 seed는 같은 첫 전투와 원소를 만든다', () => { expect(newGame(seededRng(10))).toEqual(newGame(seededRng(10))); });
});

describe('즉시 시전과 턴 경계', () => {
  it('슬라임부터 시작하며 5개 안에 HHO를 보장하고 3개를 추가 지급하지 않는다', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = newGame(seededRng(seed));
      expect(s.route[0]).toBe('slime'); expect(s.inventory).toHaveLength(5); expect(s.upgrades.capacity).toBe(12);
      expect(recipeIds(s.inventory, SPELL_BY_ID.water)).toHaveLength(3);
      expect(new Set(s.route)).toEqual(new Set(['slime', 'beetle', 'flame', 'elite', 'golem']));
    }
  });
  it('첫 마법은 해당 원소만 소모하고 적 행동과 드로우 없이 두 번째 선택을 기다린다', () => {
    const s = fixture(['H', 'H', 'O', 'Na', 'Cl']); s.enemy.intent = { type: 'attack', value: 9, label: '공격' };
    const n = cast(s, 'water');
    expect(n.enemy.hp).toBe(187); expect(n.hp).toBe(60); expect(n.turn).toBe(1); expect(n.spellsUsed).toBe(1);
    expect(n.inventory).toEqual([{ id: 4, element: 'Na' }, { id: 5, element: 'Cl' }]);
    expect(n.events.some(e => e.kind === 'enemy' || e.kind === 'turn')).toBe(false);
    expect(s.inventory).toHaveLength(5); expect(s.enemy.hp).toBe(200);
  });
  it('두 번째 마법 뒤 적이 정확히 한 번 행동하고 3개 지급, 행동 횟수 초기화', () => {
    const s = fixture(['H', 'H', 'O', 'Na', 'Cl']); s.enemy.intent = { type: 'attack', value: 9, label: '공격' };
    const n = cast(cast(s, 'water'), 'salt');
    expect(n.enemy.hp).toBe(172); expect(n.hp).toBe(51); expect(n.turn).toBe(2); expect(n.spellsUsed).toBe(0);
    expect(n.inventory).toHaveLength(3); expect(n.stats.turns).toBe(1); expect(n.stats.casts).toBe(2);
    expect(n.events.filter(e => e.kind === 'enemy')).toHaveLength(1);
  });
  it('한 번 시전한 뒤 직접 턴 종료 가능하며 마력이 추가되지 않는다', () => {
    const s = cast(fixture(['H', 'H', 'O', 'C']), 'water'); const n = end(s);
    expect(n.turn).toBe(2); expect(n.inventory.some(t => t.id === 4)).toBe(true); expect(n.mana).toBe(10); expect(n.stats.turns).toBe(1);
  });
  it('마법을 만들 수 없으면 무료 보호막 없이 턴 종료로 진행한다', () => {
    const s = fixture(['Na']); s.enemy.intent = { type: 'attack', value: 9, label: '공격' };
    const n = act(s, { type: 'endTurn' }); expect(n.hp).toBe(51); expect(n.turn).toBe(2); expect(n.playerShield).toBe(0);
    n.enemy.intent = { type: 'attack', value: 9, label: '공격' }; expect(end(n).hp).toBe(42);
  });
  it('같은 revision을 사용한 빠른 중복 시전은 거절한다', () => {
    const s = fixture(['Fe', 'Fe']); const n = cast(s, 'iron');
    expect(performAction(n, { type: 'cast', ids: [2] }, s.revision, fixed)).toBe(n);
    expect(cast(n, 'iron').stats.casts).toBe(2);
  });
  it('기존 예약, 방출, 공격, 정제 명령은 런타임에서도 처리하지 않는다', () => {
    const s = fixture();
    for (const type of ['chain', 'release', 'attack', 'refine', 'guard']) expect(act(s, { type } as Action)).toBe(s);
  });
  it('연출 없는 시뮬레이션과 실제 엔진의 최종 상태가 일치한다', () => {
    const s = fixture(['H', 'H', 'O']); s.spellsUsed = 1;
    const action: Action = { type: 'cast', ids: [1, 2, 3] };
    const real = performAction(s, action, s.revision, seededRng(42)), sim = simulateAction(s, action, seededRng(42));
    expect({ ...real, events: [] }).toEqual({ ...sim, events: [] });
    expect(real.events.map(({ frame: _frame, ...e }) => e)).toEqual(sim.events);
  });
});

describe('보호막과 연계는 두 시전 사이에 유지된다', () => {
  it('CO₂를 먼저 쓰면 두 번째 마법 후 화염 감소와 보호막을 모두 적용한다', () => {
    const s = fixture(['C', 'O', 'O', 'H', 'H', 'O']); s.enemy.intent = { type: 'fire', value: 20, label: '화염' };
    const first = cast(s, 'carbon'); expect(first.playerShield).toBe(12); expect(first.hp).toBe(60);
    const next = cast(first, 'water'); expect(next.hp).toBe(57); expect(next.enemy.hp).toBe(187); expect(next.playerShield).toBe(0);
  });
  it('Fe와 CO₂는 보호막 28에 화염 경감 5를 유지한다', () => {
    const s = fixture(['Fe', 'C', 'O', 'O']); s.enemy.intent = { type: 'fire', value: 22, label: '화염' };
    const n = cast(cast(s, 'iron'), 'carbon'); expect(n.hp).toBe(60);
  });
  it('흑연 두 번은 보호막 20, 반사 3만 적용한다', () => {
    const s = fixture(['C', 'C'], 'beetle'); s.enemy.intent = { type: 'attack', value: 12, label: '공격' };
    const n = cast(cast(s, 'graphite'), 'graphite'); expect(n.hp).toBe(60); expect(n.enemy.hp).toBe(197);
  });
  it('턴 종료는 추가 보호막 없이 마법 보호막과 반사를 유지한다', () => {
    const s = fixture(['C']); s.enemy.intent = { type: 'attack', value: 12, label: '공격' };
    const n = act(cast(s, 'graphite'), { type: 'endTurn' }); expect(n.hp).toBe(58); expect(n.enemy.hp).toBe(197);
  });
  it('H₂O → NaCl은 COMBO +4, 역순에서는 추가 피해가 없다', () => {
    const s = fixture(['H', 'H', 'O', 'Na', 'Cl']);
    const forward = cast(cast(s, 'water'), 'salt'), reverse = cast(cast(s, 'salt'), 'water');
    expect(forward.enemy.hp).toBe(172); expect(reverse.enemy.hp).toBe(176);
    expect(forward.events.find(e => e.combo)?.combo).toBe(4);
  });
  it('O₂ → CH₄는 30 피해, 강화는 한 번만 소비하며 일반 마력 +20', () => {
    const s = fixture(['O', 'O', 'C', 'H', 'H', 'H', 'H']); const n = cast(cast(s, 'oxygen'), 'methane');
    expect(n.enemy.hp).toBe(170); expect(n.boost).toBe(false); expect(n.mana).toBe(20);
  });
  it('O₂는 중첩되지 않으며 턴 종료나 방어로 사라지지 않는다', () => {
    const n = cast(cast(fixture(['O', 'O', 'O', 'O']), 'oxygen'), 'oxygen'); expect(n.boost).toBe(true);
    const next = end(n); expect(next.boost).toBe(true); expect(next.enemy.hp).toBe(200);
  });
  it('HCl 자체는 기존 방어, 두 번째 공격은 감소한 방어를 사용한다', () => {
    const s = fixture(['H', 'Cl', 'Fe', 'O'], 'beetle'); const armor = ENEMIES.beetle.armor;
    const first = cast(s, 'acid'); expect(first.enemy.hp).toBe(200 - Math.max(0, 10 - armor)); expect(enemyArmor(first)).toBe(Math.max(0, armor - 3));
    const n = cast(first, 'ironOxide'); expect(n.enemy.hp).toBe(first.enemy.hp - (14 - Math.max(0, armor - 3))); expect(n.enemy.acid).toBe(2);
  });
  it('젖음/부식은 시전 사이에 감소하지 않고 이후 턴 종료 때만 감소한다', () => {
    let s = cast(cast(fixture(['H', 'H', 'O', 'H', 'Cl']), 'water'), 'acid');
    expect(s.enemy.wet).toBe(1); expect(s.enemy.acid).toBe(2);
    s = end(s); expect(s.enemy.wet).toBe(0); expect(s.enemy.acid).toBe(1);
    s = end(s); expect(s.enemy.acid).toBe(0);
  });
  it('과산화 수소의 첫 틱은 첫 시전 직후가 아니라 적 행동 직전에 적용한다', () => {
    const first = cast(fixture(['H', 'H', 'O', 'O']), 'peroxide'); expect(first.enemy.hp).toBe(192); expect(first.enemy.dot).toBe(2);
    const next = end(first); expect(next.enemy.hp).toBe(188); expect(next.enemy.dot).toBe(1);
    expect(end(next).enemy.hp).toBe(184);
  });
  it('적 보호막은 두 마법 사이에 유지되며 이미 흡수한 양만 줄어든다', () => {
    const s = fixture(['H', 'H', 'O', 'Fe', 'O']); s.enemy.shield = 20;
    const first = cast(s, 'water'); expect(first.enemy.shield).toBe(7); expect(first.enemy.hp).toBe(200);
    const n = cast(first, 'ironOxide'); expect(n.enemy.hp).toBe(193); expect(n.enemy.shield).toBe(0);
  });
  it('적 방어막은 남은 양이 있어도 다음 적 행동 직전에 만료된다', () => {
    const s = fixture(); s.enemy.shield = 40; expect(end(s).enemy.shield).toBe(0);
  });
});

describe('승패, 예고, 보상과 도감', () => {
  function won() { const s = recipe(fixture(), 'water'); s.enemy.hp = 1; s.hp = 30; return cast(s, 'water'); }
  it('첫 마법의 처치 즉시 승리하고 죽은 적은 반격하지 않는다', () => {
    const n = won(); expect(n.screen).toBe('reward'); expect(n.hp).toBe(45); expect(n.spellsUsed).toBe(1);
    expect(n.events.some(e => e.kind === 'enemy' || e.kind === 'turn')).toBe(false);
    expect(n.events.map(e => e.kind)).toEqual(['spell', 'damage', 'death', 'win']);
    expect(n.rewards).toHaveLength(3); expect(new Set(n.rewards).size).toBe(3);
  });
  it('지속 피해로 처치하면 적 공격 없이 승리한다', () => {
    const s = fixture([], 'beetle'); s.enemy.hp = 4; s.enemy.shield = 50; s.enemy.dot = 1;
    s.enemy.intent = { type: 'attack', value: 99, label: '강공격' };
    const n = end(s); expect(n.screen).toBe('reward'); expect(n.events.some(e => e.kind === 'enemy')).toBe(false);
  });
  it('치명적인 반사 동시 사망은 플레이어 패배를 우선한다', () => {
    const s = fixture(['C']); s.hp = 1; s.enemy.hp = 3; s.enemy.intent = { type: 'attack', value: 20, label: '공격' };
    const n = end(cast(s, 'graphite')); expect(n.screen).toBe('defeat'); expect(n.hp).toBe(0);
  });
  it('보스 문턱을 넘어도 첫 시전에서는 예고가 그대로이고 적 행동 후 다음 패턴이 바뀐다', () => {
    const s = fixture(['H', 'H', 'O'], 'golem'); s.enemy.hp = ENEMIES.golem.phaseThreshold! + 2; s.enemy.intent = { type: 'attack', value: 10, label: '공격' };
    const first = cast(s, 'water'); expect(first.enemy.phase).toBe(1); expect(first.enemy.intent.value).toBe(10);
    const n = end(first); expect(n.hp).toBe(50); expect(n.enemy.phase).toBe(2); expect(n.enemy.intent.value).toBe(ENEMIES.golem.phase2![0].value);
  });
  it('모든 적의 양 페이즈 예고가 실제 공격과 일치한다', () => {
    for (const id of Object.keys(ENEMIES) as EnemyId[]) for (const intent of [...ENEMIES[id].pattern, ...(ENEMIES[id].phase2 ?? [])]) {
      const s = fixture([], id); s.enemy.intent = { ...intent };
      const n = act(s, { type: 'endTurn' }); expect(n.hp).toBe(60 - (['attack', 'fire'].includes(intent.type) ? intent.value : 0));
      expect(n.events.filter(e => e.kind === 'enemy').map(e => e.value)).toEqual(intent.hits ? intent.hits.map(h => h.value) : [intent.value]);
    }
  });
  it.each(REWARDS)('호환 보상 $id가 적용되고 새로운 전투는 원소 5개로 시작한다', reward => {
    const s = won(); s.rewards = [reward.id]; s.mana = 60; const n = chooseReward(s, reward.id, fixed);
    if (reward.stat) expect(n.upgrades[reward.stat]).toBe(s.upgrades[reward.stat] + reward.amount);
    else expect(n.hp).toBe(60);
    expect(n.inventory).toHaveLength(5); expect(n.mana).toBe(60); expect(n.stage).toBe(1); expect(n.spellsUsed).toBe(0);
    expect(n.taken).toContain(reward.id); expect(n.enemy.acid + n.enemy.wet + n.enemy.dot).toBe(0);
  });
  it('없는 보상과 중복 선택은 거절하며 사용 불가능한 공격/정제 보상은 없다', () => {
    const s = won(); s.rewards = ['heal']; expect(chooseReward(s, 'bag', fixed)).toBe(s);
    const n = chooseReward(s, 'heal', fixed); expect(chooseReward(n, 'heal', fixed)).toBe(n);
    expect(REWARDS.map(r => r.id)).not.toContain('refine'); expect(REWARDS.map(r => r.id)).not.toContain('attack');
  });
  it('다섯 번 승리하면 클리어, 치명타면 게임오버, 새 모험은 초기화된다', () => {
    let s = newGame(fixed);
    for (let i = 0; i < 5; i++) {
      s.enemy.hp = 1; s.enemy.shield = 0; s = cast(recipe(s, 'salt'), 'salt');
      expect(s.screen).toBe(i === 4 ? 'victory' : 'reward');
      if (i < 4) s = chooseReward(s, s.rewards[0] as RewardId, fixed);
    }
    expect(s.stats.defeated).toBe(5);
    const lose = fixture(); lose.hp = 1; lose.enemy.intent = { type: 'attack', value: 20, label: '공격' };
    expect(end(lose).screen).toBe('defeat'); expect(newGame(fixed).mana).toBe(0); expect(newGame(fixed).hp).toBe(60);
  });
  it('공식 발견을 저장하되 모험 데이터는 저장하지 않고 잘못된 저장을 복구한다', () => {
    localStorage.clear(); expect(saveDiscoveries(['water', 'water'])).toBe(true); expect(loadDiscoveries()).toEqual(['water']);
    expect(localStorage.length).toBe(1); expect(JSON.parse(localStorage.getItem(CODEX_KEY)!)).toEqual(['water']);
    localStorage.setItem(CODEX_KEY, '{broken'); expect(loadDiscoveries()).toEqual([]);
    localStorage.setItem(CODEX_KEY, '["water","evil","water"]'); expect(loadDiscoveries()).toEqual(['water']);
    expect(saveDiscoveries(['water'], { setItem() { throw new Error('denied'); }, getItem() { return null; } })).toBe(false);
  });
});
