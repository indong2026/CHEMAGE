import type { DirectHit, Intent, TurnEffects } from './types';

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
