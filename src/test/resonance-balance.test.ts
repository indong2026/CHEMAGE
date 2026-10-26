import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { chooseReward, newGame, simulateAction } from '../game/engine';
import { drawElement, seededRng } from '../game/random';
import { chooseAction } from './strategy';

function bossRun(seed: number, immediate: boolean) {
  let s = newGame(seededRng(seed), { firstAdventure: false });
  // Paired late-game fixture: same boss, HP, mana, upgrades and future RNG.
  s.stage=3;s.screen='reward';s.rewards=['resonance'];s.hp=45+seed%16;s.mana=(seed%4)*20;
  s.upgrades.shieldBonus=(seed%2)*3;s.upgrades.waterDamage=(seed%3)*4;s.upgrades.draw=seed%5===0?4:3;
  s=chooseReward(s,'resonance',seededRng(seed+1000),'Fe');
  if(!immediate) {
    const rng=seededRng(seed+1000);
    s.inventory=s.inventory.map(t=>({...t,element:drawElement(rng,s.upgrades.resonance)}));
  }
  const startFe=s.inventory.filter(t=>t.element==='Fe').length, startSize=s.inventory.length;
  const rng=seededRng(seed+2000);let ironCasts=0,ferrousCasts=0,firstTurnShield=0,firstTurnDamage=0;
  for(let step=0;step<160&&s.screen==='battle';step++) {
    const turn=s.turn; s=simulateAction(s,chooseAction(s,'mixed'),rng);
    for(const e of s.events) {
      if(e.kind==='spell'&&e.spell==='iron')ironCasts++;
      if(e.kind==='spell'&&e.spell==='ferrous')ferrousCasts++;
      if(turn===1&&e.kind==='shield'&&e.target==='player')firstTurnShield+=e.value??0;
      if(turn===1&&e.kind==='damage'&&e.target==='enemy')firstTurnDamage+=e.value??0;
    }
    expect(s.inventory.length).toBeLessThanOrEqual(s.upgrades.capacity);
    expect(s.pendingResonance).toBeNull();
  }
  return {seed,startFe,startSize,ironCasts,ferrousCasts,firstTurnShield,firstTurnDamage,firstTurnWin:s.screen==='victory'&&s.turn===1,win:s.screen==='victory',stalled:s.screen==='battle'};
}
it('200개 동일 시드의 보스 직전 Fe 공명: 즉시 지급 전후를 비교한다', () => {
  const variants=[false,true].map(immediate=>{
    const records=Array.from({length:200},(_,i)=>bossRun(i+1,immediate));
    return {immediate,runs:records.length,wins:records.filter(r=>r.win).length,stalled:records.filter(r=>r.stalled).length,
      averageStartingFe:records.reduce((n,r)=>n+r.startFe,0)/200,
      ironCasts:records.reduce((n,r)=>n+r.ironCasts,0),ferrousCasts:records.reduce((n,r)=>n+r.ferrousCasts,0),
      averageFirstTurnShield:records.reduce((n,r)=>n+r.firstTurnShield,0)/200,
      averageFirstTurnDamage:records.reduce((n,r)=>n+r.firstTurnDamage,0)/200,
      firstTurnWins:records.filter(r=>r.firstTurnWin).length,records};
  });
  writeFileSync('docs/phase7-resonance-balance.json',JSON.stringify({seedRange:[1,200],note:'Paired boss-only fixtures, mixed policy; both variants keep Fe weight 1.5. Reference replaces guaranteed hand with 5 weighted draws. HP 45..60, mana 0/20/40/60, varied existing upgrades. Future RNG is paired. Not human difficulty evidence.',variants},null,2));
  for(const v of variants){expect(v.stalled).toBe(0);expect(v.records.every(r=>r.startSize===5)).toBe(true);expect(v.firstTurnWins).toBe(0);}
  expect(variants[1].records.every(r=>r.startFe>=2)).toBe(true);
  expect(variants[1].averageStartingFe).toBeGreaterThan(variants[0].averageStartingFe);
},180_000);
