import { simulateCast } from './engine';
import { availableReaction } from '../data/reactions';
import { matchRecipe } from './recipes';
import type { GameState } from './types';

/** Uses the exact engine, but stops after this cast and never mutates live state. */
export function previewSpell(state: GameState, ids: number[]) {
  const next = simulateCast(state, ids);
  if (next === state) return null;
  const spell = matchRecipe(ids.map(id => state.inventory.find(t => t.id === id)!.element));
  const reaction = spell ? availableReaction(state, spell.id) : undefined;
  const hits = next.events.filter(e => e.kind === 'damage' && e.target === 'enemy'), hit = hits[0];
  const ward = next.events.find(e => e.kind === 'shield' && e.target === 'player');
  if (hit) return { damage: hits.reduce((n, e) => n + (e.value ?? 0), 0), blocked: hits.reduce((n, e) => n + (e.blocked ?? 0), 0), combo: (hit.combo ?? 0) > 0, shield: 0, totalShield: 0, reaction, reactionShield: reaction === 'neutralization' ? 6 : 0, multiplier: hit.multiplier ?? 1 };
  if (ward) return { damage: 0, blocked: 0, combo: false, shield: ward.value ?? 0, totalShield: state.playerShield + (ward.value ?? 0), multiplier: 1 };
  return null;
}
