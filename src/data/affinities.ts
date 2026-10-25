import type { Affinity } from '../game/types';

export const AFFINITIES: Record<Affinity, { name: string; icon: string; color: string }> = {
  WATER: { name: '물', icon: 'drop', color: '#8bddff' },
  FIRE: { name: '화염', icon: 'fire', color: '#ffad77' },
  METAL: { name: '금속', icon: 'shield', color: '#cbd3de' },
  CORROSION: { name: '부식', icon: 'flask', color: '#a7e8a0' },
  CRYSTAL: { name: '결정', icon: 'spark', color: '#d7b4ff' },
  NEUTRAL: { name: '중립', icon: 'circle', color: '#d8dbe4' },
};
// Attacking magic -> defending enemy. Unlisted relationships are neutral.
export const MATCHUPS: Partial<Record<Affinity, Partial<Record<Affinity, number>>>> = {
  WATER: { FIRE: 1.5, CRYSTAL: .75 },
  CORROSION: { METAL: 1.5 },
  METAL: { CRYSTAL: 1.5 },
  FIRE: { FIRE: .75 },
  CRYSTAL: { METAL: .75 },
};
export const multiplier = (attack: Affinity, defender: Affinity) => MATCHUPS[attack]?.[defender] ?? 1;
export function defenses(defender: Affinity) {
  const types = Object.keys(AFFINITIES) as Affinity[];
  return { weak: types.filter(t => multiplier(t, defender) > 1), resist: types.filter(t => multiplier(t, defender) < 1) };
}
