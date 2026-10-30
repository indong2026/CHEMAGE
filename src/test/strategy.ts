import { ELEMENT_KEYS } from '../data/elements';
import { REACTION_IDS } from '../data/reactions';
import { SPELLS } from '../data/spells';
import { chooseReward, newGame, simulateAction } from '../game/engine';
import { seededRng } from '../game/random';
import { recipeIds } from '../game/suggestions';
import type { Action, BossId, GameState, Tile } from '../game/types';
export const craftableIds = (tiles: Tile[]) => SPELLS.filter(spell => recipeIds(tiles,spell)).map(s=>s.id);
/** Uses the visible hand and all seven possible outcomes, never the future RNG. */
export function reconstructionChoice(s: GameState): number | undefined {
  if (s.reconstruction !== 100 || !s.inventory.length) return;
  const before=craftableIds(s.inventory).length;
  let bestGain=0, choice:number|undefined;
  for(const element of new Set(s.inventory.map(t=>t.element))){
    const tile=s.inventory.find(t=>t.element===element)!;
    const gain=ELEMENT_KEYS.filter(e=>e!==element).reduce((sum,e)=>sum+craftableIds(s.inventory.map(t=>t.id===tile.id?{...t,element:e}:t)).length-before,0)/7;
    if(gain>bestGain+.00001){bestGain=gain;choice=tile.id;}
  }
  return choice;
}
export type Strategy = 'attack' | 'affinity' | 'shield' | 'mixed' | 'reaction' | 'stockpile' | 'burst';
export function candidates(s: GameState, strategy: Strategy): Action[] {
  const actions: Action[] = [{ type: 'endTurn' }];
  if (s.mana === 100) actions.push({ type: 'burst' });
  for (const spell of SPELLS) {
    if (strategy === 'shield' && spell.attack) continue;
    const ids = recipeIds(s.inventory, spell); if (ids) actions.push({ type: 'cast', ids });
  }
  return actions;
}
function score(before: GameState, after: GameState, cost: number, strategy: Strategy, events = after.events) {
  if (after.screen === 'defeat') return -10000;
  if (after.screen === 'reward' || after.screen === 'victory') return 10000 + after.hp * 2 + after.mana * .08;
  // Attack baseline values nominal damage, while affinity evaluates actual matchup damage.
  // Neither strategy reads hidden future draws. Mixed uses the same actual evaluation plus defense choices.
  let damage = before.enemy.hp - after.enemy.hp;
  if (strategy === 'attack') for (const e of events) {
    if (e.target === 'enemy' && e.kind === 'damage' && e.multiplier && e.multiplier !== 1) damage += (e.value ?? 0) / e.multiplier - (e.value ?? 0);
  }
  return damage * 1.6 + (after.hp - before.hp) * (strategy === 'attack' || strategy === 'affinity' ? 1.2 : 2.5)
    + (Number(after.boost) - Number(before.boost)) * 8
    + (after.enemy.acid - before.enemy.acid) * 1.4 + (after.enemy.dot - before.enemy.dot) * 3
    + (strategy === 'reaction' ? events.filter(e => e.kind === 'reaction').length * 7 : 0)
    + (strategy === 'stockpile' ? Math.min(8, after.inventory.length) * .3 : 0)
    + (after.enemy.wet - before.enemy.wet) * .6 + (after.mana - before.mana) * (strategy === 'burst' ? .65 : .16) - cost * (strategy === 'stockpile' ? 1.7 : .7);
}
export function chooseAction(s: GameState, strategy: Strategy, excluded: string[] = []): Action {
  const allowed = (state: GameState) => candidates(state, strategy).filter(a => a.type !== 'cast' || !excluded.some(id => {const spell=SPELLS.find(s=>s.id===id); const ids=spell && recipeIds(state.inventory,spell); return ids && ids.length===a.ids.length && ids.every(id=>a.ids.includes(id));}));
  let best: Action = { type: 'endTurn' }, bestScore = -Infinity;
  for (const action of allowed(s)) {
    const after = simulateAction(s, action, () => .5), cost = action.type === 'cast' ? action.ids.length : 0;
    let value = score(s, after, cost, strategy);
    if (after.screen === 'battle' && after.turn === s.turn) value = Math.max(...allowed(after).map(second => {
      const final = simulateAction(after, second, () => .5);
      return score(s, final, cost + (second.type === 'cast' ? second.ids.length : 0), strategy, [...after.events, ...final.events]);
    }));
    if (value > bestScore) { bestScore = value; best = action; }
  }
  return best;
}
export function runStrategy(strategy: Strategy, runs: number, reconstruction = true, boss: BossId = 'golem') {
  const report = { strategy, runs, wins: 0, defeats: 0, stalled: 0, turns: 0, casts: 0, bursts: 0, conversions: 0, combos: 0, effectiveHits: 0, resistedHits: 0, defenseActions: 0, stageTurns: [0, 0, 0, 0, 0], stageVisits: [0, 0, 0, 0, 0], losses: [0, 0, 0, 0, 0], firstTurnKills: 0, resonanceStarts: [0,0,0,0,0], invalidResonanceStarts: 0, reactions: Object.fromEntries(REACTION_IDS.map(id => [id, 0])), spellUsage: Object.fromEntries(SPELLS.map(s => [s.id, 0])), enemyVisits: {} as Record<string, number>, winningSeeds: [] as number[] };
  const metrics={reconstruction,uses:0,newSpellOpportunities:0,craftableBefore:0,craftableAfter:0,decisionSamples:0,craftableSum:0,emptyRecipeTurnEnds:0,turnEnds:0,newSpellCasts:0,strandedTileRounds:0,tileRounds:0,opportunities:Object.fromEntries(SPELLS.map(s=>[s.id,0]))};
  for (let seed = 1; seed <= runs; seed++) {
    const reconstructionRng=seededRng(seed+50000),ages=new Map<number,number>();
    const rng = seededRng(seed); let s = newGame(rng, { firstAdventure: false, boss }); report.stageVisits[0]++; report.enemyVisits[s.enemy.id] = (report.enemyVisits[s.enemy.id] ?? 0) + 1;
    for (let step = 0; step < 320 && s.screen !== 'victory' && s.screen !== 'defeat'; step++) {
      if (s.screen === 'reward') {
        const priority = [s.hp < 35 ? 'heal' : 'water', 'draw', 'guard', 'reaction', 'water', 'resonance', 'research', 'bag', 'heal'];
        const element = ELEMENT_KEYS.find(e => (s.upgrades.resonance[e] ?? 1) < 2);
        const reward = [...s.rewards].sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0];
        s = chooseReward(s, reward, rng, element);
        if(reward==='resonance'){report.resonanceStarts[s.stage]++;if(s.inventory.length!==5||s.inventory.filter(t=>t.element===element).length<2||s.pendingResonance!==null)report.invalidResonanceStarts++;}
        report.stageVisits[s.stage]++; report.enemyVisits[s.enemy.id] = (report.enemyVisits[s.enemy.id] ?? 0) + 1; continue;
      }
      const reconstructId=reconstruction ? reconstructionChoice(s) : undefined;
      if(reconstructId!==undefined){
        const beforeIds=craftableIds(s.inventory);s=simulateAction(s,{type:'reconstruct',id:reconstructId},reconstructionRng);
        const afterIds=craftableIds(s.inventory);metrics.uses++;metrics.craftableBefore+=beforeIds.length;metrics.craftableAfter+=afterIds.length;
        if(afterIds.some(id=>!beforeIds.includes(id)))metrics.newSpellOpportunities++;
      }
      const available=craftableIds(s.inventory);metrics.decisionSamples++;metrics.craftableSum+=available.length;for(const id of available)metrics.opportunities[id]++;
      const before = s,action=chooseAction(s,strategy);s = simulateAction(s, action, rng);
      if(action.type==='endTurn'){metrics.turnEnds++;if(!available.length)metrics.emptyRecipeTurnEnds++;}
      if(s.turn!==before.turn){for(const tile of before.inventory){const age=(ages.get(tile.id)??0)+1;ages.set(tile.id,age);metrics.tileRounds++;if(age>=3&&!SPELLS.some(spell=>spell.recipe[tile.element]&&recipeIds(before.inventory,spell)))metrics.strandedTileRounds++;}}
      report.stageTurns[before.stage] += s.stats.turns - before.stats.turns;
      for (const e of s.events) { if (e.kind === 'reaction' && e.reaction) report.reactions[e.reaction]++; if (e.kind === 'spell' && e.spell) {report.spellUsage[e.spell]++;if(['nitrogen','ammonia','nitro','sulfide','sulfur','ironSulfide'].includes(e.spell))metrics.newSpellCasts++;} }
      report.combos += s.events.filter(e => (e.combo ?? 0) > 0).length;
      report.effectiveHits += s.events.filter(e => (e.multiplier ?? 1) > 1).length;
      report.resistedHits += s.events.filter(e => (e.multiplier ?? 1) < 1).length;
      if (s.events.some(e => e.kind === 'shield' && e.target === 'player')) report.defenseActions++;
      if (s.stats.defeated > before.stats.defeated && before.turn === 1) report.firstTurnKills++;
    }
    report.turns += s.stats.turns; report.casts += s.stats.casts; report.bursts += s.stats.bursts; report.conversions += s.stats.converted;
    if (s.screen === 'victory') { report.wins++; if (report.winningSeeds.length < 10) report.winningSeeds.push(seed); }
    else if (s.screen === 'defeat') { report.defeats++; report.losses[s.stage]++; }
    else report.stalled++;
  }
  return {...report,metrics};
}
