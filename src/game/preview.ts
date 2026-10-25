import { simulateAction } from './engine';
import type { GameState } from './types';

/** Uses the exact engine, but stops after this cast and never mutates live state. */
export function previewSpell(state: GameState, ids: number[]) {
  const next = simulateAction({ ...state, spellsUsed: 0 }, { type: 'cast', ids }, () => .5);
  const hit = next.events.find(e => e.kind === 'damage' && e.target === 'enemy');
  const ward = next.events.find(e => e.kind === 'shield' && e.target === 'player');
  if (hit) return { damage: hit.value ?? 0, blocked: hit.blocked ?? 0, combo: (hit.combo ?? 0) > 0, shield: 0, totalShield: 0, multiplier: hit.multiplier ?? 1 };
  if (ward) return { damage: 0, blocked: 0, combo: false, shield: ward.value ?? 0, totalShield: state.playerShield + (ward.value ?? 0), multiplier: 1 };
  return null;
}
