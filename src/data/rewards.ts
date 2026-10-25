import type { RewardId, Upgrades } from '../game/types';
type Reward = { id: RewardId; name: string; description: string; rune: string; stat?: Exclude<keyof Upgrades, 'research' | 'resonance'>; amount: number };
export const REWARDS: Reward[] = [
  { id: 'bag', name: '확장 가방', description: '원소 보관 한도 +2', rune: 'bag', stat: 'capacity', amount: 2 },
  { id: 'water', name: '정밀 합성', description: '워터 블래스트 피해 +4', rune: 'drop', stat: 'waterDamage', amount: 4 },
  { id: 'heal', name: '회복 실험', description: '체력 15 추가 회복', rune: 'heart', amount: 15 },
  { id: 'guard', name: '방어 강화', description: '모든 보호막 마법의 획득량 +3', rune: 'shield', stat: 'shieldBonus', amount: 3 },
  { id: 'draw', name: '추가 채집', description: '다음 턴부터 획득 원소 +1', rune: 'spark', stat: 'draw', amount: 1 },
  { id: 'reaction', name: '반응 증폭', description: '중화 반응 추가 피해 +3 · 최대 2회', rune: 'flask', stat: 'reactionBonus', amount: 3 },
  { id: 'research', name: '화학 연구', description: '새 마법 시전 또는 새 반응 성공 시 마력 +20 · 전투당 1회', rune: 'book', amount: 20 },
  { id: 'resonance', name: '원소 공명', description: '다음 전투 시작 5개 중 선택 원소 2개 확정 · 가중치 1.5배 → 최대 2배', rune: 'spark', amount: .5 },
];
