import type { Affinity, BossId, EnemyId, Intent, Rng } from '../game/types';
const attack = (value: number, label = '공격'): Intent => ({ type: 'attack', value, label });
const shield = (value: number): Intent => ({ type: 'shield', value, label: '보호막 +' });
const charge: Intent = { type: 'charge', value: 0, label: '강공격 준비' };
const multi = (value: number, count: number, label: string): Intent => ({ type: 'attack', value: value * count, label, hits: Array.from({ length: count }, () => ({ type: 'attack', value })) });
export type EnemyData = { name: string; affinity: Affinity; subtitle: string; hp: number; armor: number; pattern: Intent[]; phase2?: Intent[]; phaseThreshold?: number; boss?: { english: string; intro: string; guide: string; phaseTitle: string; phaseShield?: number; persistentShield?: boolean; animation: 'crystal'|'fire'|'hammer' } };
export const BOSS_IDS: BossId[] = ['golem', 'inferno', 'warden'];
export const selectBoss = (rng: Rng): BossId => BOSS_IDS[Math.min(2, Math.max(0, Math.floor(rng() * 3)))];
const fire = (value:number,label:string):Intent => ({type:'fire',value,label});
const fireRush = (value:number):Intent => ({type:'fire',value:value*2,label:'플레임 러시',hits:[{type:'fire',value},{type:'fire',value}]});
const prepare = (label:string):Intent => ({type:'charge',value:0,label});
export const ENEMIES: Record<EnemyId, EnemyData> = {
  minion: { name: '크리스탈 미니언', affinity: 'CRYSTAL', subtitle: '작은 결정의 방', hp: 36, armor: 2, pattern: [attack(8), shield(8), attack(8)] },
  gel: { name: '코러시브 젤', affinity: 'CORROSION', subtitle: '부식된 배양실', hp: 40, armor: 0, pattern: [attack(8), { type: 'attack', value: 7, label: '부식성 마법 · 취약 부여', inflictVulnerable: true }, charge, { ...attack(14, '부식 강타'), dangerous: true }] },
  slime: { name: '그린 슬라임', affinity: 'NEUTRAL', subtitle: '이끼 낀 실험실', hp: 48, armor: 0, pattern: [attack(8), { type: 'wait', value: 0, label: '대기 · 공격 없음' }] },
  beetle: { name: '아이언 비틀', affinity: 'METAL', subtitle: '버려진 제련소', hp: 60, armor: 5, pattern: [attack(11), shield(8), multi(6, 2, '더블 스트라이크'), charge] },
  flame: { name: '플레임 스피릿', affinity: 'FIRE', subtitle: '꺼지지 않는 화로', hp: 54, armor: 0, pattern: [{ type: 'fire', value: 12, label: '화염 공격' }, charge, { type: 'fire', value: 20, label: '플레임 버스트' }, charge] },
  elite: { name: '정예 아이언 비틀', affinity: 'METAL', subtitle: '봉인된 철의 문', hp: 86, armor: 5, pattern: [attack(16), shield(10), multi(7, 3, '트리플 스트라이크'), charge, attack(22, '강철 돌진')] },
  golem: { name: '크리스탈 골렘', affinity: 'CRYSTAL', subtitle: '결정의 심장', hp: 120, armor: 0, phaseThreshold: 60, pattern: [attack(16), charge, attack(24, '결정 강타'), shield(10)], phase2: [attack(18), multi(10, 2, '크리스탈 러시'), charge, attack(28, '크리스탈 크래시'), shield(8)] },
  inferno: { name:'인페르노 코어', affinity:'FIRE', subtitle:'폭주하는 화염의 핵', hp:120, armor:1, phaseThreshold:60,
    pattern:[fire(12,'파이어 볼트'),fireRush(7),prepare('오버히트 · 화염 충전'),{...fire(22,'오버히트 버스트'),dangerous:true}],
    phase2:[fire(14,'파이어 볼트'),fireRush(8),prepare('오버히트 · 화염 충전'),{...fire(26,'오버히트 버스트'),dangerous:true}],
    boss:{english:'INFERNO CORE',intro:'뜨거운 화염의 핵이 폭주하기 시작합니다.',guide:'화염 공격이 강력합니다. 물 마법과 화염 피해를 줄이는 보호막을 활용해 보세요.',phaseTitle:'OVERDRIVE!',animation:'fire'} },
  warden: { name:'아이언 워든', affinity:'METAL', subtitle:'강철 파수꾼의 성채', hp:103, armor:5, phaseThreshold:51.5,
    pattern:[attack(12,'아이언 스트라이크'),multi(7,2,'더블 해머'),{...shield(10),label:'스틸 배리어 +'},prepare('헤비 프레스 준비'),{...attack(23,'헤비 프레스'),dangerous:true}],
    phase2:[attack(14,'아이언 스트라이크'),multi(9,2,'더블 해머'),{...shield(12),label:'스틸 배리어 +'},prepare('헤비 프레스 준비'),{...attack(27,'헤비 프레스'),dangerous:true}],
    boss:{english:'IRON WARDEN',intro:'강철의 파수꾼이 방어 태세에 돌입합니다.',guide:'방어력과 보호막이 높습니다. 부식 마법과 보호막 파괴 마법이 유리합니다.',phaseTitle:'FORTRESS MODE!',phaseShield:10,persistentShield:true,animation:'hammer'} },
};
ENEMIES.golem.boss = {english:'CRYSTAL GOLEM',intro:'단단한 결정의 수호자가 깨어났습니다.',guide:'적의 약점과 공격 예고를 확인하세요.',phaseTitle:'결정 폭주!',animation:'crystal'};
