import { SPELLS, type Spell } from '../data/spells';
import type { SpellId, Tile } from './types';

export function recipeIds(inventory: Tile[], spell: Spell): number[] | undefined {
  const ids: number[] = [];
  for (const [element, count] of Object.entries(spell.recipe)) {
    const tiles = inventory.filter(t => t.element === element).slice(0, count);
    if (tiles.length !== count) return undefined;
    ids.push(...tiles.map(t => t.id));
  }
  return ids;
}
/** Known and currently craftable only. Selection is a separate, reversible UI action. */
export function suggestions(inventory: Tile[], discoveries: SpellId[]) {
  return SPELLS.filter(spell => discoveries.includes(spell.id) && recipeIds(inventory, spell)).slice(0, 3);
}
