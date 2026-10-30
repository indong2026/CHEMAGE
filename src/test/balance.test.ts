import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { runStrategy, type Strategy } from './strategy';
it('PHASE 7 힌트와 공명 즉시 지급으로 7전략 × 200시드를 비교한다', () => {
  const strategies: Strategy[] = ['attack', 'affinity', 'shield', 'mixed', 'reaction', 'stockpile', 'burst'];
  const reports = strategies.map(strategy => runStrategy(strategy, 200));
  writeFileSync('docs/phase11/regression-strategies.json', JSON.stringify({ seedRange: [1, 200], note: 'Resonance now guarantees 2 selected tiles among 5 starting tiles. All formulas known to policy, independent empty discovery records per run; random 3-of-5 route; reaction +7 per reaction; stockpile cost penalty 1.7; burst mana weight .65; one-turn greedy policies, not human win rates. Attack/affinity policies weight HP preservation at 1.2 and allow defensive spells. Attack approximates nominal damage by dividing observed HP damage by matchup; affinity evaluates actual damage; shield only uses support magic and ZERO; mixed can use all spells.', reports }, null, 2));
  for (const report of reports) { expect(report.stalled).toBe(0); expect(report.invalidResonanceStarts).toBe(0); }
  expect(reports[3].wins).toBeGreaterThan(0);
  expect(reports[3].wins).toBeGreaterThan(reports[2].wins);
  expect(reports[1].effectiveHits).toBeGreaterThan(0);
}, 180_000);
