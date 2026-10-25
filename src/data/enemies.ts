import type { Affinity, EnemyId, Intent } from '../game/types';
const attack = (value: number, label = '공격'): Intent => ({ type: 'attack', value, label });
const shield = (value: number): Intent => ({ type: 'shield', value, label: '보호막 +' });
const charge: Intent = { type: 'charge', value: 0, label: '강공격 준비' };
const multi = (value: number, count: number, label: string): Intent => ({ type: 'attack', value: value * count, label, hits: Array.from({ length: count }, () => ({ type: 'attack', value })) });
export const ENEMIES: Record<EnemyId, { name: string; affinity: Affinity; subtitle: string; hp: number; armor: number; pattern: Intent[]; phase2?: Intent[]; phaseThreshold?: number }> = {
  slime: { name: '그린 슬라임', affinity: 'NEUTRAL', subtitle: '이끼 낀 실험실', hp: 48, armor: 0, pattern: [attack(8), { type: 'wait', value: 0, label: '대기 · 공격 없음' }] },
  beetle: { name: '아이언 비틀', affinity: 'METAL', subtitle: '버려진 제련소', hp: 60, armor: 5, pattern: [attack(11), shield(8), multi(6, 2, '더블 스트라이크'), charge] },
  flame: { name: '플레임 스피릿', affinity: 'FIRE', subtitle: '꺼지지 않는 화로', hp: 54, armor: 0, pattern: [{ type: 'fire', value: 12, label: '화염 공격' }, charge, { type: 'fire', value: 20, label: '플레임 버스트' }, charge] },
  elite: { name: '정예 아이언 비틀', affinity: 'METAL', subtitle: '봉인된 철의 문', hp: 86, armor: 5, pattern: [attack(16), shield(10), multi(7, 3, '트리플 스트라이크'), charge, attack(22, '강철 돌진')] },
  golem: { name: '크리스탈 골렘', affinity: 'CRYSTAL', subtitle: '결정의 심장', hp: 120, armor: 0, phaseThreshold: 60, pattern: [attack(16), charge, attack(24, '결정 강타'), shield(10)], phase2: [attack(18), multi(10, 2, '크리스탈 러시'), charge, attack(28, '크리스탈 크래시'), shield(8)] },
};
