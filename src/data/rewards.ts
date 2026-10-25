import type { RewardId, Upgrades } from '../game/types';
type Reward = { id: RewardId; name: string; description: string; rune: string; stat?: keyof Upgrades; amount: number };
export const REWARDS: Reward[] = [
  { id: 'bag', name: '확장 가방', description: '원소 보관 한도 +2', rune: 'bag', stat: 'capacity', amount: 2 },
  { id: 'water', name: '정밀 합성', description: '워터 블래스트 피해 +4', rune: 'drop', stat: 'waterDamage', amount: 4 },
  { id: 'heal', name: '회복 실험', description: '체력 15 추가 회복', rune: 'heart', amount: 15 },
  { id: 'guard', name: '방어 강화', description: '모든 보호막 마법의 획득량 +3', rune: 'shield', stat: 'shieldBonus', amount: 3 },
  { id: 'draw', name: '추가 채집', description: '다음 턴부터 획득 원소 +1', rune: 'spark', stat: 'draw', amount: 1 },
];
