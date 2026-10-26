import { describe, expect, it } from 'vitest';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import { ELEMENT_KEYS } from '../data/elements';
import { REACTION_HINTS, SPELL_CLUES, spellHints } from '../data/hints';
import { discoverableSpell, emptyHints, HINTS_KEY, hintLevel, loadHints, revealHint, saveHints } from './hints';
import { CODEX_KEY, REACTIONS_KEY, loadDiscoveries, loadReactions } from './codex';
import { chooseReward, newGame, performAction } from './engine';
import { elementProbabilities } from './random';
import { recipeIds } from './suggestions';
import type { Element, GameState, SpellId } from './types';

const fixture = (ids: SpellId[]) => {
  const s = newGame(() => .5); s.enemy.hp = 200;
  s.inventory = ids.flatMap(id => Object.entries(SPELL_BY_ID[id].recipe).flatMap(([element,n]) => Array.from({length:n},()=>({id:s.nextId++,element:element as Element}))));
  return s;
};
const cast = (s: GameState, id: SpellId) => performAction(s, {type:'cast',ids:recipeIds(s.inventory,SPELL_BY_ID[id])!},s.revision,()=>.5);
const end = (s: GameState) => performAction(s,{type:'endTurn'},s.revision,()=>.5);
const reward = (stage = 0) => { const s = newGame(() => .5); s.screen='reward';s.stage=stage;s.rewards=['resonance','water'];return s; };

describe('연구 힌트 데이터와 독립 저장', () => {
  it.each([
    ['water',3,'수소 2개와 산소 1개'],['salt',2,'나트륨 1개와 염소 1개'],['carbon',3,'탄소 1개와 산소 2개'],
    ['iron',1,'철 1개'],['oxygen',2,'산소 2개'],['acid',2,'수소 1개와 염소 1개'],['peroxide',4,'수소 2개와 산소 2개'],
    ['graphite',1,'탄소 1개'],['methane',5,'탄소 1개와 수소 4개'],['ironOxide',2,'철 1개와 산소 1개'],
    ['hydrogen',2,'수소 2개'],['alkali',3,'나트륨 1개와 산소 1개와 수소 1개'],['ferrous',3,'철 1개와 염소 2개'],
  ] as [SpellId,number,string][])('%s의 힌트는 실제 물질과 정확한 게임 레시피를 안내한다', (id,n,answer) => {
    const hints=spellHints(id);expect(hints).toHaveLength(3);expect(hints[0]).toBe(SPELL_CLUES[id]);expect(hints[1]).toContain(`총 ${n}개`);expect(hints[2]).toContain(answer);
    expect(hints[0]).not.toContain(SPELL_BY_ID[id].name);
  });
  it('19종에 누락이 없고 화학 명칭과 수용액 구분을 유지한다', () => {
    expect(Object.keys(SPELL_CLUES)).toHaveLength(19);
    expect(SPELL_CLUES.acid).toContain('물에 녹은 수용액');expect(SPELL_CLUES.ferrous).toContain('염화 철(II)');expect(SPELL_CLUES.ironOxide).toContain('산화 철(II)');
  });
  it('각 항목은 0→1→2→3 순서로 공개되고 상한·다른 항목·전투를 보존한다', () => {
    const s=fixture(['water']);const before=structuredClone(s);let hints=emptyHints();
    for(const n of [1,2,3,3]) { hints=revealHint(hints,{kind:'magic',id:'water'});expect(hints.magic.water).toBe(n); }
    expect(hintLevel(hints,{kind:'reaction',id:'neutralization'})).toBe(0);expect(hints.magic.iron).toBeUndefined();expect(s).toEqual(before);
    expect(s.discoveries).toEqual([]);expect(s.reactionDiscoveries).toEqual([]);
  });
  it('힌트만 별도 키에 저장·복구하며 기존 발견 기록을 보존한다', () => {
    const data = new Map([[CODEX_KEY,'["water","iron"]'],[REACTIONS_KEY,'["combustion"]']]);
    const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}};
    let hints=revealHint(emptyHints(),{kind:'magic',id:'ferrous'});hints=revealHint(hints,{kind:'reaction',id:'neutralization'});
    expect(saveHints(hints,storage)).toBe(true);expect(loadHints(storage)).toEqual(hints);expect(loadDiscoveries(storage)).toEqual(['water','iron']);expect(loadReactions(storage)).toEqual(['combustion']);
    data.set(HINTS_KEY,JSON.stringify({magic:{water:3,iron:4,acid:-1,alkali:'2',oxygen:1.5,unknown:3},reaction:{combustion:2,crystallization:null}}));
    expect(loadHints(storage)).toEqual({magic:{water:3},reaction:{combustion:2}});
    for(const bad of ['null','[]','"text"','{broken','{}','{"magic":[]}']) {data.set(HINTS_KEY,bad);expect(loadHints(storage)).toEqual(emptyHints());}
    const blocked={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
    expect(loadHints(blocked)).toEqual(emptyHints());expect(saveHints(hints,blocked)).toBe(false);
  });
  it('수량을 정확히 검사하고 미발견·최소 공개 항목 하나만 추천한다', () => {
    const s=fixture(['water','iron']);let hints=emptyHints();
    expect(discoverableSpell(s.inventory,[],hints)?.id).toBe('water');
    hints=revealHint(hints,{kind:'magic',id:'water'});expect(discoverableSpell(s.inventory,[],hints)?.id).toBe('iron');
    expect(discoverableSpell([{id:1,element:'H'},{id:2,element:'O'}],[],hints)).toBeUndefined();
    expect(discoverableSpell(s.inventory,SPELLS.map(s=>s.id),hints)).toBeUndefined();
    expect(discoverableSpell([],[],hints)).toBeUndefined();
  });
  it('힌트 순서대로 중화 시전해야 성공하며 발견 목록만으로는 발동하지 않는다', () => {
    expect(REACTION_HINTS.neutralization.order).toContain('같은 플레이어 턴');
    const s=fixture(['acid','alkali']);expect(cast(cast(s,'acid'),'alkali').reactionDiscoveries).toContain('neutralization');
    expect(cast(cast(fixture(['acid','alkali']),'alkali'),'acid').reactionDiscoveries).toEqual([]);
    expect(cast(end(cast(s,'acid')),'alkali').reactionDiscoveries).toEqual([]);
  });
  it('연소 힌트는 턴을 넘어 유지되는 강화와 다른 공격의 강화 소비에 일치한다', () => {
    expect(REACTION_HINTS.combustion.order).toContain('다음 턴');
    let s=end(cast(fixture(['oxygen','methane']),'oxygen'));expect(cast(s,'methane').reactionDiscoveries).toContain('combustion');
    s=cast(cast(fixture(['oxygen','hydrogen','methane']),'oxygen'),'hydrogen');expect(cast(s,'methane').reactionDiscoveries).not.toContain('combustion');
  });
  it('결정 힌트는 같은 턴·다음 턴 젖음과 이후 만료 및 소비에 일치한다', () => {
    expect(REACTION_HINTS.crystallization.principle).toContain('판타지');expect(REACTION_HINTS.crystallization.order).toContain('바로 다음');
    const s=cast(fixture(['water','salt']),'water');expect(cast(end(s),'salt').reactionDiscoveries).toContain('crystallization');
    expect(cast(end(end(s)),'salt').reactionDiscoveries).not.toContain('crystallization');
    expect(cast(s,'salt').enemy.wet).toBe(0);
  });
});

describe('원소 공명의 일회성 시작 손패', () => {
  it.each(ELEMENT_KEYS)('%s 공명은 2개 확정 + 무작위 3개, 예약 소비, 지속 가중치를 제공한다', element => {
    const s=reward();const before=structuredClone(s);let draws=0;
    const next=chooseReward(s,'resonance',()=>{draws++;return 0;},element);
    expect(draws).toBe(3);expect(next.inventory).toHaveLength(5);expect(next.inventory.slice(0,2).map(t=>t.element)).toEqual([element,element]);
    expect(next.pendingResonance).toBeNull();expect(next.upgrades.resonance[element]).toBe(1.5);expect(next.spellsUsed).toBe(0);expect(next.turn).toBe(1);expect(s).toEqual(before);
    expect(Object.values(elementProbabilities(next.upgrades.resonance)).reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
  });
  it('다음 턴 지급 3개에는 예약이 없고 다음 전투에도 반복하지 않는다', () => {
    let s=chooseReward(reward(),'resonance',()=>0,'Fe');
    s=performAction(s,{type:'endTurn'},s.revision,()=>0);
    expect(s.inventory).toHaveLength(8);expect(s.inventory.filter(t=>t.element==='Fe')).toHaveLength(2);expect(s.freshIds).toHaveLength(3);
    s.screen='reward';s.rewards=['water'];s=chooseReward(s,'water',()=>0);
    expect(s.inventory.map(t=>t.element)).toEqual(['H','H','H','H','H']);expect(s.upgrades.resonance.Fe).toBe(1.5);expect(s.pendingResonance).toBeNull();
  });
  it('최근 예약만 사용하고 이전 지속 가중치는 보존하며 최대 2배를 넘지 않는다', () => {
    let s=reward();s.upgrades.resonance.Fe=1.5;s.pendingResonance='Fe';s=chooseReward(s,'resonance',()=>0,'Cl');
    expect(s.inventory.map(t=>t.element)).toEqual(['Cl','Cl','H','H','H']);expect(s.upgrades.resonance).toEqual({Fe:1.5,Cl:1.5});
    s.screen='reward';s.rewards=['resonance'];s=chooseReward(s,'resonance',()=>0,'Cl');expect(s.upgrades.resonance.Cl).toBe(2);
    s.screen='reward';s.rewards=['resonance'];expect(chooseReward(s,'resonance',()=>0,'Cl')).toBe(s);expect(chooseReward(s,'resonance',()=>0)).toBe(s);
  });
  it('정예 보상 직후 보스전에서도 5개 손패·확정 2개·중복 보상 방지를 유지한다', () => {
    const s=reward(3);const next=chooseReward(s,'resonance',()=>0,'Fe');expect(next.enemy.id).toBe('golem');expect(next.stage).toBe(4);
    expect(next.inventory.map(t=>t.element)).toEqual(['Fe','Fe','H','H','H']);expect(next.pendingResonance).toBeNull();expect(chooseReward(next,'resonance',()=>0,'Fe')).toBe(next);
    expect(newGame(()=>0).upgrades.resonance).toEqual({});expect(newGame(()=>0).pendingResonance).toBeNull();
  });
});
