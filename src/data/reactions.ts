import type { GameState, ReactionId, SpellId } from '../game/types';
export const REACTIONS: Record<ReactionId, { name: string; spells: string; equation?: string; concept: string; effect: string; color: string }> = {
  neutralization: { name: '중화 반응', spells: 'HCl → NaOH', equation: 'HCl + NaOH → NaCl + H₂O', concept: '염산과 수산화 나트륨 수용액의 중화 반응입니다. 실제 반응식과 달리 추가 피해와 보호막 생성은 판타지 효과입니다.', effect: '같은 턴 HCl 다음 NaOH: 추가 중립 피해 8 + 반응 증폭, 보호막 6. 추가 피해에도 방어력·적 보호막 적용.', color: '#9ef0cb' },
  combustion: { name: '연소 강화', spells: 'O₂ → CH₄', equation: 'CH₄ + 2O₂ → CO₂ + 2H₂O', concept: '메테인은 산소와 반응해 연소하며 에너지를 방출할 수 있습니다. 반응식의 계수는 실제 반응 비율이며 게임의 마법 사용 횟수와 다릅니다.', effect: '기존 옥시 강화 +10을 한 번 적용. 별도 추가 피해 없음. 강화가 남아 있다면 다음 턴에도 가능.', color: '#ffc286' },
  crystallization: { name: '결정 연계', spells: 'H₂O → NaCl', concept: '물과 염화 나트륨의 성질에서 착안한 판타지 연계입니다. 새로운 물질이 생기는 화학 반응식으로 취급하지 않습니다.', effect: '젖음 소비 → 기존 솔트 스파이크 추가 피해 +4. 상성 적용 전 합산.', color: '#c6d6ff' },
};
export const REACTION_IDS = Object.keys(REACTIONS) as ReactionId[];
export function availableReaction(s: GameState, spell: SpellId): ReactionId | undefined {
  if (spell === 'alkali' && s.spellsUsed === 1 && s.castHistory[0] === 'acid') return 'neutralization';
  if (spell === 'methane' && s.boost) return 'combustion';
  if (spell === 'salt' && s.enemy.wet > 0) return 'crystallization';
}
