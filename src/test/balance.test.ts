import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { runStrategy, type Strategy } from './strategy';
it('실제 엔진의 즉시 시전 규칙으로 4전략 × 200개 시드 모험을 비교한다', () => {
  const strategies: Strategy[] = ['two-casts', 'one-cast', 'no-defense', 'guard-burst'];
  const reports = strategies.map(strategy => runStrategy(strategy, 200));
  writeFileSync('docs/phase3-balance.json', JSON.stringify({ seedRange: [1, 200], note: 'All formulas known; one-turn greedy search, not human win rates.', reports }, null, 2));
  for (const report of reports) expect(report.stalled).toBe(0);
  expect(reports[0].wins).toBeGreaterThan(0);
  expect(reports[0].wins).toBeGreaterThan(reports[2].wins);
  expect(reports[0].wins).toBeGreaterThan(reports[3].wins);
  expect(reports[0].combos).toBeGreaterThan(0);
}, 180_000);
