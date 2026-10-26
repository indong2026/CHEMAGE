import { AFFINITIES, defenses } from '../data/affinities';
import { ENEMIES } from '../data/enemies';
import { enemyArmor } from '../game/engine';
import type { GameState } from '../game/types';
import { Icon } from './PixelArt';

type Props = { game: GameState; detail?: (title: string, text: string) => void };
export function EnemyAffinity({ game, detail }: Props) {
  const type = ENEMIES[game.enemy.id].affinity, info = AFFINITIES[type], { weak, resist } = defenses(type);
  return <div className="enemy-affinities">
    <button style={{ color: info.color }} aria-label={`적 속성 ${info.name}`} onClick={() => detail?.(`${info.name} 속성`, `약점: ${weak.map(t => AFFINITIES[t].name).join(', ') || '없음'} (1.5배)\n저항: ${resist.map(t => AFFINITIES[t].name).join(', ') || '없음'} (0.75배)\n표시되지 않은 관계는 중립입니다. 게임의 판타지 전투 설정입니다.`)}><Icon name={info.icon} size={13} /><span>{info.name}</span></button>
    {weak.map(t => <button key={t} className="weakness" style={{ color: AFFINITIES[t].color }} aria-label={`약점 ${AFFINITIES[t].name}`} onClick={() => detail?.('약점', `${AFFINITIES[t].name} 직접 공격 마법은 1.5배. 방어력과 보호막은 이후 적용합니다.`)}>↑<Icon name={AFFINITIES[t].icon} size={13} /></button>)}
    {resist.map(t => <button key={t} className="resistance" style={{ color: AFFINITIES[t].color }} aria-label={`저항 ${AFFINITIES[t].name}`} onClick={() => detail?.('저항', `${AFFINITIES[t].name} 직접 공격 마법은 0.75배입니다.`)}>↓<Icon name={AFFINITIES[t].icon} size={13} /></button>)}
  </div>;
}
export function EnemyStatus({ game: g, detail }: Props) {
  const statuses = [
    ...(g.enemy.weaken || g.enemy.mist ? [{ name: '공격 약화', icon: 'sword', value: g.enemy.weaken ? 3 : 2, style: 'weak', text: '이번 적 행동의 각 직접 타격 피해 감소. 여러 약화는 강한 효과 하나만 적용하며 이번 행동 후 사라집니다.' }] : []),
    ...(enemyArmor(g) ? [{ name: '적 방어력', icon: 'shield', value: enemyArmor(g), style: 'armor', text: '직접 공격마다 피해를 줄입니다. NaCl은 5 관통, 부식은 현재 방어력을 3 낮춥니다.' }] : []),
    ...(g.enemy.shield ? [{ name: '적 보호막', icon: 'shield', value: g.enemy.shield, style: 'ward', text: '방어력 적용 후 피해를 흡수하는 임시 보호막. ZERO BURST에도 적용하며 다음 적 행동 직전에 만료됩니다.' }] : []),
    ...(g.enemy.wet ? [{ name: '젖음', icon: 'drop', value: g.enemy.wet, style: 'wet', text: '다음 NaCl 또는 SO₂ 피해 +4. 연계 시 소모하며 다음 플레이어 턴까지 유지합니다.' }] : []),
    ...(g.enemy.acid ? [{ name: '부식', icon: 'flask', value: g.enemy.acid, style: 'acid', text: '현재 방어력 −3. 숫자는 이후 남은 턴입니다. 시전한 턴의 경계에서는 감소하지 않습니다.' }] : []),
    ...(g.enemy.dot ? [{ name: '잔류 피해', icon: 'fire', value: g.enemy.dot, style: 'dot', text: `적 행동 시작에 피해 ${g.enemy.dotDamage ?? 4}. 숫자는 남은 횟수. 마지막 시전으로 피해와 횟수를 갱신하며 상성, 방어력, 보호막을 무시합니다.` }] : []),
  ];
  return <div className="enemy-battle-status" aria-label="적 전투 상태">{statuses.map(s => <button key={s.name} className={s.style} aria-label={`${s.name} 설명`} onClick={() => detail?.(s.name, s.text)}><Icon name={s.icon} size={13} />{s.style === 'armor' ? '방어력' : s.style === 'ward' ? '보호막' : ''} <b>{s.value}</b></button>)}</div>;
}
export function PlayerStatus({ game: g, detail }: Props) {
  if (!g.playerShield && !g.boost && !g.vulnerable) return null;
  return <div className="player-battle-status" aria-label="플레이어 전투 상태">
    {g.vulnerable && <button className="vulnerable" aria-label="취약 설명" onClick={() => detail?.('취약', '다음 적 직접 공격 행동의 피해 +3. 충전·방어 중에는 유지되며 직접 공격 후 소멸합니다. 중첩되지 않습니다.')}><Icon name="flask" size={13} />피해 +3</button>}
    {g.playerShield > 0 && <button className="ward" aria-label="내 보호막 설명" onClick={() => detail?.('내 보호막', '모든 마법 보호막은 합산됩니다. 연속 타격 사이에는 잔량을 유지하고 적 행동 전체가 끝나면 사라집니다. 화염 감소와 반사는 각각 한 번만 적용합니다.')}><Icon name="shield" size={13} /><b>{g.playerShield}</b></button>}
    {g.boost && <button aria-label="옥시 강화 설명" onClick={() => detail?.('옥시 강화', '다음 공격 마법의 상성 계산 전 피해 +10. ZERO BURST나 방어 마법에는 소모되지 않습니다.')}><Icon name="spark" size={13} />+10</button>}
  </div>;
}
