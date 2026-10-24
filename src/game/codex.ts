import { SPELLS } from '../data/spells';
import type { SpellId } from './types';
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
