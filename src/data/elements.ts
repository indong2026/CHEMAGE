import type { Element } from '../game/types';
export const ELEMENTS: Record<Element, { name: string; probability: number; color: string; number: number }> = {
  H: { name: '수소', probability: 0.29, color: '#9edbfa', number: 1 },
  O: { name: '산소', probability: 0.23, color: '#aab6ff', number: 8 },
  C: { name: '탄소', probability: 0.13, color: '#d2bddf', number: 6 },
  Na: { name: '나트륨', probability: 0.09, color: '#ffc28d', number: 11 },
  Cl: { name: '염소', probability: 0.09, color: '#a5e4a2', number: 17 },
  Fe: { name: '철', probability: 0.05, color: '#edb2a9', number: 26 },
  N: { name: '질소', probability: 0.06, color: '#74dedb', number: 7 },
  S: { name: '황', probability: 0.06, color: '#efd275', number: 16 },
};
export const ELEMENT_KEYS = Object.keys(ELEMENTS) as Element[];
