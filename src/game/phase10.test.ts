import {describe,it,expect} from 'vitest';
import {BOSS_IDS,ENEMIES,selectBoss} from '../data/enemies';
import {SPELL_BY_ID,SPELLS} from '../data/spells';
import {REACTION_IDS} from '../data/reactions';
import {ELEMENT_KEYS} from '../data/elements';
import {newGame,performAction,simulateCast,chooseReward,enemyArmor} from './engine';
import {seededRng,shuffle} from './random';
import {recipeIds} from './suggestions';
import {adjustedIntent,directHits} from './incoming';
import {previewSpell} from './preview';
import type {BossId,Element,GameState,SpellId} from './types';
import {stageNotice,GUIDES,loadGuideProgress,GUIDE_KEY} from '../presentation/ux';

export function bossFixture(id:BossId,index=0,phase:1|2=1){
  const s=newGame(seededRng(42),{boss:id});const data=ENEMIES[id];
  s.stage=4;s.enemy={id,hp:data.hp,shield:0,wet:0,acid:0,dot:0,phase,patternIndex:index,intent:{...(phase===2?data.phase2!:data.pattern)[index]}};
  s.inventory=[];s.nextId=100;return s;
}
function hand(s:GameState,...spells:SpellId[]){s.inventory=spells.flatMap(id=>Object.entries(SPELL_BY_ID[id].recipe).flatMap(([element,n])=>Array.from({length:n},()=>({id:s.nextId++,element:element as Element}))));return s;}
const end=(s:GameState)=>performAction(s,{type:'endTurn'},s.revision,()=>.5);
const cast=(s:GameState,id:SpellId)=>performAction(s,{type:'cast',ids:recipeIds(s.inventory,SPELL_BY_ID[id])!},s.revision,()=>.5);

describe('PHASE 10 boss selection and compatibility',()=>{
 it('keeps content counts, old golem stats and registers three distinct bosses',()=>{
  expect([ELEMENT_KEYS.length,SPELLS.length,REACTION_IDS.length]).toEqual([8,19,4]);
  expect(BOSS_IDS).toEqual(['golem','inferno','warden']);
  expect([ENEMIES.golem.hp,ENEMIES.golem.armor,ENEMIES.golem.phaseThreshold]).toEqual([120,0,60]);
  expect(ENEMIES.inferno.affinity).toBe('FIRE');expect(ENEMIES.warden.affinity).toBe('METAL');
 });
 it('uses equal thirds and deterministic seeds without consuming additional gameplay RNG',()=>{
  expect([0,.333333333,.333333334,.666666666,.666666667,.999999].map(x=>selectBoss(()=>x))).toEqual(['golem','golem','inferno','inferno','warden','warden']);
  const counts={golem:0,inferno:0,warden:0};
  for(let seed=1;seed<=6000;seed++){
   const rng=seededRng(seed),control=seededRng(seed);const s=newGame(rng,{firstAdventure:false});
   const normals=shuffle(['slime','beetle','flame','minion','gel'],control).slice(0,3);
   for(let i=0;i<(normals[0]==='slime'?2:5);i++)control();
   expect(s.route.slice(0,3)).toEqual(normals);expect(rng()).toBe(control());
   expect(s.route).toEqual(newGame(seededRng(seed),{firstAdventure:false}).route);
   expect(s.route).toHaveLength(5);expect(s.route[3]).toBe('elite');counts[s.route[4] as BossId]++;
  }
  for(const n of Object.values(counts))expect(n).toBeGreaterThan(1800);
  for(const n of Object.values(counts))expect(n).toBeLessThan(2200);
 });
 it.each(BOSS_IDS)('keeps %s through reward transitions and preserves records',id=>{
  let s=newGame(seededRng(8),{boss:id,discoveries:['water'],reactions:['ammonium']});
  s.reconstruction=70;s.mana=40;
  for(let i=0;i<4;i++){s.screen='reward';s.rewards=['heal'];s=chooseReward(s,'heal',()=>.5);}
  expect(s.enemy.id).toBe(id);expect(s.stage).toBe(4);expect(s.reconstruction).toBe(70);expect(s.mana).toBe(40);
  expect(s.discoveries).toEqual(['water']);expect(s.reactionDiscoveries).toEqual(['ammonium']);
 });
});
describe('PHASE 10 patterns, telegraphs and phase transitions',()=>{
 for(const id of BOSS_IDS)for(const phase of [1,2] as const){
  const pattern=phase===1?ENEMIES[id].pattern:ENEMIES[id].phase2!;
  it.each(pattern.map((intent,index)=>({intent,index})))(`${id} phase ${phase} action $index matches announced hits`,({intent,index})=>{
   const s=bossFixture(id,index,phase);s.hp=60;const n=end(s);
   expect(n.events.filter(e=>e.kind==='enemy'&&e.hitIndex).map(e=>e.value)).toEqual(directHits(intent).map(h=>h.value));
   expect(n.stats.enemyActions).toBe(1);expect(n.reconstruction).toBe(35);
   if(intent.type==='shield')expect(n.enemy.shield).toBe(intent.value);
   if(intent.type==='charge'){expect(n.hp).toBe(60);expect(n.enemy.intent.value).toBe(pattern[(index+1)%pattern.length].value);}
  });
 }
 it.each(['inferno','warden'] as const)('%s keeps an announced charged hit across phase II, then strengthens the next cycle',id=>{
  const data=ENEMIES[id],chargeIndex=data.pattern.findIndex(i=>i.type==='charge');
  let s=bossFixture(id,chargeIndex);s=end(s);const promised={...s.enemy.intent};
  s.enemy.hp=data.phaseThreshold!+1;hand(s,'hydrogen');s=cast(s,'hydrogen');
  expect(s.enemy.phase).toBe(2);expect(s.enemy.intent).toEqual(promised);
  expect(s.events.filter(e=>e.kind==='phase')).toHaveLength(1);
  s.hp=60;s=end(s);expect(s.events.filter(e=>e.kind==='enemy').map(e=>e.value)).toEqual([promised.value]);
  s.hp=60;s=end(s);expect(s.events.some(e=>e.kind==='phase')).toBe(false);
 });
 it.each(['inferno','warden'] as const)('%s crossing threshold during charge still releases phase II burst',id=>{
  const data=ENEMIES[id],index=data.pattern.findIndex(i=>i.type==='charge');
  let s=bossFixture(id,index);s.enemy.hp=data.phaseThreshold!+1;hand(s,'hydrogen');s=cast(s,'hydrogen');s=end(s);
  expect(s.enemy.intent.value).toBe(data.phase2![index+1].value);
  const expected=s.enemy.intent.value;s=end(s);expect(s.events.filter(e=>e.kind==='enemy').map(e=>e.value)).toEqual([expected]);
 });
 it('preserves golem charged attack when threshold is crossed on charge turn',()=>{
  let s=bossFixture('golem',1);s.enemy.hp=59;s=end(s);expect(s.enemy.phase).toBe(1);expect(s.enemy.intent.value).toBe(24);
  s=end(s);expect(s.events.find(e=>e.kind==='enemy')?.value).toBe(24);expect(s.enemy.phase).toBe(2);
 });
 it('warden phase ward is added once; regular barriers refresh, never accumulate',()=>{
  let s=hand(bossFixture('warden'),'water');s.enemy.hp=52;s.enemy.shield=4;
  s=cast(s,'water');expect(s.enemy.phase).toBe(2);expect(s.enemy.shield).toBe(10);
  s=end(s);expect(s.enemy.shield).toBe(10);s.hp=60;s=end(s);
  expect(s.enemy.intent.type).toBe('attack');expect(s.enemy.shield).toBe(10);
  s=bossFixture('warden',2,2);s.enemy.shield=4;s=end(s);expect(s.enemy.shield).toBe(12);
 });
});
describe('PHASE 10 spell interactions and endings',()=>{
 it.each(BOSS_IDS)('%s multi-hit ward persists between hits and expires once at action end',id=>{
  const phase=id==='golem'?2:1;const pattern=phase===2?ENEMIES[id].phase2!:ENEMIES[id].pattern;
  const index=pattern.findIndex(i=>i.hits);const s=bossFixture(id,index,phase);s.playerShield=11;s.turnEffects.reflect=3;
  const n=end(s),damage=n.events.filter(e=>e.kind==='damage'&&e.target==='player');
  expect(damage[0].blocked).toBe(directHits(s.enemy.intent)[0].value);
  expect(damage[1].blocked).toBe(11-directHits(s.enemy.intent)[0].value);expect(n.playerShield).toBe(0);
  expect(n.events.filter(e=>e.kind==='shield-end')).toHaveLength(1);expect(n.events.filter(e=>e.effect==='reflect')).toHaveLength(1);
 });
 it('CO2 reduces only the first flame rush hit; ammonia weakens both',()=>{
  const s=bossFixture('inferno',1);s.playerShield=6;s.turnEffects.fireReduction=5;s.enemy.mist=true;
  const n=end(s);expect(n.events.filter(e=>e.kind==='enemy').map(e=>e.value)).toEqual([5,5]);
  expect(n.hp).toBe(60);expect(n.playerShield).toBe(0);
  const plain=bossFixture('inferno',1);plain.turnEffects.fireReduction=5;expect(end(plain).hp).toBe(51);
 });
 it.each(BOSS_IDS)('%s uses strongest weaken effect per hit and clears it',id=>{
  const s=bossFixture(id,id==='golem'?1:1,id==='golem'?2:1);s.enemy.weaken=1;s.enemy.mist=true;
  const promised=adjustedIntent(s.enemy.intent,1,false,true);const n=end(s);
  expect(n.events.filter(e=>e.kind==='enemy').map(e=>e.value)).toEqual(directHits(promised).map(h=>h.value));
  expect(n.enemy.weaken).toBe(0);expect(n.enemy.mist).toBe(false);
 });
 it('HCl has corrosion advantage and reduces armor; water exploits inferno weakness',()=>{
  const s=hand(bossFixture('warden'),'acid'),n=cast(s,'acid');expect(n.enemy.hp).toBe(98);expect(enemyArmor(n)).toBe(2);
  const water=cast(hand(bossFixture('inferno'),'water'),'water');expect(water.enemy.hp).toBe(ENEMIES.inferno.hp-18);
 });
 it.each(['hydrogen','alkali'] as const)('%s shield-only damage never spills into HP and preview matches',id=>{
  const a=hand(bossFixture('warden'),id),b=hand(bossFixture('warden'),id);b.enemy.shield=1;
  const ids=recipeIds(b.inventory,SPELL_BY_ID[id])!,preview=previewSpell(b,ids)!;
  expect(simulateCast(a,recipeIds(a.inventory,SPELL_BY_ID[id])!).enemy.hp).toBe(simulateCast(b,ids).enemy.hp);
  const n=cast(b,id);expect(103-n.enemy.hp).toBe(preview.damage);expect(preview.blocked).toBe(1);
 });
 it.each(BOSS_IDS)('%s supports reconstruction, burst, reaction, victory and defeat without duplicate commands',id=>{
  let s=hand(bossFixture(id),'ammonia','acid');s.reconstruction=100;const history=[...s.castHistory];
  const r=performAction(s,{type:'reconstruct',id:s.inventory[0].id},s.revision,()=>.2);
  expect(r.reconstruction).toBe(0);expect(r.turn).toBe(s.turn);expect(r.spellsUsed).toBe(0);expect(r.castHistory).toEqual(history);
  expect(performAction(r,{type:'reconstruct',id:r.inventory[0].id},s.revision)).toBe(r);
  s=cast(s,'ammonia');s=cast(s,'acid');expect(s.reactionDiscoveries).toContain('ammonium');
  s=bossFixture(id);s.mana=100;s.enemy.hp=1;s.playerShield=10;const win=performAction(s,{type:'burst'},s.revision,()=>.5);
  expect(win.screen).toBe('victory');expect(win.mana).toBe(0);expect(win.playerShield).toBe(0);expect(win.reconstruction).toBe(0);
  expect(performAction(win,{type:'endTurn'},win.revision)).toBe(win);
  s=bossFixture(id);s.hp=1;s.enemy.hp=3;s.turnEffects.reflect=3;expect(end(s).screen).toBe('defeat');
 });
 it.each(BOSS_IDS)('%s introduction uses actual identity and no layout panel',id=>{
  const notice=stageNotice(bossFixture(id),1)!;expect(notice.title).toContain(ENEMIES[id].name);expect(notice.text).toContain(ENEMIES[id].boss!.intro);
 });
 it('new guides preserve previous seen records and skip preference',()=>{
  localStorage.setItem(GUIDE_KEY,JSON.stringify({seen:['combine','keep'],disabled:false}));
  expect(loadGuideProgress(true)).toEqual({seen:['combine','keep'],disabled:false});expect(GUIDES.inferno.text).toContain('화염');expect(GUIDES.warden.text).toContain('부식');
  localStorage.setItem(GUIDE_KEY,JSON.stringify({seen:['combine'],disabled:true}));expect(loadGuideProgress(true).disabled).toBe(true);
 });
});
