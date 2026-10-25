import type { DirectHit, Intent, TurnEffects } from './types';

/** Shared by the intent UI and execution; authored patterns remain immutable. */
export function adjustedIntent(intent: Intent, weaken = 0, vulnerable = false): Intent {
  const hits = directHits(intent).map(h => ({ ...h, value: Math.max(0, h.value - (weaken ? 3 : 0) + (vulnerable ? 3 : 0)) }));
  if (!hits.length) return intent;
  return { ...intent, value: hits.reduce((sum, h) => sum + h.value, 0), ...(intent.hits?.length ? { hits } : {}) };
}

export function directHits(intent: Intent): DirectHit[] {
  if (intent.type !== 'attack' && intent.type !== 'fire') return [];
  return (intent.hits?.length ? intent.hits : [{ type: intent.type, value: intent.value }]).map(hit => ({ ...hit, value: Math.max(0, hit.value) }));
}
export function intentDamageLabel(intent: Intent) {
  const hits = directHits(intent);
  return hits.length ? hits.map(hit => hit.value).join(' + ') : intent.value || '';
}
/** One enemy action: one shared ward; fire reduction and reflection each apply once. */
export function incomingAction(hp: number, shield: number, intent: Intent, effects: TurnEffects) {
  let fireReduction = Math.max(0, effects.fireReduction);
  const hits = directHits(intent).map(hit => {
    const reduction = hit.type === 'fire' ? fireReduction : 0;
    if (hit.type === 'fire') fireReduction = 0;
    const reduced = Math.max(0, hit.value - reduction);
    const blocked = Math.min(shield, reduced);
    shield -= blocked;
    const damage = Math.min(hp, reduced - blocked);
    hp -= damage;
    return { ...hit, blocked, damage, hp, shield, reduction: hit.value - reduced };
  });
  return { hits, reflect: hits.length ? Math.max(0, effects.reflect) : 0 };
}
