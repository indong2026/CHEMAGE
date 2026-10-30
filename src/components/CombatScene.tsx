import '../styles/bosses.css';
import type { CSSProperties } from 'react';
import { ENEMIES } from '../data/enemies';
import { SPELL_BY_ID } from '../data/spells';
import { isDangerous } from '../game/danger';
import { REACTIONS } from '../data/reactions';
import { adjustedIntent, intentDamageLabel } from '../game/incoming';
import { EnemyAffinity, EnemyStatus } from './CombatStatus';
import { AFFINITIES } from '../data/affinities';
import type { GameEvent, GameState, SpellId } from '../game/types';
import { Icon, LabBackground, Sprite } from './PixelArt';

export function HealthBar({ value, max, player = false }: { value: number; max: number; player?: boolean }) {
  return <div className={`health-bar ${player ? 'player-bar' : ''}`} role="meter" aria-label={player ? '내 체력' : '적 체력'} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><i style={{ width: `${Math.max(0, value / max * 100)}%` }} /><span>{value} <em>/ {max}</em></span></div>;
}
export function CombatScene({ game: g, event, eventIndex, busy, speed, detail }: { game: GameState; event: GameEvent | null; eventIndex: number; busy: boolean; speed: number; detail?: (title: string, text: string) => void }) {
  const enemy = ENEMIES[g.enemy.id];
  const boss = enemy.boss;
  const intent = adjustedIntent(g.enemy.intent, g.enemy.weaken, g.vulnerable, g.enemy.mist);
  const pattern = g.enemy.phase === 2 ? enemy.phase2 ?? enemy.pattern : enemy.pattern;
  const following = intent.type === 'charge' ? pattern[(g.enemy.patternIndex + 1) % pattern.length] : undefined;
  const reaction = busy && event?.kind === 'reaction' && event.reaction ? REACTIONS[event.reaction] : null;
  const danger = g.enemy.hp > 0 && isDangerous(intent);
  const shieldGain = busy && event?.kind === 'shield' && event.target === 'player';
  const shieldHit = busy && event?.kind === 'damage' && event.target === 'player' && (event.blocked ?? 0) > 0;
  const shieldEnding = busy && event?.kind === 'shield-end';
  const effect = event?.effect ?? '';
  const impact = busy && event?.cue === 'impact';
  const launch = busy && event?.cue === 'launch';
  const incoming = effect.startsWith('enemy-');
  const support = busy && event?.cue === 'support';
  const attackingSpell = effect in SPELL_BY_ID && SPELL_BY_ID[effect as SpellId].attack;
  const outgoing = !incoming && (attackingSpell || ['zero'].includes(effect));
  const strong = ['zero', 'methane', 'ironOxide', 'ironSulfide'].includes(effect) || (incoming && (danger || (event?.value ?? 0) >= 18));
  const color = effect in SPELL_BY_ID ? SPELL_BY_ID[effect as SpellId].color : effect === 'neutralization' ? '#9ef0cb' : effect === 'enemy-acid' ? '#a0ef8e' : effect === 'zero' ? '#e3ffc7' : effect === 'enemy-fire' ? '#ff8b68' : incoming ? '#ffabc2' : '#b6dbff';
  const icon = { attack: 'sword', fire: 'fire', shield: 'shield', charge: 'spark', wait: 'wait' }[intent.type];
  const enemyHit = impact && event?.target === 'enemy';
  const playerHit = impact && event?.target === 'player';

  return <section className={`combat-scene boss-fx-${boss?.animation ?? "none"} fx-${effect} reaction-${event?.reaction ?? 'none'} cue-${event?.cue ?? 'idle'} ${busy ? 'playing' : ''} ${g.enemy.phase === 2 ? 'enraged' : ''} ${impact && strong ? 'heavy-impact' : ''} ${impact && (event?.multiplier ?? 1) > 1 ? 'super-effective' : ''} ${impact && (event?.multiplier ?? 1) < 1 ? 'resisted-hit' : ''}`} style={{ '--fx': color, '--rate': speed } as CSSProperties} aria-label="전투 공간">
    <LabBackground />
    <div className="combat-enemy-hud"><div><span className="eyebrow">{g.stage === 4 ? 'FINAL BOSS' : g.stage === 3 ? 'ELITE' : `ENCOUNTER 0${g.stage + 1}`}</span><h2>{enemy.name}{g.enemy.phase === 2 && <small>폭주</small>}</h2></div><EnemyAffinity game={g} detail={detail} /><HealthBar value={g.enemy.hp} max={enemy.hp} /></div>
    <EnemyStatus game={g} detail={detail} />
    <div className={`combat-intent ${danger ? 'danger' : ''}`}><Icon name={danger ? 'warning' : icon} size={12} /><span>{danger ? <strong>강공격 준비!</strong> : busy && incoming ? '이번 적 행동' : '다음 행동'} <b>{intent.hits?.length ? `${intent.hits.length}연타` : intent.label} {intentDamageLabel(intent)}{following && ['fire','attack'].includes(following.type) && ` → 다음 공격 ${intentDamageLabel(following)}`}</b></span></div>
    <div className={`combat-mage ${launch && outgoing ? 'casting' : ''} ${playerHit && event?.value ? 'struck' : ''} ${playerHit && !event?.value && g.hp > 0 ? 'blocked-hit' : ''}`} key={`mage-${eventIndex}`}><div className="sprite-shadow" /><Sprite name="mage" />{(g.playerShield > 0 || (busy && event?.wardActive) || shieldHit || shieldEnding) && <div className={`persistent-ward ${shieldGain ? 'ward-gain' : ''} ${shieldHit ? 'ward-absorb' : ''} ${shieldEnding ? 'ward-fade' : ''}`} />}{shieldGain && <b className="shield-gain">+{event?.value}</b>}{g.boost && <div className="boost-orbit" />}{playerHit && <b className={`floating-hit ${event?.value ? '' : 'blocked'}`}>{event?.value ? `−${event.value}` : g.hp > 0 ? 'BLOCK!' : 'DOWN'}</b>}</div>
    <div className={`combat-enemy enemy-${g.enemy.id} ${danger && g.enemy.hp > 0 ? 'danger-aura' : ''} ${!!boss ? 'boss' : ''} ${enemyHit ? 'struck hit-stop' : ''} ${launch && incoming ? 'enemy-windup' : ''} ${intent.type === 'charge' ? 'charging' : ''} ${event?.kind === 'death' ? 'dying' : g.enemy.hp === 0 && !enemyHit ? 'vanished' : ''}`} key={`enemy-${eventIndex}`}><div className="sprite-shadow" /><Sprite name={g.enemy.id} />{g.enemy.id === 'inferno' && <div className="core-embers" aria-hidden="true"><i/><i/><i/><i/></div>}{event?.kind === 'death' && <div className="death-particles" aria-hidden="true">{Array.from({ length: !!boss ? 18 : 12 }, (_, i) => <i key={i} style={{ '--angle': `${i * (!!boss ? 20 : 30)}deg`, '--n': i } as CSSProperties} />)}</div>}{g.enemy.shield > 0 && <div className="enemy-ward" />}{enemyHit && <b className={`floating-hit ${effect === 'zero' ? 'burst-hit' : ''} ${!event?.value ? 'blocked' : ''} ${(event?.multiplier ?? 1) > 1 ? 'effective-number' : ''} ${(event?.multiplier ?? 1) < 1 ? 'resisted-number' : ''}`}>{event?.value ? `−${event.value}` : 'BLOCK'}</b>}</div>
    {busy && <div key={`effect-${eventIndex}`} className={`combat-vfx ${incoming ? 'incoming' : 'outgoing'}`} aria-hidden="true">
      {launch && (outgoing || ['enemy-attack', 'enemy-fire', 'enemy-acid'].includes(effect)) && <div className={`projectile-track ${strong ? 'strong' : ''}`}>{Array.from({ length: effect === 'salt' ? 5 : effect === 'ironOxide' ? 3 : 1 }, (_, i) => <i className="projectile" key={i} style={{ '--n': i } as CSSProperties} />)}</div>}
      {launch && effect === 'zero' && <div className="burst-gather">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--n': i } as CSSProperties} />)}</div>}
      {impact && <div className={`impact-cloud ${playerHit ? 'on-player' : 'on-enemy'}`}><div className="impact-core" /><div className="shockwave" />{Array.from({ length: strong ? 16 : 9 }, (_, i) => <i className="impact-pixel" key={i} style={{ '--n': i, '--angle': `${i * (strong ? 22.5 : 40)}deg` } as CSSProperties} />)}</div>}
      {(support || (launch && ['oxygen', 'enemy-charge', 'enemy-shield'].includes(effect))) && <div className={`support-ring ${event?.target === 'enemy' || incoming ? 'on-enemy' : 'on-player'}`}>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--n': i } as CSSProperties} />)}</div>}
    </div>}
    {reaction && <div className={'reaction-flash reaction-' + event?.reaction} role="status" style={{ '--reaction': '#E9B94E' } as CSSProperties}><span><Icon name="link" size={13}/> REACTION</span><b>{reaction.name}!</b>{reaction.equation && <small>{reaction.equation}</small>}<small>{event?.reaction === 'crystallization'?'젖음 소비 · 추가 피해 +4':event?.reaction==='combustion'?'공격 강화 +10':event?.reaction==='ammonium'?'추가 중립 피해 +5':`추가 중립 피해 +${8+g.upgrades.reactionBonus} · 보호막 +6`}</small><i /><i /><i /><i /></div>}
    {busy && effect === 'zero' && <div className="zero-title" key={`zero-${eventIndex}`}>ZERO BURST<span>마력 해방</span></div>}
    {busy && event?.kind === 'phase' && <div className="phase-banner">{boss?.phaseTitle ?? '결정 폭주'} <small>{boss?.english} · PHASE II</small></div>}
    <div className="impact-notes">
    {impact && event?.multiplier !== undefined && event.multiplier !== 1 && <div className={`affinity-feedback ${event.multiplier > 1 ? 'advantage' : 'resistance'}`} style={{ color: event.affinity ? AFFINITIES[event.affinity].color : undefined }}>{event.multiplier > 1 ? '효과가 굉장하다!' : '효과가 별로다…'}</div>}
    {impact && event?.armorBefore !== undefined && event.armorBefore !== event.armorAfter && <div className="armor-change">방어력 {event.armorBefore} → {event.armorAfter}</div>}
    {impact && !playerHit && (event?.blocked ?? 0) > 0 && <div className={`absorb-feedback ${playerHit ? 'on-mage' : 'on-enemy'}`}>보호막 −{event?.blocked}</div>}
    </div>
    {impact && playerHit && (event?.blocked ?? 0) > 0 && <div className="absorb-feedback on-mage">보호막 −{event?.blocked}</div>}
    {impact && event?.shieldBreak && <div className={`shield-break ${playerHit ? 'on-mage' : 'on-enemy'}`}><i />SHIELD BREAK!</div>}
    {busy && (event?.hitCount ?? 0) > 1 && <div className="hit-counter">{event?.hitIndex}/{event?.hitCount} 타격</div>}
    {impact && (event?.combo ?? 0) > 0 && <div className="combo-pop">COMBO! <b>+{event!.combo}</b></div>}
    {event?.kind !== 'reconstruct' && event?.kind !== 'reconstruct-ready' && <div className={`action-caption ${effect === 'zero' ? 'burst-caption' : ''}`} role="status" aria-live="polite"><span className="caption-index">{busy ? incoming ? 'ENEMY' : effect === 'zero' ? 'BURST' : 'MAGIC' : 'YOUR TURN'}</span><strong>{busy ? event?.text : '나의 차례'}</strong></div>}
  </section>;
}


