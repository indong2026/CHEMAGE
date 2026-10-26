import { ELEMENTS, ELEMENT_KEYS } from '../data/elements';
import type { Element, Rng } from './types';
export function elementProbabilities(resonance: Partial<Record<Element, number>> = {}) {
  const weights = ELEMENT_KEYS.map(e => ELEMENTS[e].probability * Math.min(2, Math.max(1, resonance[e] ?? 1)));
  const total = weights.reduce((a, b) => a + b, 0);
  return Object.fromEntries(ELEMENT_KEYS.map((e, i) => [e, weights[i] / total])) as Record<Element, number>;
}
export function drawElement(rng: Rng, resonance: Partial<Record<Element, number>> = {}): Element {
  const probabilities = elementProbabilities(resonance);
  const roll = rng();
  let cumulative = 0;
  for (const element of ELEMENT_KEYS) {
    cumulative += probabilities[element];
    if (roll < cumulative) return element;
  }
  return ELEMENT_KEYS[ELEMENT_KEYS.length - 1];
}
/** Independent of drop weights and resonance: seven equally likely alternatives. */
export function reconstructElement(from: Element, rng: Rng): Element {
  const candidates = ELEMENT_KEYS.filter(e => e !== from);
  return candidates[Math.min(candidates.length - 1, Math.max(0, Math.floor(rng() * candidates.length)))];
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
