import { describe, expect, it } from 'vitest';
import { ELEMENT_KEYS, ELEMENTS } from '../data/elements';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import { REACTION_IDS } from '../data/reactions';
import { spellHints, REACTION_HINTS } from '../data/hints';
import { chooseReward, newGame, performAction, simulateCast } from './engine';
import { matchRecipe } from './recipes';
import { recipeIds } from './suggestions';
import { elementProbabilities, reconstructElement, seededRng } from './random';
import { adjustedIntent } from './incoming';
import { previewSpell } from './preview';
import { battleSequence } from '../presentation/sequence';
import { CODEX_KEY, REACTIONS_KEY, loadDiscoveries, loadReactions } from './codex';
import { HINTS_KEY, loadHints } from './hints';
import type { Action, Element, GameState, SpellId } from './types';

const newIds: SpellId[] = ['nitrogen','ammonia','nitro','sulfide','sulfur','ironSulfide'];
const setup = (elements: Element[] = []) => { const s=newGame(()=>.5); s.inventory=elements.map(element=>({id:s.nextId++,element}));s.enemy.hp=500;s.enemy.intent={type:'wait',value:0,label:'대기'};return s; };
const withSpells = (...ids: SpellId[]) => setup(ids.flatMap(id=>Object.entries(SPELL_BY_ID[id].recipe).flatMap(([e,n])=>Array(n).fill(e) as Element[])));
const run=(s:GameState,a:Action,rng=()=>.5)=>performAction(s,a,s.revision,rng);
const cast=(s:GameState,id:SpellId)=>run(s,{type:'cast',ids:recipeIds(s.inventory,SPELL_BY_ID[id])!});
const wait=(s:GameState)=>{s.enemy.intent={type:'wait',value:0,label:'대기'};return run(s,{type:'endTurn'});};

describe('8원소와 19마법',()=>{
  it('확률 합계·N/S 확률·공명 재정규화',()=>{
    expect(ELEMENT_KEYS).toHaveLength(8);expect(SPELLS).toHaveLength(19);expect(REACTION_IDS).toHaveLength(4);
    expect(Object.values(ELEMENTS).reduce((n,e)=>n+e.probability,0)).toBeCloseTo(1);
    expect(ELEMENTS.N.probability).toBe(.06);expect(ELEMENTS.S.probability).toBe(.06);
    for(const e of ELEMENT_KEYS){const p=elementProbabilities({[e]:2});expect(Object.values(p).reduce((a,b)=>a+b,0)).toBeCloseTo(1);expect(p[e]).toBeCloseTo(ELEMENTS[e].probability*2/(1+ELEMENTS[e].probability));}
  });
  it.each(newIds)('%s는 역순·섞인 순서에서 정확한 수량을 쓰고 힌트만으로 발견되지 않는다',id=>{
    const s=withSpells(id), ids=s.inventory.map(t=>t.id).reverse(), copy=structuredClone(s);
    expect(matchRecipe(s.inventory.map(t=>t.element).reverse())?.id).toBe(id);
    expect(matchRecipe([...s.inventory.map(t=>t.element),'Cl'])).toBeUndefined();
    const hints=spellHints(id);expect(hints).toHaveLength(3);expect(hints[1]).toContain(`총 ${ids.length}개`);expect(s.discoveries).toEqual([]);
    const n=run(s,{type:'cast',ids});expect(n.inventory).toHaveLength(0);expect(n.spellsUsed).toBe(1);expect(n.discoveries).toContain(id);expect(s).toEqual(copy);
    expect(n.events.filter(e=>e.kind==='spell')).toHaveLength(1);
  });
  it('질소 장막은 강화 보호막과 기본 시전+추가 마력, 100 상한을 적용한다',()=>{
    const s=withSpells('nitrogen','nitrogen');s.playerShield=5;s.upgrades.shieldBonus=3;
    const n=cast(s,'nitrogen');expect(n.playerShield).toBe(22);expect(n.mana).toBe(18);
    const p=previewSpell(n,recipeIds(n.inventory,SPELL_BY_ID.nitrogen)!);expect(p?.shield).toBe(17);expect(p?.totalShield).toBe(39);
    n.mana=95;expect(cast(n,'nitrogen').mana).toBe(100);
  });
  it('암모니아는 모든 타격 −2, 반복 시 비중첩, FeCl₂와는 강한 효과 하나만',()=>{
    let s=withSpells('ammonia','ammonia');s.enemy.intent={type:'attack',value:15,label:'연타',hits:[{type:'attack',value:7},{type:'attack',value:8}]};
    s=cast(s,'ammonia');expect(adjustedIntent(s.enemy.intent,0,false,s.enemy.mist).hits?.map(h=>h.value)).toEqual([5,6]);
    s=cast(s,'ammonia');expect(s.hp).toBe(49);expect(s.enemy.mist).toBe(false);
    let strong=withSpells('ammonia','ferrous');strong.enemy.intent={type:'attack',value:8,label:'공격'};
    strong=cast(cast(strong,'ammonia'),'ferrous');expect(strong.hp).toBe(55);
  });
  it('NO₂ 지속 피해는 2씩 2회이며 기존 H₂O₂와 마지막 시전으로 갱신한다',()=>{
    let s=cast(withSpells('nitro'),'nitro');expect(s.enemy.hp).toBe(486);
    s=wait(s);expect(s.enemy.hp).toBe(484);s=wait(s);expect(s.enemy.hp).toBe(482);s=wait(s);expect(s.enemy.hp).toBe(482);
    for(const pair of [['peroxide','nitro'],['nitro','peroxide']] as SpellId[][]){let n=withSpells(...pair);n=cast(cast(n,pair[0]),pair[1]);expect(n.enemy.dot).toBe(1);expect(n.enemy.dotDamage).toBe(pair[1]==='nitro'?2:4);expect(n.events.filter(e=>e.effect==='dot')).toHaveLength(1);}
  });
  it('H₂S는 실제 피해와 강화 보호막 모두 미리보기에 포함한다',()=>{
    const s=withSpells('sulfide');s.upgrades.shieldBonus=3;s.playerShield=16;
    const p=previewSpell(s,s.inventory.map(t=>t.id)),n=cast(s,'sulfide');
    expect(p?.damage).toBe(10);expect(p?.reactionShield).toBe(9);expect(n.playerShield).toBe(25);
  });
  it('SO₂는 젖음 +4 후 부식 상성을 적용하고 소비하며 가짜 반응 발견을 만들지 않는다',()=>{
    const s=withSpells('sulfur');s.enemy.id='beetle';s.enemy.wet=1;
    const n=cast(s,'sulfur');expect(n.enemy.wet).toBe(0);expect(n.events.find(e=>e.kind==='damage')?.value).toBe(22);expect(n.reactionDiscoveries).toEqual([]);
  });
  it('FeS는 금속 상성·방어력 2 관통·보호막을 반영한다',()=>{
    const s=withSpells('ironSulfide');s.enemy.id='golem';s.enemy.shield=7;
    const n=cast(s,'ironSulfide'),p=previewSpell(s,s.inventory.map(t=>t.id));
    expect(n.events.find(e=>e.kind==='damage')?.multiplier).toBe(1.5);expect(p?.damage).toBe(n.events.find(e=>e.kind==='damage')?.value);expect(p?.blocked).toBe(7);
  });
  it('NH₃ → HCl만 같은 턴 암모늄염 발견·중립 피해5를 한 번 적용한다',()=>{
    const s=withSpells('ammonia','acid');s.enemy.id='beetle';
    const first=cast(s,'ammonia'),ids=recipeIds(first.inventory,SPELL_BY_ID.acid)!,preview=previewSpell(first,ids),second=cast(first,'acid');
    const reaction=second.events.filter(e=>e.kind==='reaction');expect(reaction.map(e=>e.reaction)).toEqual(['ammonium']);
    expect(second.events.find(e=>e.kind==='damage'&&e.effect==='ammonium')?.value).toBe(3); // HCl reduces armor 5→2 first.
    expect(preview?.damage).toBe(second.events.filter(e=>e.kind==='damage'&&e.target==='enemy').reduce((n,e)=>n+(e.value??0),0));
    expect(second.reactionDiscoveries).toContain('ammonium');expect(REACTION_HINTS.ammonium.pair).toEqual(['ammonia','acid']);
    expect(cast(cast(withSpells('acid','ammonia'),'acid'),'ammonia').reactionDiscoveries).not.toContain('ammonium');
    const later=wait(cast(withSpells('ammonia','acid'),'ammonia'));expect(cast(later,'acid').reactionDiscoveries).not.toContain('ammonium');
  });
  it.each(['N','S'] as Element[])('%s 공명은 5개 중 2개 확정하고 기존 발견 데이터를 보존한다',element=>{
    const s=setup();s.screen='reward';s.rewards=['resonance'];s.discoveries=['water'];s.reconstruction=70;
    const n=chooseReward(s,'resonance',()=>0,element);expect(n.inventory).toHaveLength(5);expect(n.inventory.filter(t=>t.element===element)).toHaveLength(2);expect(n.reconstruction).toBe(70);expect(n.discoveries).toEqual(['water']);
  });
  it('기존 13개 마법·3반응·힌트 저장 키와 데이터를 유지한다',()=>{
    const old=SPELLS.slice(0,13).map(s=>s.id),reactions=REACTION_IDS.slice(0,3);
    const values:Record<string,string>={[CODEX_KEY]:JSON.stringify(old),[REACTIONS_KEY]:JSON.stringify(reactions),[HINTS_KEY]:JSON.stringify({magic:{water:3,ferrous:2},reaction:{combustion:3}})};
    const storage={getItem:(key:string)=>values[key]??null,setItem:(key:string,value:string)=>{values[key]=value;}};expect(loadDiscoveries(storage)).toEqual(old);expect(loadReactions(storage)).toEqual(reactions);expect(loadHints(storage).magic).toEqual({water:3,ferrous:2});
  });
});
describe('원소 재구성 규칙',()=>{
  it('0→35→70→100, 상한과 준비 알림을 유지한다',()=>{
    let s=setup();expect(s.reconstruction).toBe(0);
    for(const value of [35,70,100,100]){s=wait(s);expect(s.reconstruction).toBe(value);expect(s.events.filter(e=>e.kind==='reconstruct-ready')).toHaveLength(s.turn===4?1:0);}
  });
  it.each(['shield','charge','wait','attack'] as const)('%s 행동은 연타여도 한 번 충전',type=>{
    const s=setup();s.enemy.intent={type,value:type==='attack'?3:0,label:'행동',...(type==='attack'?{hits:[{type:'attack' as const,value:1},{type:'attack' as const,value:1},{type:'attack' as const,value:1}]}:{})};
    const n=run(s,{type:'endTurn'});expect(n.reconstruction).toBe(35);expect(n.stats.enemyActions).toBe(1);
  });
  it('직접 처치·지속 피해 처치·플레이어 패배·반사 처치는 다음 턴 충전을 주지 않는다',()=>{
    const kill=withSpells('water');kill.enemy.hp=1;expect(cast(kill,'water').reconstruction).toBe(0);
    const dot=setup();dot.enemy.dot=1;dot.enemy.hp=1;expect(run(dot,{type:'endTurn'}).reconstruction).toBe(0);
    const death=setup();death.hp=1;death.enemy.hp=1;death.turnEffects.reflect=3;death.enemy.intent={type:'attack',value:10,label:'공격'};
    const n=run(death,{type:'endTurn'});expect(n.screen).toBe('defeat');expect(n.reconstruction).toBe(0);
    death.hp=60;expect(run(death,{type:'endTurn'}).reconstruction).toBe(0);
  });
  it('승리·보상·다음 전투는 유지하고 새 모험은 초기화',()=>{
    const s=withSpells('water');s.enemy.hp=1;s.reconstruction=70;let n=cast(s,'water');expect(n.screen).toBe('reward');expect(n.reconstruction).toBe(70);
    n=chooseReward(n,n.rewards.find(r=>r!=='resonance')!,()=>.5);expect(n.reconstruction).toBe(70);expect(wait(n).reconstruction).toBe(100);expect(newGame().reconstruction).toBe(0);
  });
  it.each(['charge','empty','enemy','reward','stale','missing'] as const)('%s 유효성 검사 실패는 상태·RNG를 변경하지 않는다',mode=>{
    const s=setup(['Cl']);s.reconstruction=100;let revision=s.revision,id=s.inventory[0].id;
    if(mode==='charge')s.reconstruction=99;if(mode==='empty')s.inventory=[];if(mode==='enemy')s.spellsUsed=2;if(mode==='reward')s.screen='reward';if(mode==='stale')revision--;if(mode==='missing')id=-1;
    expect(performAction(s,{type:'reconstruct',id},revision,()=>{throw Error('RNG must not run');})).toBe(s);
  });
  it('같은 원소 중 한 장만 교체하며 마력·턴·시전·효과·반응 순서를 보존하고 중복 방지',()=>{
    const s=setup(['Cl','Cl','H']);s.reconstruction=100;s.mana=80;s.spellsUsed=1;s.castHistory=['ammonia'];s.playerShield=9;s.boost=true;
    const id=s.inventory[1].id,before=structuredClone(s),n=run(s,{type:'reconstruct',id},()=>0);
    expect(s).toEqual(before);expect(n.inventory).toHaveLength(3);expect(n.inventory[0]).toEqual(s.inventory[0]);expect(n.inventory[1].element).toBe('H');expect(n.inventory.some(t=>t.id===id)).toBe(false);
    expect(n.reconstruction).toBe(0);expect(n.mana).toBe(80);expect(n.turn).toBe(s.turn);expect(n.spellsUsed).toBe(1);expect(n.castHistory).toEqual(['ammonia']);expect(n.playerShield).toBe(9);expect(n.boost).toBe(true);expect(n.stats).toEqual(s.stats);expect(n.enemy).toEqual(s.enemy);
    expect(n.events.map(e=>e.kind)).toEqual(['reconstruct']);expect(run(n,{type:'reconstruct',id:n.inventory[0].id})).toBe(n);
    expect(performAction(n,{type:'reconstruct',id:n.inventory[0].id},s.revision)).toBe(n);
    expect(cast(n,'acid').reactionDiscoveries).toContain('ammonium');
  });
  it.each(ELEMENT_KEYS)('%s 제외 7종 균등·공명 무관·고정 시드',from=>{
    const candidates=ELEMENT_KEYS.filter(e=>e!==from);
    expect(Array.from({length:7},(_,i)=>reconstructElement(from,()=>(i+.5)/7))).toEqual(candidates);
    const rng=seededRng(7),counts=Object.fromEntries(candidates.map(e=>[e,0]));for(let i=0;i<14000;i++)counts[reconstructElement(from,rng)]++;
    for(const count of Object.values(counts))expect(count).toBeGreaterThan(1800);
    for(const resonance of [{},{Fe:2,N:2,S:2}]){const s=setup([from]);s.reconstruction=100;s.upgrades.resonance=resonance;expect(run(s,{type:'reconstruct',id:s.inventory[0].id},()=>.5).inventory[0].element).toBe(candidates[3]);}
  });
  it('동시 ZERO·재구성 준비 알림은 내 턴 배너 다음에 순차 배치하고 다음 행동에 반복하지 않는다',()=>{
    const s=setup();s.reconstruction=70;s.mana=100;
    const n=wait(s),seq=battleSequence(n,false);expect(seq.events.slice(-3).map(e=>e.kind)).toEqual(['turn-banner','ready','reconstruct-ready']);
    expect(battleSequence(wait(n),true).events.filter(e=>e.kind.includes('ready'))).toHaveLength(0);
    expect(battleSequence(n,true,true).events.filter(e=>e.kind==='reconstruct-ready')).toHaveLength(0);
  });
  it('기존 13종 마법도 동일한 엔진 미리보기와 2회 규칙을 유지한다',()=>{
    for(const spell of SPELLS){const s=withSpells(spell.id,spell.id),ids=recipeIds(s.inventory,spell)!;const p=previewSpell(s,ids),n=simulateCast(s,ids);if(p)expect(p.damage).toBe(n.events.filter(e=>e.kind==='damage'&&e.target==='enemy').reduce((sum,e)=>sum+(e.value??0),0));const next=cast(cast(s,spell.id),spell.id);expect(next.turn).toBe(2);expect(next.stats.casts).toBe(2);expect(next.reconstruction).toBe(35);}
  });
});
