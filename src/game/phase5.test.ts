import { describe, expect, it } from 'vitest';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import { ENEMIES } from '../data/enemies';
import { ELEMENT_KEYS } from '../data/elements';
import { REACTION_IDS, availableReaction } from '../data/reactions';
import { SPRITES, PALETTE } from '../assets/sprites';
import { chooseReward, eligibleRewards, newGame, performAction } from './engine';
import { adjustedIntent } from './incoming';
import { isDangerous } from './danger';
import { previewSpell } from './preview';
import { matchRecipe } from './recipes';
import { recipeIds } from './suggestions';
import { drawElement, elementProbabilities, seededRng } from './random';
import { CODEX_KEY, REACTIONS_KEY, loadDiscoveries, loadReactions, saveReactions } from './codex';
import { battleSequence } from '../presentation/sequence';
import type { Action, Element, EnemyId, GameState, SpellId } from './types';
const rng = () => .5;
function state(spells: SpellId[] = [], enemy: EnemyId = 'slime') {
  const s = newGame(rng); s.enemy.id = enemy; s.enemy.hp = 200; s.enemy.intent = { type: 'attack', value: 12, label: '공격' };
  s.inventory = spells.flatMap(id => Object.entries(SPELL_BY_ID[id].recipe).flatMap(([e, count]) => Array.from({ length: count }, () => ({ id: s.nextId++, element: e as Element })))); return s;
}
const act = (s: GameState, a: Action) => performAction(s, a, s.revision, rng);
const cast = (s: GameState, id: SpellId) => act(s, { type: 'cast', ids: recipeIds(s.inventory, SPELL_BY_ID[id])! });
const hit = (s: GameState) => s.events.find(e => e.cue === 'impact' && e.target === 'enemy')!;
describe('신규 마법', () => {
  it.each(['hydrogen','alkali','ferrous'] as SpellId[])('%s는 원소 순서와 무관하고 정확히 필요한 원소만 소모한다', id => {
    const s = state([id, 'iron']); const ids = recipeIds(s.inventory, SPELL_BY_ID[id])!;
    expect(matchRecipe([...ids].reverse().map(i => s.inventory.find(t => t.id === i)!.element))?.id).toBe(id);
    const n = cast(s, id); expect(n.inventory).toEqual(s.inventory.filter(t => !ids.includes(t.id))); expect(n.spellsUsed).toBe(1); expect(n.mana).toBe(10);
  });
  it.each(['hydrogen','alkali'] as const)('%s 보호막 전용 피해는 먼저 적용하고 HP로 넘치지 않는다', id => {
    const base = id === 'hydrogen' ? 7 : 9, extra = id === 'hydrogen' ? 4 : 5;
    for (const shield of [0, 2, extra, extra + 3, 50]) {
      const s = state([id], 'beetle'); s.enemy.shield = shield; const n = cast(s, id);
      const absorbedBonus = Math.min(shield, extra), afterShield = shield - absorbedBonus;
      expect(hit(n)).toMatchObject({ value: Math.max(0, base - 5 - afterShield), blocked: absorbedBonus + Math.min(afterShield, base - 5), shieldBonusDamage: absorbedBonus });
      expect(previewSpell(s, recipeIds(s.inventory, SPELL_BY_ID[id])!)?.damage).toBe(hit(n).value);
    }
  });
  it('FeCl₂는 금속 상성과 다음 행동의 각 타격 약화3, 중첩 대신 갱신을 적용한다', () => {
    const s = state(['ferrous', 'ferrous'], 'minion'); s.enemy.intent = ENEMIES.elite.pattern[2];
    const first = cast(s, 'ferrous'); expect(hit(first).value).toBe(25); expect(first.enemy.weaken).toBe(1);
    const predicted = adjustedIntent(first.enemy.intent, first.enemy.weaken);
    expect(predicted.hits?.map(h => h.value)).toEqual([4,4,4]);
    const second = cast(first, 'ferrous'); expect(second.events.filter(e => e.kind === 'enemy').map(e => e.value)).toEqual([4,4,4]);
    expect(second.hp).toBe(48); expect(second.enemy.weaken).toBe(0); expect(second.turn).toBe(2);
  });
  it('약화는 충전에도 만료되고 전투 종료 시 제거된다', () => {
    const s = state(['ferrous']); s.enemy.intent = { type: 'charge', value: 0, label: '충전' };
    expect(act(cast(s, 'ferrous'), { type: 'endTurn' }).enemy.weaken).toBe(0);
    s.enemy.hp = 1; expect(cast(s, 'ferrous').enemy.weaken).toBe(0);
  });
});
describe('반응은 실제 시전에만, 중복 없이', () => {
  it('같은 5원소 손패에서 중화는 피해24+방어6, 젖음 결정은 피해28로 서로 다른 장점이 있다', () => {
    const s = state(['acid','alkali']);
    const neutral = cast(cast(s,'acid'),'alkali'), crystal = cast(cast(s,'water'),'salt');
    expect(200-neutral.enemy.hp).toBe(24); expect(200-crystal.enemy.hp).toBe(28);
    expect(neutral.hp).toBe(54); expect(crystal.hp).toBe(48);
    expect(neutral.inventory).toHaveLength(3); expect(crystal.inventory).toHaveLength(3);
  });
  it('같은 턴 HCl→NaOH는 기본7+9, 중립8, 보호막6이고 적이 한 번 행동한다', () => {
    const s = state(['acid','alkali']); const first = cast(s, 'acid');
    expect(availableReaction(first, 'alkali')).toBe('neutralization');
    const p = previewSpell(first, recipeIds(first.inventory, SPELL_BY_ID.alkali)!); expect(p).toMatchObject({ damage: 17, reactionShield: 6 });
    const before = structuredClone(first), n = cast(first, 'alkali');
    expect(n.enemy.hp).toBe(176); expect(n.hp).toBe(54); expect(n.spellsUsed).toBe(0); expect(n.turn).toBe(2);
    expect(n.events.filter(e => e.kind === 'reaction')).toHaveLength(1);
    expect(n.events.filter(e => e.kind === 'shield').map(e => e.value)).toEqual([6]);
    expect(n.stats.enemyActions).toBe(1); expect(n.reactionDiscoveries).toEqual(['neutralization']);
    expect(first).toEqual(before); expect(n.castHistory).toEqual([]);
    expect(performAction(n, { type: 'cast', ids: [1,2,3] }, first.revision, rng)).toBe(n);
    expect(battleSequence(n, false).events.filter(e => e.kind === 'turn-banner').map(e => e.target)).toEqual(['enemy','player']);
  });
  it('역순·다음 턴·미시전 발견만으로는 중화가 발동하지 않는다', () => {
    expect(cast(cast(state(['alkali','acid']), 'alkali'), 'acid').reactionDiscoveries).toEqual([]);
    const first = act(cast(state(['acid','alkali']), 'acid'), { type: 'endTurn' });
    expect(cast(first, 'alkali').events.some(e => e.kind === 'reaction')).toBe(false);
    const selected = state(['alkali']); selected.discoveries = ['acid']; expect(cast(selected, 'alkali').reactionDiscoveries).toEqual([]);
  });
  it('중화 추가 피해는 강화 후 현재 방어력과 보호막을 적용하며 예상 총 HP 피해와 일치한다', () => {
    const s = state(['acid','alkali'], 'beetle'); s.upgrades.reactionBonus = 6; s.upgrades.shieldBonus = 9;
    const first = cast(s, 'acid'); first.enemy.shield = 20;
    const p = previewSpell(first, recipeIds(first.inventory, SPELL_BY_ID.alkali)!); // shield bonus5, base7, reaction12 -> HP4
    expect(p).toMatchObject({ damage: 4, blocked: 20, reactionShield: 6 });
    const n = cast(first, 'alkali'); expect(first.enemy.hp - n.enemy.hp).toBe(4); expect(n.events.find(e => e.kind === 'shield')?.value).toBe(6);
  });
  it('연소 강화는 기존 +10을 한 번만 적용하며 결정 연계도 기존 +4와 젖음 소비를 유지한다', () => {
    const fire = cast(cast(state(['oxygen','methane']), 'oxygen'), 'methane');
    expect(hit(fire).value).toBe(33); expect(fire.boost).toBe(false); expect(fire.reactionDiscoveries).toEqual(['combustion']);
    const water = cast(state(['water','salt']), 'water'), salt = cast(water, 'salt');
    expect(hit(salt).value).toBe(15); expect(salt.enemy.wet).toBe(0); expect(salt.reactionDiscoveries).toEqual(['crystallization']);
    expect(fire.events.filter(e => e.kind === 'reaction')).toHaveLength(1);
      expect(fire.events.find(e => e.kind === 'reaction')?.frame?.boost).toBe(false);
      expect(salt.events.find(e => e.kind === 'reaction')?.frame?.enemy.wet).toBe(0);
  });
  it('처치 시 중화는 보상으로 이동하고 ZERO는 반응을 만들지 않는다', () => {
    const first = cast(state(['acid','alkali']), 'acid'); first.enemy.hp = 10;
    const n = cast(first,'alkali'); expect(n.screen).toBe('reward'); expect(n.stats.enemyActions).toBe(0); expect(n.playerShield).toBe(0);
    const zero = state(['acid']); zero.mana = 100; expect(act(cast(zero,'acid'), {type:'burst'}).reactionDiscoveries).toEqual([]);
  });
});
describe('새 적과 무작위 모험', () => {
  it('첫 모험은 슬라임, 이후는 서로 다른 일반3종 + 정예 + 보스이며 모든 일반 적이 첫 칸에도 등장한다', () => {
    const firsts = new Set();
    for(let seed=1;seed<=200;seed++) {
      expect(newGame(seededRng(seed)).route[0]).toBe('slime');
      const s = newGame(seededRng(seed),{firstAdventure:false}); firsts.add(s.route[0]);
      expect(s.route).toHaveLength(5); expect(new Set(s.route).size).toBe(5); expect(s.route[3]).toBe('elite'); expect(['golem','inferno','warden']).toContain(s.route[4]);
    }
    expect(firsts).toEqual(new Set(['slime','beetle','flame','minion','gel']));
  });
  it('신규 적의 수치·패턴·픽셀 스프라이트를 유지한다', () => {
    expect(ENEMIES.minion).toMatchObject({ hp:36, armor:2, affinity:'CRYSTAL' });
    expect(ENEMIES.minion.pattern.map(p=>[p.type,p.value])).toEqual([['attack',8],['shield',8],['attack',8]]);
    expect(ENEMIES.gel).toMatchObject({ hp:40, armor:0, affinity:'CORROSION' });
    for (const id of ['minion','gel']) { expect(new Set(SPRITES[id].map(r=>r.length)).size).toBe(1); for(const pixel of SPRITES[id].join('')) expect(PALETTE[pixel]).toBeDefined(); }
  });
  it('젤 취약은 직접7 이후 부여, 충전 중 유지, 강화14에 +3 후 소멸한다', () => {
    let s = state([], 'gel'); s.enemy.intent = ENEMIES.gel.pattern[1]; s.enemy.patternIndex = 1;
    s = act(s,{type:'endTurn'}); expect(s.hp).toBe(53); expect(s.vulnerable).toBe(true);
    s = act(s,{type:'endTurn'}); expect(s.hp).toBe(53); expect(s.vulnerable).toBe(true);
    expect(adjustedIntent(s.enemy.intent,0,s.vulnerable).value).toBe(17);
    expect(isDangerous(adjustedIntent(s.enemy.intent,0,s.vulnerable))).toBe(true);
    expect(isDangerous(ENEMIES.gel.pattern[0])).toBe(false);
    expect(isDangerous(ENEMIES.gel.pattern[2])).toBe(false);
    s.playerShield = 12; s = act(s,{type:'endTurn'}); expect(s.hp).toBe(48); expect(s.vulnerable).toBe(false);
  });
  it('취약 재부여는 +3으로 유지하며 약화와 보호막보다 먼저 합산한다', () => {
    const s = state([], 'gel'); s.vulnerable=true; s.enemy.weaken=1; s.playerShield=4; s.enemy.intent=ENEMIES.gel.pattern[1];
    const n=act(s,{type:'endTurn'}); expect(n.hp).toBe(57); expect(n.vulnerable).toBe(true); expect(n.enemy.weaken).toBe(0);
  });
});
describe('보상과 발견 저장', () => {
  it('반응 증폭은 두 번까지 +6이며 한도 도달 보상은 제시·수락하지 않는다', () => {
    let s=state(); for(let i=0;i<2;i++){s.screen='reward';s.rewards=['reaction'];s=chooseReward(s,'reaction',rng);}
    expect(s.upgrades.reactionBonus).toBe(6); expect(eligibleRewards(s)).not.toContain('reaction');
    s.screen='reward';s.rewards=['reaction'];expect(chooseReward(s,'reaction',rng)).toBe(s);
  });
  it('원소 공명은 선택을 요구하고 1.5→2배 상한, 전체 확률 재정규화, 새 모험 초기화', () => {
    let s=state();s.screen='reward';s.rewards=['resonance'];expect(chooseReward(s,'resonance',rng)).toBe(s);
    for(let i=0;i<2;i++){s.screen='reward';s.rewards=['resonance'];s=chooseReward(s,'resonance',rng,'H');}
    expect(s.upgrades.resonance.H).toBe(2); const probs=elementProbabilities(s.upgrades.resonance);
    expect(Object.values(probs).reduce((a,b)=>a+b,0)).toBeCloseTo(1); expect(probs.H).toBeCloseTo(.58/1.29);
    s.screen='reward';s.rewards=['resonance'];expect(chooseReward(s,'resonance',rng,'H')).toBe(s);
    expect(newGame(rng).upgrades.resonance).toEqual({});
    let cumulative=0;for(const e of ELEMENT_KEYS){expect(drawElement(()=>cumulative + probs[e]/2,s.upgrades.resonance)).toBe(e);cumulative+=probs[e];}
  });
  it('연구는 시전 발견과 반응 성공을 합쳐 전투당 한 번, 알려진 기록에는 미지급', () => {
    let s=state(['acid','alkali']); s.upgrades.research=true;
    s=cast(s,'acid'); expect(s.mana).toBe(30); expect(s.researchTriggered).toBe(true); expect(s.spellsUsed).toBe(1);
    s=cast(s,'alkali'); expect(s.mana).toBe(40); expect(s.reactionDiscoveries).toEqual(['neutralization']);
    s.screen='reward';s.rewards=['water'];s=chooseReward(s,'water',rng);expect(s.researchTriggered).toBe(false);
    s.inventory=[{id:1000,element:'H'},{id:1001,element:'Cl'},{id:1002,element:'Fe'}];
    s=cast(s,'acid');expect(s.mana).toBe(50);expect(s.researchTriggered).toBe(false);
    s=cast(s,'iron');expect(s.mana).toBe(80);expect(s.researchTriggered).toBe(true);
  });
  it('이미 알려진 마법 두 개도 새로운 반응 성공으로 연구 마력20을 한 번 받는다', () => {
    const s=state(['acid','alkali']);s.discoveries=['acid','alkali'];s.upgrades.research=true;
    const n=cast(cast(s,'acid'),'alkali'); expect(n.mana).toBe(40);expect(n.events.filter(e=>e.text.startsWith('화학 연구'))).toHaveLength(1);
  });
  it('기존 마법 저장은 보존하고 반응은 독립 키로 중복 제거, 잘못된 값 필터', () => {
    const values=new Map([[CODEX_KEY,JSON.stringify(['water','iron','methane'])]]);
    const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};
    expect(loadDiscoveries(storage)).toEqual(['water','iron','methane']);expect(saveReactions([...REACTION_IDS,'combustion'],storage)).toBe(true);
    expect(loadReactions(storage)).toEqual(REACTION_IDS);expect(values.get(CODEX_KEY)).toBe('["water","iron","methane"]');
    values.set(REACTIONS_KEY,'["bogus","combustion"]');expect(loadReactions(storage)).toEqual(['combustion']);
    expect(saveReactions([], {getItem:()=>null,setItem:()=>{throw Error('blocked');}})).toBe(false);
  });
  it('19개 레시피는 유일하고 상태를 변경하지 않는 예상 피해 계산을 제공한다', () => {
    expect(SPELLS).toHaveLength(19);expect(new Set(SPELLS.map(s=>s.formula)).size).toBe(19);
    const s=state(['acid','alkali']);const before=structuredClone(s);expect(previewSpell(s,[999])).toBeNull();expect(s).toEqual(before);
  });
});
