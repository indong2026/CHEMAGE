import { SPELLS } from '../data/spells';
import { REACTION_IDS } from '../data/reactions';
import { recipeIds } from './suggestions';
import type { ReactionId, SpellId, Tile } from './types';

export type HintLevel = 0 | 1 | 2 | 3;
export type HintProgress = { magic: Partial<Record<SpellId, HintLevel>>; reaction: Partial<Record<ReactionId, HintLevel>> };
export type HintTarget = { kind: 'magic'; id: SpellId } | { kind: 'reaction'; id: ReactionId };
export const HINTS_KEY = 'chemage.hints.v1';
export const emptyHints = (): HintProgress => ({ magic: {}, reaction: {} });
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
function sanitize(raw: unknown): HintProgress {
  const result = emptyHints();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const kind of ['magic', 'reaction'] as const) {
    const group = (raw as Record<string, unknown>)[kind];
    if (!group || typeof group !== 'object' || Array.isArray(group)) continue;
    const ids = kind === 'magic' ? SPELLS.map(s => s.id) : REACTION_IDS;
    for (const id of ids) {
      const level = (group as Record<string, unknown>)[id];
      if (typeof level === 'number' && Number.isInteger(level) && level >= 0 && level <= 3) (result[kind] as Record<string, HintLevel>)[id] = level as HintLevel;
    }
  }
  return result;
}
export function loadHints(storage?: StorageLike): HintProgress {
  try { return sanitize(JSON.parse((storage ?? window.localStorage).getItem(HINTS_KEY) ?? '{}')); } catch { return emptyHints(); }
}
export function saveHints(hints: HintProgress, storage?: StorageLike): boolean {
  try { (storage ?? window.localStorage).setItem(HINTS_KEY, JSON.stringify(sanitize(hints))); return true; } catch { return false; }
}
export function hintLevel(hints: HintProgress, target: HintTarget): HintLevel {
  return (target.kind === 'magic' ? hints.magic[target.id] : hints.reaction[target.id]) ?? 0;
}
/** At most one new level per click; this state has no battle/discovery side effects. */
export function revealHint(hints: HintProgress, target: HintTarget): HintProgress {
  return { ...hints, [target.kind]: { ...hints[target.kind], [target.id]: Math.min(3, hintLevel(hints, target) + 1) } };
}
/** One quiet suggestion, least-revealed first; stable recipe order breaks ties. */
export function discoverableSpell(inventory: Tile[], discoveries: SpellId[], hints: HintProgress) {
  return SPELLS.filter(s => !discoveries.includes(s.id) && recipeIds(inventory, s))
    .sort((a, b) => (hints.magic[a.id] ?? 0) - (hints.magic[b.id] ?? 0))[0];
}
