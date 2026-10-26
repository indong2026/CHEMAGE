import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { SPELLS } from '../data/spells';
import { drawElement, seededRng } from '../game/random';
import { recipeIds } from '../game/suggestions';
import type { Element } from '../game/types';
it('PHASE 6/7 일반 지급에서 5·8·12개 손패의 조합 빈도를 비교한다',()=>{
  const old:[Element,number][]=[['H',.30],['O',.26],['C',.18],['Na',.10],['Cl',.10],['Fe',.06]];
  const reports=[false,true].flatMap(phase7=>[5,8,12].map(size=>{
    const rng=seededRng(7300+size),counts=Object.fromEntries(SPELLS.map(s=>[s.id,0]));let none=0;
    for(let i=0;i<10000;i++){
      const tiles=Array.from({length:size},(_,id)=>{let element:Element;if(phase7)element=drawElement(rng);else{const roll=rng();let sum=0;element='Fe';for(const [e,p] of old){sum+=p;if(roll<sum){element=e;break;}}}return{id,element};});
      const available=SPELLS.filter(s=>recipeIds(tiles,s));if(!available.length)none++;for(const s of available)counts[s.id]++;
    }
    return{phase7,size,samples:10000,none,counts};
  }));
  writeFileSync('docs/phase7-element-frequency.json',JSON.stringify({note:'Independent weighted hands without tutorial, resonance, spells, inventory selection or reconstruction. Same fixed RNG seeds. Counts are hands where a formula can be made at least once, not cast rates.',reports},null,2));
  expect(reports.every(r=>r.none<r.samples)).toBe(true);expect(reports[5].counts.ammonia).toBeGreaterThan(0);
});
