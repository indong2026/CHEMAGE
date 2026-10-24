import type { CSSProperties } from 'react';
import { ENEMIES } from '../data/enemies';
import { SPELL_BY_ID } from '../data/spells';
import { isDangerous } from '../game/danger';
import { intentDamageLabel } from '../game/incoming';
import { enemyArmor } from '../game/engine';
import type { GameEvent, GameState, SpellId } from '../game/types';
import { Icon, LabBackground, Sprite } from './PixelArt';

export function HealthBar({ value, max, player = false }: { value: number; max: number; player?: boolean }) {
  return <div className={`health-bar ${player ? 'player-bar' : ''}`} role="meter" aria-label={player ? '내 체력' : '적 체력'} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><i style={{ width: `${Math.max(0, value / max * 100)}%` }} /><span>{value} <em>/ {max}</em></span></div>;
}
export function CombatScene({ game: g, event, eventIndex, busy, speed, detail }: { game: GameState; event: GameEvent | null; eventIndex: number; busy: boolean; speed: number; detail?: (title: string, text: string) => void }) {
  const enemy = ENEMIES[g.enemy.id];
  const danger = g.enemy.hp > 0 && isDangerous(g.enemy.intent);
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
  const strong = ['zero', 'methane', 'ironOxide'].includes(effect) || (incoming && (event?.value ?? 0) >= 18);
  const color = effect in SPELL_BY_ID ? SPELL_BY_ID[effect as SpellId].color : effect === 'zero' ? '#e3ffc7' : effect === 'enemy-fire' ? '#ff8b68' : incoming ? '#ffabc2' : '#b6dbff';
  const icon = { attack: 'sword', fire: 'fire', shield: 'shield', charge: 'spark', wait: 'wait' }[g.enemy.intent.type];
  const enemyHit = impact && event?.target === 'enemy';
  const playerHit = impact && event?.target === 'player';
  const status = [
    ...(enemyArmor(g) ? [{ name: '적 방어력', icon: 'shield', value: enemyArmor(g), text: '공격마다 이 수치만큼 피해를 줄입니다. NaCl은 방어력을 5 관통하고, HCl은 방어력을 3 낮춥니다.' }] : []),
    ...(g.enemy.shield ? [{ name: '적 보호막', icon: 'shield', value: g.enemy.shield, text: '마법 피해를 먼저 흡수합니다. ZERO BURST에도 적용되며 다음 적 행동 직전에 만료됩니다.' }] : []),
    ...(g.enemy.wet ? [{ name: '젖음', icon: 'drop', value: undefined, text: '다음 NaCl이 피해 +4를 주고 젖음을 소모합니다. 다음 플레이어 턴까지 유지됩니다.' }] : []),
    ...(g.enemy.acid ? [{ name: '부식', icon: 'flask', value: g.enemy.acid, text: '적 방어력이 3 감소합니다. 이 턴과 이후 2턴 동안 유지됩니다.' }] : []),
    ...(g.enemy.dot ? [{ name: '잔류 피해', icon: 'fire', value: g.enemy.dot, text: '적 행동 직전에 피해 4. 방어력과 보호막을 무시합니다. 숫자는 남은 횟수입니다.' }] : []),
    ...(g.boost ? [{ name: '옥시 강화', icon: 'spark', value: undefined, text: '다음 공격 마법 피해 +10. 방어나 ZERO BURST에는 소모되지 않습니다.' }] : []),
    ...(g.playerShield ? [{ name: '내 보호막', icon: 'shield', value: g.playerShield, text: '같은 턴의 보호막은 모두 합산됩니다. 피해를 먼저 흡수하며 적 행동이 끝나면 남은 보호막도 사라집니다. 화염 감소와 반사 효과는 각각 한 번만 적용합니다.' }] : []),
  ];
  return <section className={`combat-scene fx-${effect} cue-${event?.cue ?? 'idle'} ${busy ? 'playing' : ''} ${g.enemy.phase === 2 ? 'enraged' : ''} ${impact && strong ? 'heavy-impact' : ''}`} style={{ '--fx': color, '--rate': speed } as CSSProperties} aria-label="전투 공간">
    <LabBackground />
    <div className="combat-enemy-hud"><div><span className="eyebrow">{g.stage === 4 ? 'FINAL BOSS' : g.stage === 3 ? 'ELITE' : `ENCOUNTER 0${g.stage + 1}`}</span><h2>{enemy.name}{g.enemy.phase === 2 && <small>폭주</small>}</h2></div><HealthBar value={g.enemy.hp} max={enemy.hp} /></div>
    <div className={`combat-intent ${danger ? 'danger' : ''}`}><Icon name={danger ? 'warning' : icon} size={12} /><span>{danger ? <strong>강공격 준비!</strong> : busy ? '이번 적 행동' : '다음 행동'} <b>{g.enemy.intent.label} {intentDamageLabel(g.enemy.intent)}</b></span></div>
    <div className={`combat-mage ${launch && outgoing ? 'casting' : ''} ${playerHit && event?.value ? 'struck' : ''} ${playerHit && !event?.value && g.hp > 0 ? 'blocked-hit' : ''}`} key={`mage-${eventIndex}`}><div className="sprite-shadow" /><Sprite name="mage" />{(g.playerShield > 0 || (busy && event?.wardActive) || shieldHit || shieldEnding) && <div className={`persistent-ward ${shieldGain ? 'ward-gain' : ''} ${shieldHit ? 'ward-absorb' : ''} ${shieldEnding ? 'ward-fade' : ''}`} />}{shieldGain && <b className="shield-gain">+{event?.value}</b>}{g.boost && <div className="boost-orbit" />}{playerHit && <b className={`floating-hit ${event?.value ? '' : 'blocked'}`}>{event?.value ? `−${event.value}` : g.hp > 0 ? 'BLOCK!' : 'DOWN'}</b>}</div>
    <div className={`combat-enemy enemy-${g.enemy.id} ${danger && g.enemy.hp > 0 ? 'danger-aura' : ''} ${g.enemy.id === 'golem' ? 'boss' : ''} ${enemyHit ? 'struck hit-stop' : ''} ${launch && incoming ? 'enemy-windup' : ''} ${event?.kind === 'death' ? 'dying' : g.enemy.hp === 0 && !enemyHit ? 'vanished' : ''}`} key={`enemy-${eventIndex}`}><div className="sprite-shadow" /><Sprite name={g.enemy.id} />{event?.kind === 'death' && <div className="death-particles" aria-hidden="true">{Array.from({ length: g.enemy.id === 'golem' ? 18 : 12 }, (_, i) => <i key={i} style={{ '--angle': `${i * (g.enemy.id === 'golem' ? 20 : 30)}deg`, '--n': i } as CSSProperties} />)}</div>}{g.enemy.shield > 0 && <div className="enemy-ward" />}{enemyHit && <b className={`floating-hit ${effect === 'zero' ? 'burst-hit' : ''} ${!event?.value ? 'blocked' : ''}`}>{event?.value ? `−${event.value}` : 'BLOCK'}</b>}</div>
    {busy && <div key={`effect-${eventIndex}`} className={`combat-vfx ${incoming ? 'incoming' : 'outgoing'}`} aria-hidden="true">
      {launch && (outgoing || ['enemy-attack', 'enemy-fire'].includes(effect)) && <div className={`projectile-track ${strong ? 'strong' : ''}`}>{Array.from({ length: effect === 'salt' ? 5 : effect === 'ironOxide' ? 3 : 1 }, (_, i) => <i className="projectile" key={i} style={{ '--n': i } as CSSProperties} />)}</div>}
      {launch && effect === 'zero' && <div className="burst-gather">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--n': i } as CSSProperties} />)}</div>}
      {impact && <div className={`impact-cloud ${playerHit ? 'on-player' : 'on-enemy'}`}><div className="impact-core" /><div className="shockwave" />{Array.from({ length: strong ? 16 : 9 }, (_, i) => <i className="impact-pixel" key={i} style={{ '--n': i, '--angle': `${i * (strong ? 22.5 : 40)}deg` } as CSSProperties} />)}</div>}
      {(support || (launch && ['oxygen', 'enemy-charge', 'enemy-shield'].includes(effect))) && <div className={`support-ring ${event?.target === 'enemy' || incoming ? 'on-enemy' : 'on-player'}`}>{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--n': i } as CSSProperties} />)}</div>}
    </div>}
    {busy && effect === 'zero' && <div className="zero-title" key={`zero-${eventIndex}`}>ZERO BURST<span>마력 해방</span></div>}
    {busy && event?.kind === 'phase' && <div className="phase-banner">결정 폭주 <small>PHASE II</small></div>}
    <div className="status-icons" aria-label="전투 상태">{status.map(s => <button key={s.name} aria-label={`${s.name} 설명`} onClick={() => detail?.(s.name, s.text)}><Icon name={s.icon} size={13} />{s.value !== undefined && <b>{s.value}</b>}</button>)}</div>
    {impact && (event?.combo ?? 0) > 0 && <div className="combo-pop">COMBO! <b>+{event!.combo}</b></div>}
    <div className={`action-caption ${effect === 'zero' ? 'burst-caption' : ''}`} role="status" aria-live="polite"><span className="caption-index">{busy ? incoming ? 'ENEMY' : effect === 'zero' ? 'BURST' : 'MAGIC' : 'YOUR TURN'}</span><strong>{busy ? event?.text : '나의 차례'}</strong></div>
  </section>;
}


