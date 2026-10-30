import {it,expect} from 'vitest';
import {writeFileSync,mkdirSync} from 'node:fs';
import {BALANCE as B} from '../data/balance';
import {ENEMIES,BOSS_IDS} from '../data/enemies';
import {SPELL_BY_ID} from '../data/spells';
import {newGame,simulateAction,simulateCast} from '../game/engine';
import {recipeIds} from '../game/suggestions';
import {previewSpell} from '../game/preview';
import {EXPERIMENTS,withTuning} from './balance-lab';
import {chooseAction} from './strategy';
import type {BossId,Element,GameState,Intent,SpellId} from '../game/types';
export function spellFixture(id:SpellId,boss:BossId='warden',intent:Intent={type:'attack',value:18,label:'공격'}){
 const s=newGame(()=>.5,{boss});s.stage=4;s.enemy={...s.enemy,id:boss,hp:ENEMIES[boss].hp,intent};s.inventory=Object.entries(SPELL_BY_ID[id].recipe).flatMap(([element,n])=>Array.from({length:n},()=>({id:s.nextId++,element:element as Element})));return s;
}
function evaluate(s:GameState,id:SpellId){const ids=recipeIds(s.inventory,SPELL_BY_ID[id])!,preview=previewSpell(s,ids)!;const cast=simulateAction(s,{type:'cast',ids},()=>.5);const n=simulateAction(cast,{type:'endTurn'},()=>.5);return{spell:id,preview,damage:s.enemy.hp-cast.enemy.hp,hpLoss:s.hp-n.hp,generated:cast.playerShield,absorbed:n.events.filter(e=>e.kind==='damage'&&e.target==='player').reduce((a,e)=>a+(e.blocked??0),0),reflect:n.events.filter(e=>e.effect==='reflect').reduce((a,e)=>a+(e.value??0),0),mana:cast.mana-s.mana,intent:n.events.filter(e=>e.kind==='enemy').map(e=>e.value)};}
it('compares complete defensive recipes and rare spells against single, multi-hit, fire and idle intents',()=>{
 const intents:Record<string,Intent>={single:{type:'attack',value:18,label:'단일'},multi:{type:'attack',value:18,label:'2연타',hits:[{type:'attack',value:9},{type:'attack',value:9}]},fire:{type:'fire',value:22,label:'화염'},fireMulti:{type:'fire',value:16,label:'화염 2연타',hits:[{type:'fire',value:8},{type:'fire',value:8}]},charge:{type:'charge',value:0,label:'충전'},shield:{type:'shield',value:10,label:'방어'}};
 const rows=Object.entries(EXPERIMENTS).flatMap(([tuningName,tuning])=>withTuning(tuning,()=>Object.entries(intents).flatMap(([name,intent])=>(['graphite','carbon','iron','nitrogen','sulfide','ferrous','ammonia'] as SpellId[]).map(id=>({tuning:tuningName,scenario:name,...evaluate(spellFixture(id,'warden',intent),id)})))));
 mkdirSync('docs/phase11',{recursive:true});writeFileSync('docs/phase11/situational-candidates.json',JSON.stringify(rows,null,2));
 const f=rows.find(x=>x.tuning==='baseline'&&x.scenario==='multi'&&x.spell==='ferrous')!;
 expect(f.intent).toEqual([6,6]);expect(f.hpLoss).toBe(12);
 expect(rows.find(x=>x.tuning==='baseline'&&x.scenario==='fireMulti'&&x.spell==='carbon')?.hpLoss).toBe(0);
 for(const id of ['ferrous','ammonia'])expect(rows.find(x=>x.tuning==='baseline'&&x.scenario==='charge'&&x.spell===id)?.intent).toEqual([0]);
});
it.each(BOSS_IDS)('%s final methane boost respects resistance and the exact C1/H4 recipe',boss=>{
 const s=spellFixture('methane',boss);s.boost=true;s.castHistory=['oxygen'];
 const ids=recipeIds(s.inventory,SPELL_BY_ID.methane)!,n=simulateCast(s,ids),hit=n.events.find(e=>e.kind==='damage'&&e.effect==='methane')!;
 expect(ids).toHaveLength(5);expect(SPELL_BY_ID.methane.recipe).toEqual({C:1,H:4});
 const expected=Math.max(0,Math.floor((B.methane.damage+10)*(boss==='inferno'?.75:1))-ENEMIES[boss].armor);
 expect(hit.value).toBe(expected);expect(n.events.filter(e=>e.kind==='reaction')).toHaveLength(1);expect(n.boost).toBe(false);
 expect(previewSpell(s,ids)?.damage).toBe(expected);
});
it('compares automatic choices when CH4 is complete and all policies see the same hand',()=>{
 const rows=Object.entries(EXPERIMENTS).flatMap(([name,tuning])=>withTuning(tuning,()=>BOSS_IDS.flatMap(boss=>(['attack','affinity','reaction','mixed','stockpile','burst'] as const).map(strategy=>{
  const s=spellFixture('methane',boss);s.inventory.push({id:s.nextId++,element:'Fe'},{id:s.nextId++,element:'O'},{id:s.nextId++,element:'O'});
  const a=chooseAction(s,strategy),spell=a.type==='cast'?Object.values(SPELL_BY_ID).find(x=>{const ids=recipeIds(s.inventory,x);return ids&&ids.length===a.ids.length&&ids.every(id=>a.ids.includes(id));})?.id:a.type;
  return{name,boss,strategy,choice:spell};
 }))));
 writeFileSync('docs/phase11/complete-hand-choices.json',JSON.stringify(rows,null,2));expect(rows).toHaveLength(Object.keys(EXPERIMENTS).length*18);
});
