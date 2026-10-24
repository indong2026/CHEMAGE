import type { EnemyId, Intent } from '../game/types';
const attack = (value: number, label = '공격'): Intent => ({ type: 'attack', value, label });
const shield = (value: number): Intent => ({ type: 'shield', value, label: '방어막' });
const charge: Intent = { type: 'charge', value: 0, label: '다음 공격 준비' };
export const ENEMIES: Record<EnemyId, { name: string; subtitle: string; hp: number; armor: number; pattern: Intent[]; phase2?: Intent[]; phaseThreshold?: number }> = {
  slime: { name: '그린 슬라임', subtitle: '이끼 낀 실험실', hp: 48, armor: 0, pattern: [attack(8), { type: 'wait', value: 0, label: '대기 · 공격 없음' }] },
  beetle: { name: '아이언 비틀', subtitle: '버려진 제련소', hp: 60, armor: 5, pattern: [attack(11), shield(8), attack(11), charge] },
  flame: { name: '플레임 스피릿', subtitle: '꺼지지 않는 화로', hp: 54, armor: 0, pattern: [{ type: 'fire', value: 12, label: '화염 공격' }, charge, { type: 'fire', value: 16, label: '화염 분출' }, charge] },
  elite: { name: '정예 아이언 비틀', subtitle: '봉인된 철의 문', hp: 86, armor: 5, pattern: [attack(16), charge, attack(22, '강철 돌진'), shield(10)] },
  golem: { name: '크리스탈 골렘', subtitle: '결정의 심장', hp: 120, armor: 0, phaseThreshold: 60, pattern: [attack(16), charge, attack(24, '결정 강타'), shield(10)], phase2: [attack(26, '결정 강타'), attack(18), attack(20, '파편 강타'), shield(8)] },
};

