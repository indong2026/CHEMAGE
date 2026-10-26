import { ELEMENTS } from './elements';
import { SPELL_BY_ID } from './spells';
import type { Element, ReactionId, SpellId } from '../game/types';

// Stage 1 describes real substances; stages 2/3 derive quantities from the recipe.
export const SPELL_CLUES: Record<SpellId, string> = {
  nitrogen: '지구 대기의 가장 큰 부분을 차지하는 기체입니다. 같은 원자 두 개가 한 분자를 이룹니다.',
  ammonia: '암모니아입니다. 질소와 수소로 이루어진 분자이며 염화 수소와 반응해 암모늄염을 형성할 수 있습니다.',
  nitro: '이산화 질소입니다. 질소와 산소로 이루어진 물질입니다.',
  sulfide: '황화 수소입니다. 수소와 황으로 이루어진 기체 물질입니다.',
  sulfur: '이산화 황입니다. 황과 산소로 이루어진 물질입니다.',
  ironSulfide: '황화 철(II)입니다. 철과 황의 비율이 1:1이며 황철석과는 다릅니다.',
  water: '우리 주변에서 쉽게 볼 수 있으며 생명 유지에 필수적인 액체입니다.',
  salt: '음식의 짠맛을 내는 대표적인 물질입니다. 양이온과 음이온이 규칙적으로 배열된 결정입니다.',
  carbon: '숨을 내쉴 때 나오는 기체 중 하나이며, 일부 소화기에도 사용됩니다.',
  iron: '자석에 끌리고 공기와 수분에 노출되면 녹이 슬 수 있는 금속 원소입니다.',
  oxygen: '공기 중에 있으며 호흡과 연소를 돕는 기체입니다. 스스로 타는 연료는 아닙니다.',
  acid: '염화 수소라는 물질입니다. 물에 녹은 수용액을 염산이라고 부릅니다.',
  peroxide: '과산화 수소라는 물질로 산화력이 있습니다. 물과 다른 물질입니다.',
  graphite: '연필심의 재료인 흑연은 한 종류의 원소로 이루어져 있습니다. 다이아몬드와 같은 원소입니다.',
  methane: '천연가스의 주성분인 가연성 기체, 메테인입니다.',
  ironOxide: '산화 철(II)입니다. 금속 원소의 산화수가 +2인 산화물입니다.',
  hydrogen: '가장 가벼운 원소의 원자 두 개가 결합한 기체 분자입니다.',
  alkali: '수산화 나트륨입니다. 수용액은 강한 염기성을 나타냅니다.',
  ferrous: '염화 철(II)입니다. 금속 원소의 산화수가 +2인 염화물입니다.',
};
export function spellHints(id: SpellId): [string, string, string] {
  const parts = Object.entries(SPELL_BY_ID[id].recipe) as [Element, number][];
  const count = parts.reduce((sum, [, n]) => sum + n, 0);
  return [SPELL_CLUES[id], `${parts.map(([e]) => ELEMENTS[e].name).join(', ')} 원소를 사용합니다. 게임 조합에 원소 타일 총 ${count}개가 필요합니다.`, `${parts.map(([e, n]) => `${ELEMENTS[e].name} ${n}개`).join('와 ')}를 조합한 뒤 마법을 발동하세요.`];
}
export const REACTION_HINTS: Record<ReactionId, { principle: string; pair: [SpellId, SpellId]; clue: string; order: string }> = {
  ammonium: {
    principle: '암모니아는 염화 수소와 반응하여 암모늄염을 형성할 수 있습니다. 피해는 게임 효과입니다.',
    pair: ['ammonia', 'acid'], clue: '질소와 수소로 이루어진 물질의 마법 다음에 염화 수소 마법을 사용해 보세요.',
    order: '같은 플레이어 턴에 NH₃를 먼저 시전하고 HCl을 두 번째로 시전하세요. NH₃ + HCl → NH₄Cl. 추가 중립 피해 5는 판타지 규칙입니다.',
  },
  neutralization: {
    principle: '산성 물질과 염기성 물질은 서로 반응할 수 있습니다. 추가 피해와 보호막은 게임 효과입니다.',
    pair: ['acid', 'alkali'], clue: '산성 수용액과 관련된 마법을 먼저, 강한 염기성 물질과 관련된 마법을 그다음에 사용해 보세요.',
    order: '같은 플레이어 턴에 HCl을 먼저 시전하고 NaOH를 두 번째로 시전하세요. 조합만 하거나 순서를 바꾸면 발동하지 않습니다.',
  },
  combustion: {
    principle: '연소를 돕는 기체와 연료가 만나면 에너지를 방출할 수 있습니다. 게임의 강화는 실제 연소 실험과 다릅니다.',
    pair: ['oxygen', 'methane'], clue: '연소를 돕는 기체의 마법으로 강화한 다음, 천연가스의 주성분과 관련된 공격 마법을 사용해 보세요.',
    order: 'O₂로 강화한 뒤, 강화가 남아 있을 때 CH₄를 시전하세요. 같은 전투의 다음 턴에도 가능하지만 다른 공격 마법을 먼저 쓰면 강화가 소모됩니다. 기존 피해 +10만 적용합니다.',
  },
  crystallization: {
    principle: '젖은 적에게 결정을 날리는 판타지 연계입니다. 새로운 물질이 생기는 실제 화학 반응이 아닙니다.',
    pair: ['water', 'salt'], clue: '생명 유지에 필요한 액체의 마법으로 적을 적신 뒤, 짠맛을 내는 결정의 마법을 사용해 보세요.',
    order: 'H₂O로 적에게 젖음을 부여한 뒤 NaCl을 시전하세요. 같은 턴 또는 바로 다음 플레이어 턴까지 가능합니다. 젖음이 사라지기 전에 써야 하며, 성공하면 젖음을 소모하고 피해 +4를 적용합니다.',
  },
};
