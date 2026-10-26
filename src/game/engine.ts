import { BALANCE as B } from '../data/balance';
import { ENEMIES } from '../data/enemies';
import { REWARDS } from '../data/rewards';
import { matchRecipe } from './recipes';
import { drawElement, shuffle, reconstructElement } from './random';
import { multiplier } from '../data/affinities';
import { SPELL_BY_ID } from '../data/spells';
import { incomingAction, adjustedIntent } from './incoming';
import { availableReaction, REACTIONS } from '../data/reactions';
import { ELEMENT_KEYS } from '../data/elements';
import type { Action, BattleFrame, Effect, Element, EnemyId, GameEvent, GameState, RewardId, ReactionId, SpellId, Rng, Tile, TurnEffects } from './types';

export const enemyArmor = (s: GameState) => Math.max(0, ENEMIES[s.enemy.id].armor - (s.enemy.acid > 0 ? B.acid.reduction : 0));
const emptyEffects = (): TurnEffects => ({ fireReduction: 0, reflect: 0, wetApplied: false, acidApplied: false });
export function battleFrame(s: GameState): BattleFrame {
  return { hp: s.hp, reconstruction: s.reconstruction, enemy: { ...s.enemy, intent: { ...s.enemy.intent, ...(s.enemy.intent.hits ? { hits: s.enemy.intent.hits.map(hit => ({ ...hit })) } : {}) } }, inventory: s.inventory.map(t => ({ ...t })), freshIds: [...s.freshIds], boost: s.boost, playerShield: s.playerShield, turn: s.turn, spellsUsed: s.spellsUsed, mana: s.mana, castHistory: [...s.castHistory], vulnerable: s.vulnerable };
}
/** Only new incoming tiles can overflow. Saved inventory is never discarded. */
function acquire(s: GameState, elements: Element[]) {
  const converted: Tile[] = [];
  for (const element of elements) {
    const tile = { id: s.nextId++, element };
    if (s.inventory.length < s.upgrades.capacity) { s.inventory.push(tile); s.freshIds.push(tile.id); }
    else converted.push(tile);
  }
  const before = s.mana;
  s.mana = Math.min(B.manaMax, s.mana + converted.length * B.overflowMana);
  s.stats.converted += converted.length;
  return { tiles: converted, gained: s.mana - before };
}
function startBattle(s: GameState, rng: Rng): GameState {
  const id = s.route[s.stage];
  s.enemy = { id, hp: ENEMIES[id].hp, shield: 0, wet: 0, acid: 0, dot: 0, phase: 1, intent: { ...ENEMIES[id].pattern[0] }, patternIndex: 0, weaken: 0 };
  s.screen = 'battle'; s.turn = 1; s.spellsUsed = 0; s.boost = false; s.playerShield = 0; s.turnEffects = emptyEffects(); s.castHistory = []; s.vulnerable = false; s.researchTriggered = false;
  s.inventory = []; s.freshIds = []; s.rewards = []; s.events = [];
  const starter: Element[] = s.pendingResonance ? [s.pendingResonance, s.pendingResonance] : s.stage === 0 && s.enemy.id === 'slime' ? ['H', 'H', 'O'] : [];
  s.pendingResonance = null; // One next-battle reservation, consumed before random draws.
  while (starter.length < B.startElements) starter.push(drawElement(rng, s.upgrades.resonance));
  acquire(s, starter);
  return s;
}
export function newGame(rng: Rng = Math.random, options: { firstAdventure?: boolean; discoveries?: SpellId[]; reactions?: ReactionId[] } = {}): GameState {
  const pool: EnemyId[] = ['slime', 'beetle', 'flame', 'minion', 'gel'];
  const normals = options.firstAdventure === false ? shuffle(pool, rng).slice(0, 3) : ['slime' as EnemyId, ...shuffle(pool.slice(1), rng).slice(0, 2)];
  const route: EnemyId[] = [...normals, 'elite', 'golem'];
  return startBattle({
    screen: 'battle', route, stage: 0, turn: 1, revision: 0, hp: B.maxHp, reconstruction: 0,
    inventory: [], freshIds: [], nextId: 1, pendingResonance: null, boost: false, playerShield: 0, spellsUsed: 0, mana: 0, turnEffects: emptyEffects(), enemy: {} as GameState['enemy'],
    upgrades: { capacity: B.capacity, waterDamage: 0, shieldBonus: 0, draw: B.draw, reactionBonus: 0, research: false, resonance: {} },
    rewards: [], taken: [], discoveries: [...(options.discoveries ?? [])], reactionDiscoveries: [...(options.reactions ?? [])], castHistory: [], vulnerable: false, researchTriggered: false, events: [],
    stats: { turns: 0, casts: 0, defeated: 0, bursts: 0, converted: 0, enemyActions: 0, damage: 0 },
  }, rng);
}
function copyState(s: GameState): GameState {
  return { ...s, enemy: { ...s.enemy, intent: { ...s.enemy.intent, ...(s.enemy.intent.hits ? { hits: s.enemy.intent.hits.map(hit => ({ ...hit })) } : {}) } }, inventory: [...s.inventory], freshIds: [...s.freshIds], turnEffects: { ...s.turnEffects }, upgrades: { ...s.upgrades, resonance: { ...s.upgrades.resonance } }, castHistory: [...s.castHistory], reactionDiscoveries: [...s.reactionDiscoveries], discoveries: [...s.discoveries], taken: [...s.taken], stats: { ...s.stats }, events: [] };
}
function hurtEnemy(s: GameState, raw: number, pierce = 0, ignoreShield = false) {
  let damage = Math.max(0, raw - Math.max(0, enemyArmor(s) - pierce));
  const blocked = ignoreShield ? 0 : Math.min(s.enemy.shield, damage);
  s.enemy.shield -= blocked; damage -= blocked;
  const shieldBreak = blocked > 0 && s.enemy.shield === 0;
  const value = Math.min(s.enemy.hp, damage);
  s.enemy.hp = Math.max(0, s.enemy.hp - damage); s.stats.damage += value;
  return { value, blocked, shieldBreak };
}
/** One immediate command, one revision. A first cast does NOT resolve the enemy turn. */
function resolveAction(state: GameState, action: Action, revision: number, rng: Rng, frames: boolean, castOnly = false): GameState {
  if (state.screen !== 'battle' || state.revision !== revision) return state;
  // Enemy turns resolve atomically. The UI locks all commands while their frames play.
  if (action.type === 'reconstruct') {
    const tile = state.inventory.find(t => t.id === action.id);
    if (!tile || state.reconstruction !== 100 || state.spellsUsed >= B.spellsPerTurn) return state;
    const s = copyState(state), element = reconstructElement(tile.element, rng);
    const replacement = { id: s.nextId++, element };
    s.inventory = s.inventory.map(t => t.id === tile.id ? replacement : t);
    s.freshIds = [...s.freshIds.filter(id => id !== tile.id), replacement.id];
    s.reconstruction = 0; s.revision++;
    s.events.push({ kind: 'reconstruct', cue: 'system', text: '원소 재구성 성공!', fromElement: tile.element, toElement: element, ...(frames ? { frame: battleFrame(s) } : {}) });
    return s;
  }
  let spell;
  if (action.type === 'cast') {
    if (state.spellsUsed >= B.spellsPerTurn || action.ids.length > B.maxSlots || new Set(action.ids).size !== action.ids.length || action.ids.some(id => !state.inventory.some(t => t.id === id))) return state;
    spell = matchRecipe(action.ids.map(id => state.inventory.find(t => t.id === id)!.element));
    if (!spell) return state;
  } else if (action.type === 'burst') { if (state.mana < B.manaMax) return state; }
  else if (action.type !== 'endTurn') return state;
  const s = copyState(state);
  s.revision++;
  if (s.spellsUsed === 0) s.stats.turns++;
  let wardActive = false;
  const emit = (event: GameEvent) => s.events.push({ ...event, wardActive, ...(frames ? { frame: battleFrame(s) } : {}) });
  const ended = () => {
    if (s.hp <= 0 || s.enemy.hp <= 0) wardActive = false;
    if (s.hp <= 0) { s.screen = 'defeat'; s.boost = false; s.playerShield = 0; s.turnEffects = emptyEffects(); s.vulnerable = false; s.enemy.weaken = 0; s.enemy.mist = false; s.castHistory = []; emit({ kind: 'defeat', cue: 'system', text: '다시 도전할 수 있어요' }); return true; }
    if (s.enemy.hp > 0) return false;
    s.playerShield = 0; s.turnEffects = emptyEffects(); s.vulnerable = false; s.enemy.weaken = 0; s.enemy.mist = false; s.castHistory = [];
    emit({ kind: 'death', cue: 'system', effect: 'death', target: 'enemy', text: `${ENEMIES[s.enemy.id].name} 격파!` });
    s.stats.defeated++; s.boost = false;
    const healed = Math.min(B.victoryHeal, B.maxHp - s.hp); s.hp += healed;
    s.screen = s.stage === 4 ? 'victory' : 'reward';
    s.rewards = s.screen === 'reward' ? shuffle(eligibleRewards(s), rng).slice(0, 3) : [];
    emit({ kind: 'win', cue: 'support', effect: 'heal', target: 'player', value: healed, text: `전투 승리 · 체력 +${healed}` }); return true;
  };
  const strike = (raw: number, effect: Effect, pierce = 0, ignoreShield = false, combo = 0, shieldBonusDamage = 0) => {
    const magic = effect in SPELL_BY_ID ? SPELL_BY_ID[effect as keyof typeof SPELL_BY_ID] : undefined;
    const scale = magic?.attack ? multiplier(magic.affinity, ENEMIES[s.enemy.id].affinity) : 1;
    const extra = Math.min(s.enemy.shield, shieldBonusDamage), hadShield = s.enemy.shield > 0;
    s.enemy.shield -= extra;
    const result = hurtEnemy(s, Math.floor(raw * scale), pierce, ignoreShield);
    result.blocked += extra; result.shieldBreak = hadShield && s.enemy.shield === 0;
    emit({ kind: 'damage', cue: 'impact', target: 'enemy', effect, ...result, shieldBonusDamage: extra, combo, multiplier: scale, affinity: magic?.affinity, reaction: magic ? availableReaction(state, magic.id) : undefined, text: combo ? `COMBO! +${combo}` : result.value ? `${result.value} 피해` : '방어막에 막혔어요' });
  };
  if (action.type === 'cast' && spell) {
    s.inventory = s.inventory.filter(t => !action.ids.includes(t.id)); s.freshIds = s.freshIds.filter(id => !action.ids.includes(id));
    s.spellsUsed++; s.stats.casts++; s.mana = Math.min(B.manaMax, s.mana + B.castMana);
    const reaction = availableReaction(state, spell.id);
    const freshSpell = !s.discoveries.includes(spell.id);
    if (freshSpell) { s.discoveries.push(spell.id); research(s, emit); }
    s.castHistory.push(spell.id);
    emit({ kind: 'spell', cue: 'launch', spell: spell.id, freshSpell, effect: spell.id, text: `${spell.display} · ${spell.name}` });
    const react = (id: ReactionId) => {
      const freshReaction = !s.reactionDiscoveries.includes(id);
      if (freshReaction) s.reactionDiscoveries.push(id);
      emit({ kind: 'reaction', cue: 'support', effect: id, reaction: id, freshReaction, text: REACTIONS[id].name + '!' });
      if (freshReaction) research(s, emit);
    };
    const bonus = spell.attack && s.boost ? B.oxygen.boost : 0;
    if (spell.attack) s.boost = false;
    let raw = 0, pierce = 0, combo = bonus;
    switch (spell.id) {
      case 'water': raw = B.water.damage + s.upgrades.waterDamage; s.enemy.wet = B.wetDuration; s.turnEffects.wetApplied = true; break;
      case 'salt':
        raw = B.salt.damage; pierce = B.salt.pierce;
        if (s.enemy.wet > 0) { raw += B.salt.wetBonus; combo += B.salt.wetBonus; s.enemy.wet = 0; }
        break;
      case 'acid': {
        const scale = multiplier(spell.affinity, ENEMIES[s.enemy.id].affinity), armorBefore = enemyArmor(s);
        const result = hurtEnemy(s, Math.floor((B.acid.damage + bonus) * scale));
        s.enemy.acid = B.acidDuration; s.turnEffects.acidApplied = true;
        emit({ kind: 'damage', cue: 'impact', target: 'enemy', effect: spell.id, ...result, combo: bonus, multiplier: scale, affinity: spell.affinity, armorBefore, armorAfter: enemyArmor(s), text: bonus ? `COMBO! +${bonus}` : '부식! 방어력이 낮아졌어요' }); break;
      }
      case 'peroxide': raw = B.peroxide.damage; s.enemy.dot = B.dotTicks; s.enemy.dotDamage = B.peroxide.dot; break;
      case 'nitro': raw = B.nitro.damage; s.enemy.dot = B.dotTicks; s.enemy.dotDamage = B.nitro.dot; break;
      case 'nitrogen': s.playerShield += B.nitrogen.shield + s.upgrades.shieldBonus; s.mana = Math.min(B.manaMax, s.mana + B.nitrogen.mana); break;
      case 'ammonia': raw = B.ammonia.damage; s.enemy.mist = true; break;
      case 'sulfide': raw = B.sulfide.damage; s.playerShield += B.sulfide.shield + s.upgrades.shieldBonus; break;
      case 'sulfur': raw = B.sulfur.damage; if (s.enemy.wet > 0) { raw += B.sulfur.wetBonus; combo += B.sulfur.wetBonus; s.enemy.wet = 0; } break;
      case 'ironSulfide': raw = B.ironSulfide.damage; pierce = B.ironSulfide.pierce; break;
      case 'hydrogen': raw = B.hydrogen.damage; break;
      case 'alkali': raw = B.alkali.damage; break;
      case 'ferrous': raw = B.ferrous.damage; s.enemy.weaken = 1; break;
      case 'methane': raw = B.methane.damage; break;
      case 'ironOxide': raw = B.ironOxide.damage; break;
      case 'oxygen': s.boost = true; emit({ kind: 'info', cue: 'support', effect: spell.id, target: 'player', text: '다음 공격 마법 +10' }); break;
      case 'carbon': s.playerShield += B.carbon.shield + s.upgrades.shieldBonus; s.turnEffects.fireReduction = B.carbon.fireReduction; break;
      case 'iron': s.playerShield += B.iron.shield + s.upgrades.shieldBonus; break;
      case 'graphite': s.playerShield += B.graphite.shield + s.upgrades.shieldBonus; s.turnEffects.reflect = B.graphite.reflect; break;
    }
    if (reaction && reaction !== 'neutralization' && reaction !== 'ammonium') react(reaction);
    if (raw > 0) strike(raw + bonus, spell.id, pierce, false, combo, spell.id === 'hydrogen' ? B.hydrogen.shieldDamage : spell.id === 'alkali' ? B.alkali.shieldDamage : 0);
    if (spell.id === 'carbon' || spell.id === 'iron' || spell.id === 'graphite' || spell.id === 'nitrogen' || spell.id === 'sulfide') emit({ kind: 'shield', cue: 'support', effect: spell.id, target: 'player', value: B[spell.id].shield + s.upgrades.shieldBonus, text: `보호막 +${B[spell.id].shield + s.upgrades.shieldBonus}${spell.id === 'nitrogen' ? ' · 마력 +8' : ''}` });
    if (reaction === 'ammonium') { react(reaction); strike(B.ammonium.damage, reaction); }
    if (reaction === 'neutralization') {
      react(reaction); strike(B.neutralization.damage + s.upgrades.reactionBonus, reaction);
      s.playerShield += B.neutralization.shield;
      emit({ kind: 'shield', cue: 'support', effect: reaction, target: 'player', value: B.neutralization.shield, text: '중화 보호막 +6' });
    }
    if (ended() || castOnly || s.spellsUsed < B.spellsPerTurn) return s;
  } else if (action.type === 'burst') {
    s.mana -= B.manaMax; s.stats.bursts++;
    emit({ kind: 'burst', cue: 'launch', effect: 'zero', text: 'ZERO BURST!' });
    strike(B.zeroDamage, 'zero', Infinity);
    if (ended()) return s;
  }
  emit({ kind: 'turn', cue: 'system', target: 'enemy', text: '적의 차례' });
  if (s.enemy.dot > 0) { s.enemy.dot--; strike(s.enemy.dotDamage ?? B.peroxide.dot, 'dot', Infinity, true); if (ended()) return s; }
  s.enemy.shield = 0;
  const intent = adjustedIntent(s.enemy.intent, s.enemy.weaken ?? 0, s.vulnerable, s.enemy.mist);
  const effect: Effect = `enemy-${intent.type === 'attack' ? 'attack' : intent.type === 'fire' ? 'fire' : intent.type}`;
  const hadShield = s.playerShield > 0;
  wardActive = hadShield;
  s.stats.enemyActions++;
  if (intent.type === 'attack' || intent.type === 'fire') {
    const incoming = incomingAction(s.hp, s.playerShield, intent, s.turnEffects);
    for (const [hitIndex, hit] of incoming.hits.entries()) {
      const shieldBefore = s.playerShield;
      const hitEffect: Effect = intent.inflictVulnerable ? 'enemy-acid' : hit.type === 'fire' ? 'enemy-fire' : 'enemy-attack';
      emit({ kind: 'enemy', cue: 'launch', effect: hitEffect, value: hit.value, hitIndex: hitIndex + 1, hitCount: incoming.hits.length, target: 'player', text: `${intent.label} ${hit.value}` });
      s.hp = hit.hp; s.playerShield = hit.shield;
      emit({ kind: 'damage', cue: 'impact', effect: hitEffect, target: 'player', value: hit.damage, blocked: hit.blocked, shieldBreak: shieldBefore > 0 && hit.shield === 0, hitIndex: hitIndex + 1, hitCount: incoming.hits.length, text: hit.damage ? `피격! −${hit.damage}${hit.blocked ? ` · ${hit.blocked} 방어` : ''}` : s.hp ? 'BLOCK! 완전 방어' : '전투 불능' });
    }
    s.vulnerable = !!intent.inflictVulnerable;
    if (incoming.reflect > 0) strike(incoming.reflect, 'reflect', Infinity, true);
  } else {
    emit({ kind: 'enemy', cue: 'launch', effect, value: intent.value, target: 'player', text: `${intent.label}${intent.value ? ` ${intent.value}` : ''}` });
    if (intent.type === 'shield') {
      s.enemy.shield = intent.value; emit({ kind: 'shield', cue: 'support', effect, target: 'enemy', value: intent.value, text: `적 보호막 ${intent.value}` });
    } else emit({ kind: 'info', cue: 'support', effect, target: 'enemy', text: intent.type === 'charge' ? '다음 강공격을 준비해요' : '적이 숨을 고릅니다' });
  }
  s.enemy.weaken = 0; s.enemy.mist = false;
  if (ended()) return s;
  if (!s.turnEffects.wetApplied) s.enemy.wet = Math.max(0, s.enemy.wet - 1);
  if (!s.turnEffects.acidApplied) s.enemy.acid = Math.max(0, s.enemy.acid - 1);
  s.playerShield = 0; s.turnEffects = emptyEffects();
  if (hadShield) emit({ kind: 'shield-end', cue: 'system', target: 'player', text: '적 행동 종료 · 보호막 해제' });
  wardActive = false;
  const data = ENEMIES[s.enemy.id];
  if (data.phaseThreshold && s.enemy.hp <= data.phaseThreshold && s.enemy.phase === 1) {
    s.enemy.phase = 2; s.enemy.patternIndex = 0;
    emit({ kind: 'phase', cue: 'system', effect: 'phase', text: '결정 폭주!' });
  } else s.enemy.patternIndex++;
  const pattern = s.enemy.phase === 2 ? data.phase2! : data.pattern;
  s.enemy.intent = { ...pattern[s.enemy.patternIndex % pattern.length] };
  s.turn++; s.spellsUsed = 0; s.castHistory = []; s.freshIds = [];
  const reconstructionBefore = s.reconstruction;
  s.reconstruction = Math.min(100, s.reconstruction + B.reconstructionCharge);
  const draw = acquire(s, Array.from({ length: s.upgrades.draw }, () => drawElement(rng, s.upgrades.resonance)));
  emit({ kind: 'turn', cue: 'system', target: 'player', text: '나의 차례', value: s.upgrades.draw - draw.tiles.length });
  if (draw.tiles.length) emit({ kind: 'convert', cue: 'support', effect: 'overflow', target: 'player', tiles: draw.tiles, value: draw.gained, text: `초과 ${draw.tiles.length}개 → 마력 +${draw.gained}` });
  if (reconstructionBefore < 100 && s.reconstruction === 100) emit({ kind: 'reconstruct-ready', cue: 'system', text: '원소 재구성을 사용할 수 있습니다!' });
  return s;
}
export function performAction(state: GameState, action: Action, revision: number, rng: Rng = Math.random): GameState {
  return resolveAction(state, action, revision, rng, true);
}
export function simulateAction(state: GameState, action: Action, rng: Rng): GameState {
  return resolveAction(state, action, state.revision, rng, false);
}
export function simulateCast(state: GameState, ids: number[]): GameState {
  return resolveAction(state, { type: 'cast', ids }, state.revision, () => .5, false, true);
}
export function chooseReward(state: GameState, id: RewardId, rng: Rng = Math.random, element?: Element): GameState {
  if (state.screen !== 'reward' || !state.rewards.includes(id) || !eligibleRewards(state).includes(id)) return state;
  if (id === 'resonance' && (!element || !ELEMENT_KEYS.includes(element) || (state.upgrades.resonance[element] ?? 1) >= 2)) return state;
  const reward = REWARDS.find(r => r.id === id); if (!reward) return state;
  const s = copyState(state);
  if (reward.stat) s.upgrades[reward.stat] += reward.amount;
  else if (id === 'research') s.upgrades.research = true;
  else if (id === 'resonance' && element) {
    s.upgrades.resonance[element] = Math.min(2, (s.upgrades.resonance[element] ?? 1) + .5);
    s.pendingResonance = element;
  }
  else s.hp = Math.min(B.maxHp, s.hp + reward.amount);
  s.taken.push(id); s.stage++; s.revision++;
  return startBattle(s, rng);
}

export function eligibleRewards(s: GameState): RewardId[] {
  return REWARDS.filter(r => r.id === 'reaction' ? s.upgrades.reactionBonus < 6 : r.id === 'research' ? !s.upgrades.research : r.id === 'resonance' ? ELEMENT_KEYS.some(e => (s.upgrades.resonance[e] ?? 1) < 2) : true).map(r => r.id);
}
function research(s: GameState, emit: (e: GameEvent) => void) {
  if (!s.upgrades.research || s.researchTriggered) return;
  s.researchTriggered = true; const gain = Math.min(20, 100 - s.mana); s.mana += gain;
  emit({ kind: 'info', cue: 'support', effect: 'overflow', target: 'player', value: gain, text: '화학 연구 · 마력 +' + gain });
}
