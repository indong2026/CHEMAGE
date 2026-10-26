export type Element = 'H' | 'O' | 'C' | 'Na' | 'Cl' | 'Fe' | 'N' | 'S';
export type Affinity = 'WATER' | 'FIRE' | 'METAL' | 'CORROSION' | 'CRYSTAL' | 'NEUTRAL';
export type SpellId = 'water' | 'salt' | 'carbon' | 'iron' | 'oxygen' | 'acid' | 'peroxide' | 'graphite' | 'methane' | 'ironOxide' | 'hydrogen' | 'alkali' | 'ferrous' | 'nitrogen' | 'ammonia' | 'nitro' | 'sulfide' | 'sulfur' | 'ironSulfide';
export type ReactionId = 'neutralization' | 'combustion' | 'crystallization' | 'ammonium';
export type EnemyId = 'slime' | 'beetle' | 'flame' | 'elite' | 'golem' | 'minion' | 'gel';
export type RewardId = 'bag' | 'water' | 'heal' | 'guard' | 'draw' | 'reaction' | 'research' | 'resonance';
export type Rng = () => number;
export type Tile = { id: number; element: Element };
export type DirectHit = { type: 'attack' | 'fire'; value: number };
export type Intent = { type: 'attack' | 'fire' | 'shield' | 'wait' | 'charge'; value: number; label: string; hits?: DirectHit[]; inflictVulnerable?: boolean; dangerous?: boolean };
export type Upgrades = { capacity: number; waterDamage: number; shieldBonus: number; draw: number; reactionBonus: number; research: boolean; resonance: Partial<Record<Element, number>> };
export type Effect = SpellId | ReactionId | 'overflow' | 'zero' | 'dot' | 'reflect' | 'enemy-attack' | 'enemy-fire' | 'enemy-acid' | 'enemy-charge' | 'enemy-shield' | 'enemy-wait' | 'phase' | 'heal' | 'death';
export type EnemyState = { id: EnemyId; hp: number; shield: number; wet: number; acid: number; dot: number; dotDamage?: number; mist?: boolean; phase: 1 | 2; intent: Intent; patternIndex: number; weaken?: number };
export type TurnEffects = { fireReduction: number; reflect: number; wetApplied: boolean; acidApplied: boolean };
/** Animation snapshots are data only. Rules never run from animation callbacks. */
export type BattleFrame = {
  hp: number; enemy: EnemyState; inventory: Tile[]; freshIds: number[]; reconstruction: number;
  boost: boolean; playerShield: number; turn: number; spellsUsed: number; mana: number; castHistory: SpellId[]; vulnerable: boolean;
};
export type GameEvent = {
  kind: 'damage' | 'shield' | 'spell' | 'enemy' | 'phase' | 'win' | 'info' | 'convert' | 'burst' | 'turn' | 'defeat' | 'death' | 'turn-banner' | 'ready' | 'shield-end' | 'reaction' | 'reconstruct-ready' | 'reconstruct';
  fromElement?: Element; toElement?: Element;
  text: string; value?: number; blocked?: number; target?: 'enemy' | 'player'; spell?: SpellId; freshSpell?: boolean;
  effect?: Effect; cue?: 'launch' | 'impact' | 'support' | 'system';
  reaction?: ReactionId; freshReaction?: boolean; shieldBonusDamage?: number; combo?: number; tiles?: Tile[]; frame?: BattleFrame;
  /** Keep the ward outline through an enemy action, then dissolve it once. */
  wardActive?: boolean;
  multiplier?: number; affinity?: Affinity; shieldBreak?: boolean;
  armorBefore?: number; armorAfter?: number; hitIndex?: number; hitCount?: number;
};
export type GameState = {
  screen: 'battle' | 'reward' | 'victory' | 'defeat';
  route: EnemyId[]; stage: number; turn: number; revision: number;
  hp: number; inventory: Tile[]; freshIds: number[]; nextId: number; pendingResonance: Element | null; reconstruction: number;
  boost: boolean; playerShield: number; spellsUsed: number; mana: number; turnEffects: TurnEffects;
  upgrades: Upgrades; enemy: EnemyState; rewards: RewardId[]; taken: RewardId[];
  discoveries: SpellId[]; reactionDiscoveries: ReactionId[]; castHistory: SpellId[]; vulnerable: boolean; researchTriggered: boolean; events: GameEvent[];
  stats: { turns: number; casts: number; defeated: number; bursts: number; converted: number; enemyActions: number; damage: number };
};
export type Action = { type: 'endTurn' | 'burst' } | { type: 'cast'; ids: number[] } | { type: 'reconstruct'; id: number };
