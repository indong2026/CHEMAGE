import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { runStrategy } from './strategy';
it('200개 동일 시드에서 재구성 사용/미사용을 비교한다',()=>{
  const reports=[false,true].map(enabled=>runStrategy('mixed',200,enabled));
  writeFileSync('docs/phase7-reconstruction-balance.json',JSON.stringify({seedRange:[1,200],note:'Same mixed one-turn policy and seed range. Reconstruction selects the tile with greatest positive expected increase in distinct craftable recipes across 7 outcomes; never reads future RNG. Independent seeded stream for reconstruction, no resonance weights. All recipes known. Not human win rates. Decision opportunities and stranded >=3-round tile observations are normalized by respective sample counts.',reports},null,2));
  for(const r of reports){expect(r.stalled).toBe(0);expect(r.invalidResonanceStarts).toBe(0);expect(r.metrics.newSpellCasts).toBeGreaterThan(0);}
  expect(reports[0].metrics.uses).toBe(0);expect(reports[1].metrics.uses).toBeGreaterThan(0);expect(reports[1].metrics.newSpellOpportunities).toBeGreaterThan(0);
},180_000);
