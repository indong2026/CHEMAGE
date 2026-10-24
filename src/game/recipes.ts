import { SPELLS } from '../data/spells';
import { ELEMENT_KEYS } from '../data/elements';
import type { Element } from './types';

/** A multiset comparison: order never matters; extra atoms invalidate a recipe. */
export function matchRecipe(elements: readonly Element[]) {
  const counts = new Map<Element, number>();
  elements.forEach(e => counts.set(e, (counts.get(e) ?? 0) + 1));
  return SPELLS.find(spell => ELEMENT_KEYS.every(e => (spell.recipe[e] ?? 0) === (counts.get(e) ?? 0)));
}
