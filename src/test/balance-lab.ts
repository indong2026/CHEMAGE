// Internal, deterministic balance experiments. Never imported by the game/QA UI.
import { BALANCE } from '../data/balance';
import { SPELLS, SPELL_BY_ID } from '../data/spells';
import { ELEMENT_KEYS } from '../data/elements';
import { chooseReward, newGame, simulateAction } from '../game/engine';
import { adjustedIntent, directHits } from '../game/incoming';
import { matchRecipe } from '../game/recipes';
import { seededRng } from '../game/random';
import { recipeIds } from '../game/suggestions';
import { candidates, chooseAction, reconstructionChoice, type Strategy } from './strategy';
import type { Action, BossId, Element, SpellId } from '../game/types';

export type Tuning = { shield:number; reflect:number; methane:number; ferrous:number };
export const PHASE10: Tuning = {shield:10,reflect:3,methane:20,ferrous:16};
export const EXPERIMENTS: Record<string,Tuning> = {
 baseline:PHASE10,
 c8:{...PHASE10,shield:8}, cReflect2:{...PHASE10,reflect:2},
 methane23:{...PHASE10,methane:23}, methane24:{...PHASE10,methane:24}, ferrous18:{...PHASE10,ferrous:18},
};
/** Synchronous, test-process-only override; restoration includes thrown experiments. */
export function withTuning<T>(tuning:Tuning, fn:()=>T):T {
 const data=BALANCE as unknown as {graphite:{shield:number;reflect:number};methane:{damage:number};ferrous:{damage:number}};
 const previous={shield:data.graphite.shield,reflect:data.graphite.reflect,methane:data.methane.damage,ferrous:data.ferrous.damage};
 const apply=(t:Tuning)=>{data.graphite.shield=t.shield;data.graphite.reflect=t.reflect;data.methane.damage=t.methane;data.ferrous.damage=t.ferrous;};
 try{apply(tuning);return fn();}finally{apply(previous);}
}
export function spellMetrics(){return {opportunities:0,availableRounds:0,availabilityEpisodes:0,casts:0,elementsSpent:0,hpDamage:0,enemyShieldDamage:0,shieldGenerated:0,shieldAbsorbed:0,shieldUnused:0,reflectDamage:0,fireReduction:0,weakeningReduction:0,completionWait:0,castOldestAge:0,castTileAge:0,usedBattles:0,wonUsedBattles:0,missing:Object.fromEntries(ELEMENT_KEYS.map(e=>[e,0])) as Record<Element,number>};}
export type SpellMetrics=ReturnType<typeof spellMetrics>;
export const metricsTable=()=>Object.fromEntries(SPELLS.map(s=>[s.id,spellMetrics()])) as Record<SpellId,SpellMetrics>;
/** Shields share one pool in the engine. For research ONLY, attribute absorption
 * proportionally to outstanding contributions, never invent source priority. */
export class WardLedger {
 amounts:Partial<Record<SpellId|'reaction',number>>={};
 add(id:SpellId|'reaction',amount:number){this.amounts[id]=(this.amounts[id]??0)+amount;}
 absorb(value:number,record:(id:SpellId|'reaction',amount:number)=>void){
  const total=Object.values(this.amounts).reduce((a,b)=>a+b,0);if(!total)return;
  for(const [id,n] of Object.entries(this.amounts)){const part=Math.min(value,total)*n/total;this.amounts[id as SpellId]=n-part;record(id as SpellId,part);}
 }
 clear(record:(id:SpellId|'reaction',amount:number)=>void){for(const [id,n] of Object.entries(this.amounts))record(id as SpellId,n);this.amounts={};}
}
export type LabOptions={boss:BossId;strategy:Strategy;runs?:number;waterBonus?:number;adventure?:boolean;excluded?:SpellId[];randomLegal?:boolean};
export function measure(options:LabOptions){
 const {boss,strategy,runs=200,waterBonus=4,adventure=false,excluded=[],randomLegal=false}=options;
 const r={boss,strategy,runs,waterBonus,adventure,excluded,randomLegal,wins:0,defeats:0,stalled:0,rounds:0,hp:0,casts:0,decisions:0,endTurns:0,emptyEnds:0,reconstructions:0,newReconstructionOptions:0,blocked:0,shieldUnused:0,attributedBlocked:0,reactionBlocked:0,reactionUnused:0,weakHits:0,attackHits:0,spells:metricsTable(),enemies:{} as Record<string,{visits:number;wins:number;decisions:number;casts:number;spells:Record<SpellId,SpellMetrics>}>,outcomes:[] as {seed:number;win:boolean;hp:number;rounds:number}[]};
 for(let seed=1;seed<=runs;seed++){
  let rng=seededRng(seed),s=newGame(rng,{boss,firstAdventure:false});
  if(!adventure){s.stage=3;s.screen='reward';s.rewards=['water'];s.hp=45+seed%16;s.mana=(seed%4)*20;s.reconstruction=(seed%3)*35;s.upgrades.shieldBonus=(seed%2)*3;s.upgrades.draw=seed%5===0?4:3;s=chooseReward(s,'water',seededRng(seed+1000));s.upgrades.waterDamage=waterBonus;rng=seededRng(seed+2000);}
  const rrng=seededRng(seed+50000),policyRng=seededRng(seed+80000),born=new Map<number,number>(),ledger=new WardLedger();
  let previousAvailable=new Set<SpellId>(),roundSeen=new Set<SpellId>(),lastRound='',used=new Set<SpellId>(),active=s.enemy.id,creditedWeaken:SpellId|undefined,dotSource:SpellId|undefined,fireUsed=false;
  const bucket=()=>r.enemies[active]??(r.enemies[active]={visits:0,wins:0,decisions:0,casts:0,spells:metricsTable()});
  bucket().visits++;
  const add=(id:SpellId,key:Exclude<keyof SpellMetrics,'missing'>,value:number)=>{r.spells[id][key]+=value;bucket().spells[id][key]+=value;};
  const settle=(win:boolean)=>{for(const id of used){add(id,'usedBattles',1);if(win)add(id,'wonUsedBattles',1);}if(win)bucket().wins++;used=new Set();ledger.clear((id,n)=>{if(id==='reaction')r.reactionUnused+=n;else add(id,'shieldUnused',n);r.shieldUnused+=n;});};
  const syncBorn=()=>{for(const t of s.inventory)if(!born.has(t.id))born.set(t.id,s.turn);};
  syncBorn();
  for(let step=0;step<(adventure?320:160)&&s.screen!=='victory'&&s.screen!=='defeat';step++){
   if(s.screen==='reward'){
    const priority=[s.hp<35?'heal':'water','draw','guard','reaction','water','resonance','research','bag','heal'];
    const reward=[...s.rewards].sort((a,b)=>priority.indexOf(a)-priority.indexOf(b))[0],element=ELEMENT_KEYS.find(e=>(s.upgrades.resonance[e]??1)<2);
    s=chooseReward(s,reward,rng,element);active=s.enemy.id;bucket().visits++;born.clear();previousAvailable.clear();roundSeen.clear();lastRound='';creditedWeaken=undefined;dotSource=undefined;syncBorn();continue;
   }
   const tile=reconstructionChoice(s);
   if(tile!==undefined){const before=SPELLS.filter(x=>recipeIds(s.inventory,x)).map(x=>x.id);s=simulateAction(s,{type:'reconstruct',id:tile},rrng);r.reconstructions++;if(SPELLS.some(x=>recipeIds(s.inventory,x)&&!before.includes(x.id)))r.newReconstructionOptions++;syncBorn();}
   if(lastRound!==`${s.stage}:${s.turn}`){lastRound=`${s.stage}:${s.turn}`;roundSeen.clear();fireUsed=false;}
   const available=new Map<SpellId,number[]>();const counts=Object.fromEntries(ELEMENT_KEYS.map(e=>[e,s.inventory.filter(t=>t.element===e).length]));
   for(const spell of SPELLS){const ids=recipeIds(s.inventory,spell);
    if(ids){available.set(spell.id,ids);add(spell.id,'opportunities',1);if(!roundSeen.has(spell.id)){add(spell.id,'availableRounds',1);roundSeen.add(spell.id);}if(!previousAvailable.has(spell.id)){add(spell.id,'availabilityEpisodes',1);add(spell.id,'completionWait',Math.max(...ids.map(id=>s.turn-(born.get(id)??s.turn))));}}
    for(const e of ELEMENT_KEYS){const missing=Math.max(0,(spell.recipe[e]??0)-counts[e]);r.spells[spell.id].missing[e]+=missing;bucket().spells[spell.id].missing[e]+=missing;}
   }
   previousAvailable=new Set(available.keys());r.decisions++;bucket().decisions++;
   let action:Action;
   if(randomLegal){const choices=candidates(s,strategy);action=choices[Math.floor(policyRng()*choices.length)];}else action=chooseAction(s,strategy,excluded);
   if(action.type==='endTurn'){r.endTurns++;if(!available.size)r.emptyEnds++;}
   const before=s;
   if(action.type==='cast'){
    const spell=matchRecipe(action.ids.map(id=>s.inventory.find(t=>t.id===id)!.element))!;used.add(spell.id);add(spell.id,'casts',1);r.casts++;bucket().casts++;add(spell.id,'elementsSpent',action.ids.length);
    add(spell.id,'castOldestAge',Math.max(...action.ids.map(id=>s.turn-(born.get(id)??s.turn))));add(spell.id,'castTileAge',action.ids.reduce((n,id)=>n+s.turn-(born.get(id)??s.turn),0));
    if(spell.id==='ferrous')creditedWeaken='ferrous';if(spell.id==='ammonia'&&creditedWeaken!=='ferrous')creditedWeaken='ammonia';
    if(spell.id==='peroxide'||spell.id==='nitro')dotSource=spell.id;
   }
   s=simulateAction(s,action,rng);if(s===before){r.stalled++;break;}
   for(const event of s.events){
    if(event.kind==='shield'&&event.target==='player'){
     const id=event.effect&&event.effect in SPELL_BY_ID?event.effect as SpellId:'reaction';ledger.add(id,event.value??0);if(id!=='reaction')add(id,'shieldGenerated',event.value??0);
    }
    if(event.kind==='damage'&&event.target==='enemy'){
     const id=event.effect==='reflect'?'graphite':event.effect==='dot'?dotSource:event.effect&&event.effect in SPELL_BY_ID?event.effect as SpellId:undefined;
     if(id){add(id,event.effect==='reflect'?'reflectDamage':'hpDamage',event.value??0);add(id,'enemyShieldDamage',event.blocked??0);}
     if(event.affinity){r.attackHits++;if((event.multiplier??1)>1)r.weakHits++;}
    }
    if(event.kind==='enemy'&&event.hitIndex){
     if(creditedWeaken){const base=directHits(adjustedIntent(before.enemy.intent,0,before.vulnerable))[event.hitIndex-1]?.value??0;add(creditedWeaken,'weakeningReduction',Math.max(0,base-(event.value??0)));}
     const carbonActive=before.turnEffects.fireReduction>0||ledger.amounts.carbon!==undefined;
     if(event.effect==='enemy-fire'&&!fireUsed){if(carbonActive)add('carbon','fireReduction',Math.min(BALANCE.carbon.fireReduction,event.value??0));fireUsed=true;}
    }
    if(event.kind==='damage'&&event.target==='player'){
     r.blocked+=event.blocked??0;ledger.absorb(event.blocked??0,(id,n)=>{r.attributedBlocked+=n;if(id==='reaction')r.reactionBlocked+=n;else add(id,'shieldAbsorbed',n);});
    }
   }
   const acted=s.stats.enemyActions>before.stats.enemyActions;
   if(acted){creditedWeaken=undefined;ledger.clear((id,n)=>{if(id==='reaction')r.reactionUnused+=n;else add(id,'shieldUnused',n);r.shieldUnused+=n;});}
   if(s.screen!=='battle')settle(s.screen!=='defeat');
   syncBorn();
  }
  const win=s.screen==='victory',hp=s.hp-(s.events.find(e=>e.kind==='win')?.value??0);
  if(win)r.wins++;else if(s.screen==='defeat')r.defeats++;else r.stalled++;
  r.rounds+=s.stats.turns;r.hp+=hp;r.outcomes.push({seed,win,hp,rounds:s.stats.turns});
 }
 const totalCasts=r.casts,usedSpells=Object.values(r.spells).filter(m=>m.casts>0);
 return {...r,winRate:r.wins/runs,averageRounds:r.rounds/runs,averageHp:r.hp/runs,cShare:r.spells.graphite.casts/(totalCasts||1),emptyEndRatio:r.emptyEnds/(r.endTurns||1),uniqueSpells:usedSpells.length,entropy:usedSpells.reduce((n,m)=>{const p=m.casts/totalCasts;return n-p*Math.log(p);},0)};
}
