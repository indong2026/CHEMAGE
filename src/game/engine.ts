import { BALANCE as B } from '../data/balance';
import { ENEMIES } from '../data/enemies';
import { REWARDS } from '../data/rewards';
import { matchRecipe } from './recipes';
import { drawElement, shuffle } from './random';
import { multiplier } from '../data/affinities';
import { SPELL_BY_ID } from '../data/spells';
import { incomingAction } from './incoming';
import type { Action, BattleFrame, Effect, Element, EnemyId, GameEvent, GameState, RewardId, Rng, Tile, TurnEffects } from './types';

export const enemyArmor = (s: GameState) => Math.max(0, ENEMIES[s.enemy.id].armor - (s.enemy.acid > 0 ? B.acid.reduction : 0));
const emptyEffects = (): TurnEffects => ({ fireReduction: 0, reflect: 0, wetApplied: false, acidApplied: false });
export function battleFrame(s: GameState): BattleFrame {
  return { hp: s.hp, enemy: { ...s.enemy, intent: { ...s.enemy.intent, ...(s.enemy.intent.hits ? { hits: s.enemy.intent.hits.map(hit => ({ ...hit })) } : {}) } }, inventory: s.inventory.map(t => ({ ...t })), freshIds: [...s.freshIds], boost: s.boost, playerShield: s.playerShield, turn: s.turn, spellsUsed: s.spellsUsed, mana: s.mana };
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
  s.enemy = { id, hp: ENEMIES[id].hp, shield: 0, wet: 0, acid: 0, dot: 0, phase: 1, intent: { ...ENEMIES[id].pattern[0] }, patternIndex: 0 };
  s.screen = 'battle'; s.turn = 1; s.spellsUsed = 0; s.boost = false; s.playerShield = 0; s.turnEffects = emptyEffects();
  s.inventory = []; s.freshIds = []; s.rewards = []; s.events = [];
  const starter: Element[] = s.stage === 0 ? ['H', 'H', 'O'] : [];
  while (starter.length < B.startElements) starter.push(drawElement(rng));
  acquire(s, starter);
  return s;
}
export function newGame(rng: Rng = Math.random): GameState {
  const route: EnemyId[] = ['slime', ...shuffle<EnemyId>(['beetle', 'flame'], rng), 'elite', 'golem'];
  return startBattle({
    screen: 'battle', route, stage: 0, turn: 1, revision: 0, hp: B.maxHp,
    inventory: [], freshIds: [], nextId: 1, boost: false, playerShield: 0, spellsUsed: 0, mana: 0, turnEffects: emptyEffects(), enemy: {} as GameState['enemy'],
    upgrades: { capacity: B.capacity, waterDamage: 0, shieldBonus: 0, draw: B.draw },
    rewards: [], taken: [], discoveries: [], events: [],
    stats: { turns: 0, casts: 0, defeated: 0, bursts: 0, converted: 0, enemyActions: 0, damage: 0 },
  }, rng);
}
function copyState(s: GameState): GameState {
  return { ...s, enemy: { ...s.enemy, intent: { ...s.enemy.intent, ...(s.enemy.intent.hits ? { hits: s.enemy.intent.hits.map(hit => ({ ...hit })) } : {}) } }, inventory: [...s.inventory], freshIds: [...s.freshIds], turnEffects: { ...s.turnEffects }, upgrades: { ...s.upgrades }, discoveries: [...s.discoveries], taken: [...s.taken], stats: { ...s.stats }, events: [] };
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
function resolveAction(state: GameState, action: Action, revision: number, rng: Rng, frames: boolean): GameState {
  if (state.screen !== 'battle' || state.revision !== revision) return state;
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
    if (s.hp <= 0) { s.screen = 'defeat'; s.boost = false; s.playerShield = 0; s.turnEffects = emptyEffects(); emit({ kind: 'defeat', cue: 'system', text: '다시 도전할 수 있어요' }); return true; }
    if (s.enemy.hp > 0) return false;
    s.playerShield = 0; s.turnEffects = emptyEffects();
    emit({ kind: 'death', cue: 'system', effect: 'death', target: 'enemy', text: `${ENEMIES[s.enemy.id].name} 격파!` });
    s.stats.defeated++; s.boost = false;
    const healed = Math.min(B.victoryHeal, B.maxHp - s.hp); s.hp += healed;
    s.screen = s.stage === 4 ? 'victory' : 'reward';
    s.rewards = s.screen === 'reward' ? shuffle(REWARDS.map(r => r.id), rng).slice(0, 3) : [];
    emit({ kind: 'win', cue: 'support', effect: 'heal', target: 'player', value: healed, text: `전투 승리 · 체력 +${healed}` }); return true;
  };
  const strike = (raw: number, effect: Effect, pierce = 0, ignoreShield = false, combo = 0) => {
    const magic = effect in SPELL_BY_ID ? SPELL_BY_ID[effect as keyof typeof SPELL_BY_ID] : undefined;
    const scale = magic?.attack ? multiplier(magic.affinity, ENEMIES[s.enemy.id].affinity) : 1;
    const result = hurtEnemy(s, Math.floor(raw * scale), pierce, ignoreShield);
    emit({ kind: 'damage', cue: 'impact', target: 'enemy', effect, ...result, combo, multiplier: scale, affinity: magic?.affinity, text: combo ? `COMBO! +${combo}` : result.value ? `${result.value} 피해` : '방어막에 막혔어요' });
  };
  if (action.type === 'cast' && spell) {
    s.inventory = s.inventory.filter(t => !action.ids.includes(t.id)); s.freshIds = s.freshIds.filter(id => !action.ids.includes(id));
    s.spellsUsed++; s.stats.casts++; s.mana = Math.min(B.manaMax, s.mana + B.castMana);
    if (!s.discoveries.includes(spell.id)) s.discoveries.push(spell.id);
    emit({ kind: 'spell', cue: 'launch', spell: spell.id, effect: spell.id, text: `${spell.display} · ${spell.name}` });
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
      case 'peroxide': raw = B.peroxide.damage; s.enemy.dot = B.dotTicks; break;
      case 'methane': raw = B.methane.damage; break;
      case 'ironOxide': raw = B.ironOxide.damage; break;
      case 'oxygen': s.boost = true; emit({ kind: 'info', cue: 'support', effect: spell.id, target: 'player', text: '다음 공격 마법 +10' }); break;
      case 'carbon': s.playerShield += B.carbon.shield + s.upgrades.shieldBonus; s.turnEffects.fireReduction = B.carbon.fireReduction; break;
      case 'iron': s.playerShield += B.iron.shield + s.upgrades.shieldBonus; break;
      case 'graphite': s.playerShield += B.graphite.shield + s.upgrades.shieldBonus; s.turnEffects.reflect = B.graphite.reflect; break;
    }
    if (raw > 0) strike(raw + bonus, spell.id, pierce, false, combo);
    if (spell.id === 'carbon' || spell.id === 'iron' || spell.id === 'graphite') emit({ kind: 'shield', cue: 'support', effect: spell.id, target: 'player', value: B[spell.id].shield + s.upgrades.shieldBonus, text: `보호막 +${B[spell.id].shield + s.upgrades.shieldBonus}` });
    if (ended() || s.spellsUsed < B.spellsPerTurn) return s;
  } else if (action.type === 'burst') {
    s.mana -= B.manaMax; s.stats.bursts++;
    emit({ kind: 'burst', cue: 'launch', effect: 'zero', text: 'ZERO BURST!' });
    strike(B.zeroDamage, 'zero', Infinity);
    if (ended()) return s;
  }
  emit({ kind: 'turn', cue: 'system', target: 'enemy', text: '적의 차례' });
  if (s.enemy.dot > 0) { s.enemy.dot--; strike(B.peroxide.dot, 'dot', Infinity, true); if (ended()) return s; }
  s.enemy.shield = 0;
  const intent = s.enemy.intent;
  const effect: Effect = `enemy-${intent.type === 'attack' ? 'attack' : intent.type === 'fire' ? 'fire' : intent.type}`;
  const hadShield = s.playerShield > 0;
  wardActive = hadShield;
  s.stats.enemyActions++;
  if (intent.type === 'attack' || intent.type === 'fire') {
    const incoming = incomingAction(s.hp, s.playerShield, intent, s.turnEffects);
    for (const [hitIndex, hit] of incoming.hits.entries()) {
      const shieldBefore = s.playerShield;
      const hitEffect: Effect = hit.type === 'fire' ? 'enemy-fire' : 'enemy-attack';
      emit({ kind: 'enemy', cue: 'launch', effect: hitEffect, value: hit.value, hitIndex: hitIndex + 1, hitCount: incoming.hits.length, target: 'player', text: `${intent.label} ${hit.value}` });
      s.hp = hit.hp; s.playerShield = hit.shield;
      emit({ kind: 'damage', cue: 'impact', effect: hitEffect, target: 'player', value: hit.damage, blocked: hit.blocked, shieldBreak: shieldBefore > 0 && hit.shield === 0, hitIndex: hitIndex + 1, hitCount: incoming.hits.length, text: hit.damage ? `피격! −${hit.damage}${hit.blocked ? ` · ${hit.blocked} 방어` : ''}` : s.hp ? 'BLOCK! 완전 방어' : '전투 불능' });
    }
    if (incoming.reflect > 0) strike(incoming.reflect, 'reflect', Infinity, true);
  } else {
    emit({ kind: 'enemy', cue: 'launch', effect, value: intent.value, target: 'player', text: `${intent.label}${intent.value ? ` ${intent.value}` : ''}` });
    if (intent.type === 'shield') {
      s.enemy.shield = intent.value; emit({ kind: 'shield', cue: 'support', effect, target: 'enemy', value: intent.value, text: `적 보호막 ${intent.value}` });
    } else emit({ kind: 'info', cue: 'support', effect, target: 'enemy', text: intent.type === 'charge' ? '다음 강공격을 준비해요' : '적이 숨을 고릅니다' });
  }
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
  s.turn++; s.spellsUsed = 0; s.freshIds = [];
  const draw = acquire(s, Array.from({ length: s.upgrades.draw }, () => drawElement(rng)));
  emit({ kind: 'turn', cue: 'system', target: 'player', text: '나의 차례', value: s.upgrades.draw - draw.tiles.length });
  if (draw.tiles.length) emit({ kind: 'convert', cue: 'support', effect: 'overflow', target: 'player', tiles: draw.tiles, value: draw.gained, text: `초과 ${draw.tiles.length}개 → 마력 +${draw.gained}` });
  return s;
}
export function performAction(state: GameState, action: Action, revision: number, rng: Rng = Math.random): GameState {
  return resolveAction(state, action, revision, rng, true);
}
export function simulateAction(state: GameState, action: Action, rng: Rng): GameState {
  return resolveAction(state, action, state.revision, rng, false);
}
export function chooseReward(state: GameState, id: RewardId, rng: Rng = Math.random): GameState {
  if (state.screen !== 'reward' || !state.rewards.includes(id)) return state;
  const reward = REWARDS.find(r => r.id === id); if (!reward) return state;
  const s = copyState(state);
  if (reward.stat) s.upgrades[reward.stat] += reward.amount;
  else s.hp = Math.min(B.maxHp, s.hp + reward.amount);
  s.taken.push(id); s.stage++; s.revision++;
  return startBattle(s, rng);
}
