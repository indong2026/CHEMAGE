// @vitest-environment node
import {it,expect} from 'vitest';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BOSS_IDS} from '../data/enemies';
import {SPELLS} from '../data/spells';
import {BALANCE} from '../data/balance';
import {EXPERIMENTS,PHASE10,measure,withTuning,type Tuning} from './balance-lab';
import type {Strategy} from './strategy';
const phase=process.env.CHEMAGE_LAB;
const strategies:Strategy[]=['attack','affinity','reaction','mixed','stockpile','burst'];
const folder='docs/phase11';
const validate=(r:ReturnType<typeof measure>)=>{
 expect(r.stalled).toBe(0);expect(r.attributedBlocked).toBeCloseTo(r.blocked,5);
 for(const m of Object.values(r.spells)){expect(m.casts).toBeLessThanOrEqual(m.opportunities);expect(m.shieldAbsorbed+m.shieldUnused).toBeCloseTo(m.shieldGenerated,5);}
};
function save(name:string,tuning:Tuning,full:boolean){
 const report=withTuning(tuning,()=>{
  const bosses=BOSS_IDS.flatMap(boss=>(full?strategies:['mixed'] as Strategy[]).map(strategy=>measure({boss,strategy})));
  const noWater=BOSS_IDS.map(boss=>measure({boss,strategy:'mixed',waterBonus:0}));
  const adventures=full?BOSS_IDS.map(boss=>measure({boss,strategy:'mixed',adventure:true})):[];
  for(const r of [...bosses,...noWater,...adventures])validate(r);
  return {name,tuning,seeds:[1,200],bosses,noWater,adventures};
 });
 mkdirSync(folder,{recursive:true});writeFileSync(`${folder}/${name}.json`,JSON.stringify(report,null,2));
 console.log(name,report.bosses.filter(r=>r.strategy==='mixed').map(r=>({boss:r.boss,win:r.winRate,c:r.cShare,methane:r.spells.methane.casts,ferrous:r.spells.ferrous.casts})));
 return report;
}
it.skipIf(!phase)('PHASE 11 isolated balance experiments; explicit opt-in, never game runtime',()=>{
 if(phase==='baseline'){
  mkdirSync(folder,{recursive:true});
  writeFileSync(`${folder}/baseline-manifest.json`,JSON.stringify({tuning:PHASE10,spells:SPELLS.map(({id,formula,recipe,fact,affinity})=>({id,formula,recipe,fact,affinity})),sourceHashes:Object.fromEntries(['src/game/engine.ts','src/game/random.ts','src/data/enemies.ts','src/data/elements.ts','src/data/reactions.ts','src/data/rewards.ts','src/data/affinities.ts','src/styles/ux.css','src/screens/Battle.tsx'].map(path=>[path,createHash('sha256').update(readFileSync(path,'utf8').replace(/\r\n/g,'\n')).digest('hex')]))},null,2));
  const report=save('baseline',PHASE10,true);
  expect(report.bosses.filter(r=>r.strategy==='mixed').map(r=>r.wins)).toEqual([136,168,140]);
  const random=withTuning(PHASE10,()=>BOSS_IDS.map(boss=>measure({boss,strategy:'mixed',randomLegal:true})));
  random.forEach(validate);writeFileSync(`${folder}/policy-sensitivity.json`,JSON.stringify({note:'Uniform legal-action policy, separate RNG. Weak reference for decision bias, not a human model.',random},null,2));
 }else if(phase==='candidates'){
  for(const [name,tuning] of Object.entries(EXPERIMENTS))if(name!=='baseline')save(name,tuning,false);
 }else if(phase==='combined'){
  const tuning=JSON.parse(process.env.CHEMAGE_TUNING??'null') as Tuning;if(!tuning)throw new Error('Explicit tuning required');save(process.env.CHEMAGE_LABEL??'combined',tuning,false);
 }else if(phase==='final'){
  const tuning={shield:BALANCE.graphite.shield,reflect:BALANCE.graphite.reflect,methane:BALANCE.methane.damage,ferrous:BALANCE.ferrous.damage};
  save('final',tuning,true);
  const ablations=withTuning(tuning,()=>BOSS_IDS.flatMap(boss=>(['graphite','methane','ferrous'] as const).map(id=>measure({boss,strategy:'mixed',excluded:[id]}))));
  ablations.forEach(validate);writeFileSync(`${folder}/final-ablations.json`,JSON.stringify(ablations,null,2));
 }else throw new Error('Unknown experiment');
},600_000);
