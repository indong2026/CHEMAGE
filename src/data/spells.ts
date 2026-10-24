import type { Element, SpellId } from '../game/types';
import { BALANCE as B } from './balance';
export type Spell = { id: SpellId; formula: string; display: string; name: string; substance: string; recipe: Partial<Record<Element, number>>; fact: string; effect: string; attack: boolean; color: string };
export const SPELLS: Spell[] = [
  { id: 'water', formula: 'H2O', display: 'H₂O', name: '워터 블래스트', substance: '물', recipe: { H: 2, O: 1 }, fact: '수소 원자 2개와 산소 원자 1개로 이루어진 물 분자입니다.', effect: `피해 ${B.water.damage} · 다음 턴까지 젖음 부여`, attack: true, color: '#7dd9fb' },
  { id: 'salt', formula: 'NaCl', display: 'NaCl', name: '솔트 스파이크', substance: '염화 나트륨', recipe: { Na: 1, Cl: 1 }, fact: '나트륨 이온과 염화 이온이 1:1 비율로 배열된 이온 결정이며, 소금의 주성분입니다.', effect: `피해 ${B.salt.damage} · 방어력 ${B.salt.pierce} 무시 · 젖음 연계 +${B.salt.wetBonus}`, attack: true, color: '#e7e2ac' },
  { id: 'carbon', formula: 'CO2', display: 'CO₂', name: '카본 실드', substance: '이산화 탄소', recipe: { C: 1, O: 2 }, fact: '탄소 원자 1개와 산소 원자 2개로 이루어진 기체입니다. 이산화 탄소는 소화기에 사용되기도 합니다.', effect: `이번 턴 보호막 ${B.carbon.shield} · 화염 피해 추가 −${B.carbon.fireReduction}`, attack: false, color: '#b9a1ee' },
  { id: 'iron', formula: 'Fe', display: 'Fe', name: '아이언 가드', substance: '철', recipe: { Fe: 1 }, fact: '철은 원자 번호 26인 금속 원소입니다. Fe는 철의 원소 기호입니다.', effect: `이번 턴 보호막 ${B.iron.shield}`, attack: false, color: '#edb2a9' },
  { id: 'oxygen', formula: 'O2', display: 'O₂', name: '옥시 부스트', substance: '산소', recipe: { O: 2 }, fact: '산소 원자 2개로 이루어진 분자입니다. 산소는 다른 물질의 연소를 돕지만 그 자체가 연료는 아닙니다.', effect: `다음 공격 마법 +${B.oxygen.boost} · 중첩 불가`, attack: false, color: '#aab6ff' },
  { id: 'acid', formula: 'HCl', display: 'HCl', name: '애시드 커스', substance: '염화 수소', recipe: { H: 1, Cl: 1 }, fact: '염화 수소는 수소와 염소로 이루어진 물질입니다. 염화 수소가 물에 녹은 수용액을 염산이라고 부릅니다.', effect: `피해 ${B.acid.damage} · 이 턴과 이후 2턴 동안 적 방어력 −${B.acid.reduction}`, attack: true, color: '#a5e4a2' },
  { id: 'peroxide', formula: 'H2O2', display: 'H₂O₂', name: '퍼옥사이드', substance: '과산화 수소', recipe: { H: 2, O: 2 }, fact: '수소 원자 2개와 산소 원자 2개로 이루어진 물질로 산화력이 있습니다. 물과는 다른 물질입니다.', effect: `피해 ${B.peroxide.damage} · 적 행동 시작 시 ${B.peroxide.dot} 피해 × 2`, attack: true, color: '#8ce8cf' },
  { id: 'graphite', formula: 'C', display: 'C', name: '그래파이트 월', substance: '탄소 · 흑연', recipe: { C: 1 }, fact: '흑연은 탄소 원자들이 층을 이룬 물질입니다. C는 탄소의 원소 기호이며 흑연과 다이아몬드는 모두 탄소로 이루어집니다.', effect: `이번 턴 보호막 ${B.graphite.shield} · 직접 공격에 ${B.graphite.reflect} 반사`, attack: false, color: '#d2bddf' },
  { id: 'methane', formula: 'CH4', display: 'CH₄', name: '메탄 플레어', substance: '메테인 · 메탄', recipe: { C: 1, H: 4 }, fact: '메테인(CH₄)은 탄소 원자 1개와 수소 원자 4개로 이루어진 가연성 기체입니다. 메탄이라고도 부릅니다. 화염 마법은 연소 가능성에서 착안한 판타지이며 화학식 완성 자체가 실제 점화를 의미하지 않습니다.', effect: `피해 ${B.methane.damage} · 거대한 화염 폭발`, attack: true, color: '#ffac6c' },
  { id: 'ironOxide', formula: 'FeO', display: 'FeO', name: '아이언 스트라이크', substance: '산화 철(II)', recipe: { Fe: 1, O: 1 }, fact: 'FeO는 철과 산소가 1:1 비율을 이루는 산화 철(II)입니다. 철의 산화수는 +2입니다. 금속 파편을 발사하는 공격은 판타지 설정입니다.', effect: `피해 ${B.ironOxide.damage} · 날카로운 금속 파편`, attack: true, color: '#e0cbd0' },
];
export const SPELL_BY_ID = Object.fromEntries(SPELLS.map(s => [s.id, s])) as Record<SpellId, Spell>;


