import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {BOSS_IDS} from '../data/enemies';
import {newGame,chooseReward,simulateAction} from '../game/engine';
import {seededRng} from '../game/random';
import {isDangerous} from '../game/danger';
import {chooseAction,reconstructionChoice,runStrategy,type Strategy} from './strategy';
import type {BossId} from '../game/types';

function benchmark(boss:BossId,strategy:Strategy,runs:number,excluded:string[]=[]){
 const report={boss,strategy,runs,excluded,wins:0,stalled:0,rounds:0,remainingHp:0,winnerHp:0,casts:0,weakHits:0,attackHits:0,wards:0,dangerDecisions:0,defendedDanger:0,maxShield:0,spells:{} as Record<string,number>};
 for(let seed=1;seed<=runs;seed++){
  let s=newGame(seededRng(seed),{boss,firstAdventure:false});
  s.stage=3;s.screen='reward';s.rewards=['water'];s.hp=45+seed%16;s.mana=(seed%4)*20;s.reconstruction=(seed%3)*35;
  s.upgrades.shieldBonus=(seed%2)*3;s.upgrades.draw=seed%5===0?4:3;
  s=chooseReward(s,'water',seededRng(seed+1000));
  const rng=seededRng(seed+2000),reconstruction=seededRng(seed+50000);
  for(let step=0;step<160&&s.screen==='battle';step++){
   const id=reconstructionChoice(s);if(id!==undefined)s=simulateAction(s,{type:'reconstruct',id},reconstruction);
   const before=s,danger=isDangerous(s.enemy.intent);s=simulateAction(s,chooseAction(s,strategy,excluded),rng);
   const wards=s.events.filter(e=>e.kind==='shield'&&e.target==='player').length;
   if(danger){report.dangerDecisions++;if(wards)report.defendedDanger++;}
   report.wards+=wards;report.maxShield=Math.max(report.maxShield,s.enemy.shield);
   for(const e of s.events){if(e.kind==='spell'&&e.spell)report.spells[e.spell]=(report.spells[e.spell]??0)+1;
    if(e.kind==='damage'&&e.target==='enemy'&&e.affinity){report.attackHits++;if((e.multiplier??1)>1)report.weakHits++;}}
   expect(s.revision).toBeGreaterThan(before.revision);
  }
  const hp=s.hp-(s.events.find(e=>e.kind==='win')?.value??0);
  report.remainingHp+=hp;report.rounds+=s.stats.turns;report.casts+=s.stats.casts;
  if(s.screen==='victory'){report.wins++;report.winnerHp+=hp;}
  if(s.screen==='battle')report.stalled++;
 }
 return {...report,winRate:report.wins/runs,averageRounds:report.rounds/runs,averageRemainingHp:report.remainingHp/runs,averageWinnerHp:report.winnerHp/(report.wins||1),weakAttackRatio:report.weakHits/(report.attackHits||1),wardCastsPerRun:report.wards/runs,dangerDefenseRatio:report.defendedDanger/(report.dangerDecisions||1),topSpells:Object.entries(report.spells).sort((a,b)=>b[1]-a[1]).slice(0,5)};
}
it('PHASE 10: six strategies × three fixed bosses × 200 paired seeds, plus 600 full adventures',()=>{
 const strategies:Strategy[]=['attack','affinity','reaction','mixed','stockpile','burst'];
 const reports=BOSS_IDS.flatMap(boss=>strategies.map(strategy=>benchmark(boss,strategy,200)));
 const ablations=[benchmark('inferno','mixed',200,['water']),benchmark('warden','mixed',200,['acid'])];
 const adventures=BOSS_IDS.map(boss=>({boss,...runStrategy('mixed',200,true,boss)}));
 writeFileSync('docs/phase11/regression-bosses.json',JSON.stringify({seedRange:[1,200],note:'Paired final-battle fixtures: HP 45..60, mana 0/20/40/60, water +4 reward, shield bonus 0/3, draw 3/4, identical initial hands and future RNG. All recipes available to policies. One-round greedy policies, not estimates of human difficulty. Remaining HP excludes victory heal. Danger defense ratio counts decisions while dangerous intent visible. Full adventures use normal route and reward choices.',reports,ablations,adventures},null,2));
 for(const r of [...reports,...ablations]){expect(r.stalled).toBe(0);expect(r.wins).toBeGreaterThan(0);expect(r.maxShield).toBeLessThanOrEqual(22);}
 for(const r of adventures){expect(r.stalled).toBe(0);expect(r.wins).toBeGreaterThan(0);expect(r.stageVisits).toHaveLength(5);}
},240_000);
