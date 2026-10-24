import { ELEMENTS, ELEMENT_KEYS } from '../data/elements';
import type { Element, Rng } from './types';
export function drawElement(rng: Rng): Element {
  const roll = rng();
  let cumulative = 0;
  for (const element of ELEMENT_KEYS) {
    cumulative += ELEMENTS[element].probability;
    if (roll < cumulative) return element;
  }
  return 'Fe';
}
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
/** Seeded RNG for reproducible tests and balance simulations. */
export function seededRng(seed: number): Rng {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
