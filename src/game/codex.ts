import { SPELLS } from '../data/spells';
import { REACTION_IDS } from '../data/reactions';
import type { ReactionId, SpellId } from './types';
export const CODEX_KEY = 'chemage.discoveries.v1';
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export function loadDiscoveries(storage?: StorageLike): SpellId[] {
  try {
    const raw: unknown = JSON.parse((storage ?? window.localStorage).getItem(CODEX_KEY) ?? '[]');
    return Array.isArray(raw) ? SPELLS.filter(s => raw.includes(s.id)).map(s => s.id) : [];
  } catch { return []; }
}
export function saveDiscoveries(ids: SpellId[], storage?: StorageLike): boolean {
  try { (storage ?? window.localStorage).setItem(CODEX_KEY, JSON.stringify([...new Set(ids)])); return true; }
  catch { return false; }
}

export const REACTIONS_KEY = 'chemage.reactions.v1';
export const ADVENTURE_KEY = 'chemage.adventure-started.v1';
export function loadReactions(storage?: StorageLike): ReactionId[] {
  try { const raw: unknown = JSON.parse((storage ?? window.localStorage).getItem(REACTIONS_KEY) ?? '[]'); return Array.isArray(raw) ? REACTION_IDS.filter(id => raw.includes(id)) : []; } catch { return []; }
}
export function saveReactions(ids: ReactionId[], storage?: StorageLike) {
  try { (storage ?? window.localStorage).setItem(REACTIONS_KEY, JSON.stringify([...new Set(ids)])); return true; } catch { return false; }
}
export function hasAdventured() { try { return window.localStorage.getItem(ADVENTURE_KEY) === '1' || loadDiscoveries().length > 0; } catch { return false; } }
export function markAdventure() { try { window.localStorage.setItem(ADVENTURE_KEY, '1'); } catch { /* The current session still remembers. */ } }
