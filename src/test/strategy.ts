import { SPELLS } from '../data/spells';
import { chooseReward, newGame, simulateAction } from '../game/engine';
import { seededRng } from '../game/random';
import { recipeIds } from '../game/suggestions';
import type { Action, GameState } from '../game/types';
export type Strategy = 'two-casts' | 'one-cast' | 'no-defense' | 'guard-burst';
export function candidates(s: GameState, strategy: Strategy): Action[] {
  const actions: Action[] = [{ type: 'endTurn' }];
  if (strategy !== 'no-defense') actions.push({ type: 'guard' });
  if (s.mana === 100) actions.push({ type: 'burst' });
  if (strategy === 'guard-burst' || (strategy === 'one-cast' && s.spellsUsed > 0)) return actions;
  for (const spell of SPELLS) {
    if (strategy === 'no-defense' && ['carbon', 'iron', 'graphite'].includes(spell.id)) continue;
    const ids = recipeIds(s.inventory, spell);
    if (ids) actions.push({ type: 'cast', ids });
  }
  return actions;
}
function score(before: GameState, after: GameState, cost: number) {
  if (after.screen === 'defeat') return -10000;
  if (after.screen === 'reward' || after.screen === 'victory') return 10000 + after.hp * 2 + after.mana * .08;
  return (before.enemy.hp - after.enemy.hp) * 1.6 + (after.hp - before.hp) * 2
    + (Number(after.boost) - Number(before.boost)) * 8
    + (after.enemy.acid - before.enemy.acid) * 1.4 + (after.enemy.dot - before.enemy.dot) * 3
    + (after.enemy.wet - before.enemy.wet) * .6 + (after.mana - before.mana) * .16 - cost * .7;
}
export function chooseAction(s: GameState, strategy: Strategy): Action {
  let best: Action = { type: 'endTurn' }, bestScore = -Infinity;
  for (const action of candidates(s, strategy)) {
    const after = simulateAction(s, action, () => .5), cost = action.type === 'cast' ? action.ids.length : 0;
    let value = score(s, after, cost);
    if (after.screen === 'battle' && after.turn === s.turn) {
      // Evaluate the one remaining immediate action; no hidden future draw is inspected.
      value = Math.max(...candidates(after, strategy).map(second => score(s, simulateAction(after, second, () => .5), cost + (second.type === 'cast' ? second.ids.length : 0))));
    }
    if (value > bestScore) { bestScore = value; best = action; }
  }
  return best;
}
export function runStrategy(strategy: Strategy, runs: number) {
  const report = { strategy, runs, wins: 0, defeats: 0, stalled: 0, turns: 0, casts: 0, bursts: 0, conversions: 0, combos: 0, defenseActions: 0, stageTurns: [0, 0, 0, 0, 0], stageVisits: [0, 0, 0, 0, 0], losses: [0, 0, 0, 0, 0], firstTurnKills: 0, winningSeeds: [] as number[] };
  for (let seed = 1; seed <= runs; seed++) {
    const rng = seededRng(seed); let s = newGame(rng); report.stageVisits[0]++;
    for (let step = 0; step < 320 && s.screen !== 'victory' && s.screen !== 'defeat'; step++) {
      if (s.screen === 'reward') {
        const priority = [s.hp < 35 ? 'heal' : 'water', 'water', 'draw', 'guard', 'bag', 'heal'];
        s = chooseReward(s, [...s.rewards].sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0], rng);
        report.stageVisits[s.stage]++; continue;
      }
      const before = s; s = simulateAction(s, chooseAction(s, strategy), rng);
      report.stageTurns[before.stage] += s.stats.turns - before.stats.turns;
      report.combos += s.events.filter(e => (e.combo ?? 0) > 0).length;
      if (s.events.some(e => e.kind === 'shield' && e.target === 'player')) report.defenseActions++;
      if (s.stats.defeated > before.stats.defeated && before.turn === 1) report.firstTurnKills++;
    }
    report.turns += s.stats.turns; report.casts += s.stats.casts; report.bursts += s.stats.bursts; report.conversions += s.stats.converted;
    if (s.screen === 'victory') { report.wins++; if (report.winningSeeds.length < 10) report.winningSeeds.push(seed); }
    else if (s.screen === 'defeat') { report.defeats++; report.losses[s.stage]++; }
    else report.stalled++;
  }
  return report;
}
