import type { Element } from '../game/types';
export const ELEMENTS: Record<Element, { name: string; probability: number; color: string; number: number }> = {
  H: { name: '수소', probability: 0.30, color: '#9edbfa', number: 1 },
  O: { name: '산소', probability: 0.26, color: '#aab6ff', number: 8 },
  C: { name: '탄소', probability: 0.18, color: '#d2bddf', number: 6 },
  Na: { name: '나트륨', probability: 0.10, color: '#ffc28d', number: 11 },
  Cl: { name: '염소', probability: 0.10, color: '#a5e4a2', number: 17 },
  Fe: { name: '철', probability: 0.06, color: '#edb2a9', number: 26 },
};
export const ELEMENT_KEYS = Object.keys(ELEMENTS) as Element[];
