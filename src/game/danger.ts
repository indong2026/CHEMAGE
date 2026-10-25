import type { Intent } from './types';
import { directHits } from './incoming';

/** Charge is preparatory only. Never substitute a future attack for the current intent. */
export function isDangerous(intent: Intent) {
  const hits = directHits(intent);
  return (hits.length > 0 && intent.dangerous === true) || hits.reduce((sum, hit) => sum + hit.value, 0) >= 18 || hits.some(hit => hit.type === 'fire' && hit.value >= 16);
}
