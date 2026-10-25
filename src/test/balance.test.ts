import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { runStrategy, type Strategy } from './strategy';
it('새 상성/턴 종료/다중 타격 규칙으로 4전략 × 200시드를 비교한다', () => {
  const strategies: Strategy[] = ['attack', 'affinity', 'shield', 'mixed'];
  const reports = strategies.map(strategy => runStrategy(strategy, 200));
  writeFileSync('docs/phase4-balance.json', JSON.stringify({ seedRange: [1, 200], note: 'All formulas known; one-turn greedy policies, not human win rates. Attack/affinity policies weight HP preservation at 1.2 and allow defensive spells. Attack approximates nominal damage by dividing observed HP damage by matchup; affinity evaluates actual damage; shield only uses support magic and ZERO; mixed can use all spells.', reports }, null, 2));
  for (const report of reports) expect(report.stalled).toBe(0);
  expect(reports[3].wins).toBeGreaterThan(0);
  expect(reports[3].wins).toBeGreaterThan(reports[2].wins);
  expect(reports[1].effectiveHits).toBeGreaterThan(0);
}, 180_000);
