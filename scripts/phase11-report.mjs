import fs from 'node:fs';
const dir='docs/phase11/',read=n=>JSON.parse(fs.readFileSync(dir+n+'.json','utf8'));
const before=read('baseline'),after=read('final'),manifest=read('baseline-manifest');
const mixed=x=>x.bosses.filter(r=>r.strategy==='mixed');
const sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0),pct=x=>(x*100).toFixed(2)+'%',num=x=>x.toFixed(2);
const bosses={golem:'크리스탈 골렘',inferno:'인페르노 코어',warden:'아이언 워든'};
const aggregate=(x,id)=>Object.fromEntries(Object.keys(x.bosses[0].spells[id]).filter(k=>k!=='missing').map(k=>[k,mixed(x).reduce((n,r)=>n+r.spells[id][k],0)]));
const table=(heads,rows)=>'| '+heads.join(' | ')+' |\n| '+heads.map(()=>'---').join(' | ')+' |\n'+rows.map(r=>'| '+r.join(' | ')+' |').join('\n');
const basic=manifest.spells.map(s=>{const a=aggregate(before,s.id),b=aggregate(after,s.id);return[s.formula,`${a.opportunities} → ${b.opportunities}`,`${a.casts} → ${b.casts}`,`${pct(a.casts/(a.opportunities||1))} → ${pct(b.casts/(b.opportunities||1))}`,`${num(a.hpDamage/(a.casts||1))} → ${num(b.hpDamage/(b.casts||1))}`,Object.values(s.recipe).reduce((a,b)=>a+b,0),`${num(a.completionWait/(a.availabilityEpisodes||1))} → ${num(b.completionWait/(b.availabilityEpisodes||1))}`];});
const wards=['graphite','carbon','iron','nitrogen','sulfide'].map(id=>{const a=aggregate(before,id),b=aggregate(after,id);return[manifest.spells.find(s=>s.id===id).formula,`${num(a.shieldGenerated)} → ${num(b.shieldGenerated)}`,`${num(a.shieldAbsorbed)} → ${num(b.shieldAbsorbed)}`,`${num(a.shieldUnused)} → ${num(b.shieldUnused)}`,`${a.reflectDamage} → ${b.reflectDamage}`,`${a.fireReduction} → ${b.fireReduction}`];});
const comparison=mixed(after).map((b,i)=>{const a=mixed(before)[i];return[bosses[b.boss],`${pct(a.winRate)} → ${pct(b.winRate)}`,`${pct(a.cShare)} → ${pct(b.cShare)}`,`${num(a.entropy)} → ${num(b.entropy)}`,`${num(a.averageRounds)} → ${num(b.averageRounds)}`,`${num(a.averageHp)} → ${num(b.averageHp)}`];});
const candidates=['baseline','c8','cReflect2','methane23','methane24','ferrous18','combined23-18'].map(n=>{const x=read(n);return[n,...mixed(x).map(r=>pct(r.winRate)),mixed(x).map(r=>pct(r.cShare)).join(' / '),mixed(x).map(r=>r.spells.methane.casts).join(' / '),mixed(x).map(r=>r.spells.ferrous.casts).join(' / ')];});
const csvRows=[];
for(const data of [before,after])for(const scope of ['bosses','noWater','adventures'])for(const r of data[scope])for(const [id,m] of Object.entries(r.spells))csvRows.push({version:data.name,scope,boss:r.boss,strategy:r.strategy,spell:id,...Object.fromEntries(Object.entries(m).filter(([k])=>k!=='missing')),choiceRate:m.casts/(m.opportunities||1),winGivenUse:m.wonUsedBattles/(m.usedBattles||1),...Object.fromEntries(Object.entries(m.missing).map(([e,n])=>['missing'+e,n]))});
const headers=Object.keys(csvRows[0]);fs.writeFileSync(dir+'all-spells.csv','\uFEFF'+headers.join(',')+'\n'+csvRows.map(r=>headers.map(k=>r[k]).join(',')).join('\n'));
const enemyRows=[];
for(const data of [before,after])for(const r of data.adventures)for(const [enemy,e] of Object.entries(r.enemies))for(const [id,m] of Object.entries(e.spells))enemyRows.push({version:data.name,adventureBoss:r.boss,enemy,visits:e.visits,spell:id,...Object.fromEntries(Object.entries(m).filter(([k])=>k!=='missing'))});
const eh=Object.keys(enemyRows[0]);fs.writeFileSync(dir+'enemy-spells.csv','\uFEFF'+eh.join(',')+'\n'+enemyRows.map(r=>eh.map(k=>r[k]).join(',')).join('\n'));
const paired=after.bosses.map((r,i)=>{const a=before.bosses[i];return{boss:r.boss,strategy:r.strategy,gained:r.outcomes.filter((o,j)=>o.win&&!a.outcomes[j].win).length,lost:r.outcomes.filter((o,j)=>!o.win&&a.outcomes[j].win).length};});
fs.writeFileSync(dir+'paired-outcomes.json',JSON.stringify(paired,null,2));
const ordinary=['slime','minion','gel','beetle','flame','elite'].map(enemy=>[enemy,...[before,after].map(d=>{const es=d.adventures.map(r=>r.enemies[enemy]).filter(Boolean);return ['graphite','methane','ferrous'].map(id=>es.reduce((n,e)=>n+e.spells[id].casts,0)).join(' / ');})]);
const report=`# CHEMAGE PHASE 11 검증 보고서

로컬 PHASE 10 최신 소스를 기준으로 CH₄와 FeCl₂의 직접 피해만 조정했다. GitHub Pages 배포와 releases/phase8 수정은 하지 않았다.

## A. 문제 분석

C는 원소 1개로 보호막 10과 적 행동당 반사 3을 제공하고 C 기본 등장 확률이 13%여서 조합 기회가 많다. 혼합 정책의 선택 가능 상태에서 선택률은 보스별 약 52–54%, 전체 시전 비중은 약 25–27%였다. 보호막은 생성량만이 아니라 실제 흡수량과 남은 양으로 구분했다. 사용한 C 보호막 일부는 공격 없는 행동이나 과잉 방어 때문에 소멸했다.

기존 자동 정책은 모두 한 라운드만 내다본다. 혼합 정책의 HP 보존 가중치 2.5, 피해 가중치 1.6과 원소 비용 감점 0.7은 저비용 방어를 선호하게 한다. 무작위 합법 행동 참고 정책에서는 C 비중이 18.3–18.8%로 낮지만 승률도 4.5–11.5%로 크게 낮았다. 따라서 C의 강함과 평가 정책의 편향이 함께 작용한다. 무작위 정책이 사람 플레이를 대표하지는 않는다. 정책 점수를 바꾸어 개선 수치를 만들지 않았다.

CH₄는 C1+H4, FeCl₂는 Fe1+Cl2가 모두 갖춰져야 한다. 기준 혼합 정책 600회에서 CH₄ 조합 기회는 ${aggregate(before,'methane').opportunities}회, FeCl₂는 ${aggregate(before,'ferrous').opportunities}회뿐이다. 조합 완료 후 선택 가치도 문제지만 공급·보관 기회가 먼저 제한한다. CH₄는 H₂·H₂O 등과 H를, C 방어와 C를 공유하며 FeCl₂는 Fe 단일 방어와 철을 공유한다. 피해 강화로 원소 부족 자체가 해결되지는 않는다.

기준 골렘에서 의사결정당 부족량은 H(CH₄) ${num(before.bosses.find(r=>r.boss==='golem'&&r.strategy==='mixed').spells.methane.missing.H/mixed(before)[0].decisions)}개, Fe(FeCl₂) ${num(mixed(before)[0].spells.ferrous.missing.Fe/mixed(before)[0].decisions)}개, Cl ${num(mixed(before)[0].spells.ferrous.missing.Cl/mixed(before)[0].decisions)}개였다. Cl은 필요한 수가 2개여서 원시 부족량만으로 Fe보다 희귀하다고 해석하면 안 된다. 등장 확률과 공명 계산은 그대로 유지했다.

CO₂는 비화염 상대에서는 선택률이 낮지만 인페르노에서는 기준 ${before.bosses.find(r=>r.boss==='inferno'&&r.strategy==='mixed').spells.carbon.casts}회 사용, 화염 추가 감소 총 140을 제공했다. Fe는 단일 원소 보호막, N₂는 마력 보충, H₂S는 공격과 방어를 결합한 역할을 유지했다. FeCl₂는 2연타에서 피해 6, 3연타에서 9를 줄이며 NH₃와 합산하지 않는다. 충전·방어 행동에서는 약화가 만료된다.

## B. 최종 변경과 후보 비교

| 마법 | PHASE 10 | PHASE 11 | 결정 이유 |
| --- | --- | --- | --- |
| CH₄ | 피해 20 | 피해 23 | H4+C1 완성의 보상을 보강. 24 후보와 혼합 정책 시전 횟수·승률 차이가 거의 없어 작은 조정 채택 |
| FeCl₂ | 피해 16 · 타격당 감소 3 | 피해 18 · 감소 3 유지 | 희귀 레시피 완성 시 공격 보상 보강. 연속 공격 약화·상성은 그대로 |
| C | 보호막 10 · 반사 3 | 유지 | 약화 후보는 C 비중 감소가 작고 승률 손실이 큼 |
| CO₂ / Fe / N₂ / H₂S | 기존 효과 | 유지 | 실제 흡수·화염 감소·마력·공격 혼합 역할 확인 |

독립 후보마다 혼합 정책 3보스×200회와 물 강화 없는 대조 600회를 시행했다. 다음 표의 순서는 골렘 / 인페르노 / 워든이다.

${table(['후보','골렘 승률','인페르노 승률','워든 승률','C 비중','CH₄ 시전','FeCl₂ 시전'],candidates)}

C 보호막 8 후보는 승률 −4/−2.5/−2.5%p, 반사 2 후보는 −3/−1/−2%p였다. 물 +4가 없는 대조에서도 손실이 나타나 제외했다. 채택하지 않은 값은 테스트 실험 목록에만 남고 실제 게임에는 적용되지 않는다.

## C. 전후 비교

### 같은 200개 시드, 혼합 정책

${table(['보스','승률','C 시전 비중','다양성 엔트로피','평균 라운드','평균 잔여 HP'],comparison)}

다양성 엔트로피는 자연로그 기준이며 높을수록 시전이 여러 마법에 분산된다. 변화는 작다. CH₄는 총 ${aggregate(before,'methane').casts}→${aggregate(after,'methane').casts}회, FeCl₂는 ${aggregate(before,'ferrous').casts}→${aggregate(after,'ferrous').casts}회 사용됐다. **C 편중은 해결되지 않았다.** 모든 마법의 균등 사용을 목표로 억지로 수치를 조정하지 않았다.

완성된 CH₄+Fe+O₂ 손패를 고정한 선택 실험에서도 23과 24 후보의 첫 선택은 같았다. 골렘의 공격·상성 정책은 CH₄, 혼합 정책은 Fe를 선택했고, 인페르노 상성·혼합은 물, 워든은 Fe를 먼저 선택했다. 완성 여부만이 아니라 즉시 방어 필요와 정책의 짧은 판단 범위도 영향을 준다. [고정 손패 선택](complete-hand-choices.json).

${table(['보스','CH₄ 조합 불가 비율 전→후','FeCl₂ 조합 불가 비율 전→후','턴 종료 중 조합 없음 전→후'],mixed(after).map((r,i)=>{const a=mixed(before)[i];return[bosses[r.boss],`${pct(1-a.spells.methane.opportunities/a.decisions)} → ${pct(1-r.spells.methane.opportunities/r.decisions)}`,`${pct(1-a.spells.ferrous.opportunities/a.decisions)} → ${pct(1-r.spells.ferrous.opportunities/r.decisions)}`,`${pct(a.emptyEndRatio)} → ${pct(r.emptyEndRatio)}`];}))}

### 19종의 실제 기회와 선택

보스 혼합 정책 600회 합계. 기회는 행동 선택 시점마다 현재 가방으로 완성 가능한 레시피를 센다. 같은 손패가 다음 선택에도 남으면 재집계될 수 있다. 별도 availableRounds·availabilityEpisodes도 원자료에 저장했다. 피해는 적 HP가 실제 줄어든 양이며 과잉 피해를 제외한다. 반사와 방어막 피해는 별도다. 지속 피해는 마지막 지속 피해 마법에 귀속하고 O₂ 강화 이득은 후속 공격에 포함한다. 따라서 O₂의 직접 피해 0은 가치가 없다는 뜻이 아니다.

${table(['화학식','기회 전→후','시전 전→후','가능할 때 선택률','시전당 실제 HP 피해','원소 비용','완성 대기 턴 전→후'],basic)}

완성 대기는 레시피가 새로 가능해진 시점에서 필요한 원소 중 가장 오래된 카드의 나이다. **완성에 성공한 경우만 포함**하므로 끝내 완성하지 못한 시간까지 대표하지 않는다. 실제 시전 카드 나이도 별도로 기록했다.

${table(['방어 마법','생성 전→후','실제 흡수 전→후','미사용 소멸 전→후','반사 전→후','화염 감소 전→후'],wards)}

보호막은 게임에서 하나의 공통 풀이다. 마법별 흡수량은 그 순간 남아 있는 기여량 비율로 배분한 **분석용 귀속**이며 게임의 소모 우선순위가 아니다. 실제 전체 흡수 합계와 항상 일치하도록 검증했다. 반응 보호막은 별도 계정으로 분리했다.

### 6정책 × 3보스 × 200회 = 전후 각각 3,600회

${table(['보스','정책','기준 승리/200','최종 승리/200','새로 승리','새로 패배'],after.bosses.map((r,i)=>[bosses[r.boss],r.strategy,before.bosses[i].wins,r.wins,paired[i].gained,paired[i].lost]))}

물 +4 제거 대조의 혼합 승률은 ${before.noWater.map(r=>pct(r.winRate)).join(' / ')} → ${after.noWater.map(r=>pct(r.winRate)).join(' / ')}. 고정 보상 조건을 빼도 보스 간 특성은 유지됐다. 이 표는 자동 정책의 결과이며 사람의 난이도나 작은 차이의 통계적 유의성을 입증하지 않는다.

### 전체 5전투 모험 — 전후 각각 600회

${table(['최종 보스','기준 승리/200','최종 승리/200','기준→최종 평균 라운드','정지'],after.adventures.map((r,i)=>[bosses[r.boss],before.adventures[i].wins,r.wins,`${num(before.adventures[i].averageRounds)} → ${num(r.averageRounds)}`,r.stalled]))}

일반전과 정예전에서도 시전을 분리했다. 아래 각 셀은 C / CH₄ / FeCl₂ 횟수이며 3보스 모험 600회 합계다. 동일한 초반 시드가 보스별로 반복되므로 600개 독립적인 초반 경로로 해석하지 않는다.

${table(['적','기준 시전','최종 시전'],ordinary)}

전체 19종의 적별 피해·방어·기회·사용 후 승리 기록은 [enemy-spells.csv](enemy-spells.csv), 정책·대조별 상세는 [all-spells.csv](all-spells.csv)에 있다. 사용한 전투의 승률은 상관관계이며 마법 자체의 승률 기여로 단정할 수 없다.

## D. 보스별 영향과 제외 실험

골렘 혼합 승률은 68→67.5%, 인페르노 84% 유지, 워든 70→70.5%였다. 패턴·HP·방어력·2페이즈는 바꾸지 않았다. CH₄는 인페르노 저항과 방어력 때문에 기본 실제 피해 16, O₂ 강화 시 23으로 여전히 불리하다. 골렘에서는 기본 23 / 강화 33, 워든에서는 방어력 적용 후 18 / 28이다.

골렘에서는 금속 상성·NaCl 관통, 인페르노에서는 H₂O와 CO₂, 워든에서는 HCl 방어 감소·SO₂ 부식·보호막 전용 피해의 역할이 남는다. 최종 혼합 정책의 총 HP 피해 상위는 골렘 NaCl/H₂O/NO₂, 인페르노 H₂O/NaCl/NO₂, 워든 H₂O/SO₂/NaCl이었다. 총 피해 순위에는 획득 빈도와 물 +4가 섞여 있으므로 마법 자체 효율 순위로 해석하지 않는다. 인페르노 혼합 정책에서 H₂O₂는 여전히 0회 사용됐다.

최종 수치에서 특정 마법만 정책 후보에서 제외한 대조(각200회):

${table(['보스','제외 마법','승률'],read('final-ablations').map(r=>[bosses[r.boss],r.excluded.join(','),pct(r.winRate)]))}

C를 제외하면 승률이 크게 낮아져 현재 획득·보상·정책 구조에서 의존도가 여전히 높음을 보여 준다. CH₄·FeCl₂ 제외 차이는 작은 시전 표본과 선택 경로 변화의 영향도 받는다. FeCl₂를 빼면 일부 보스 승률이 오르는 결과도 남아 있으므로 모든 상황에서 강화가 유리하다고 주장하지 않는다.

## E. 검증과 남은 문제

- 전후 기준 각 4,800회(보스3,600 + 물 강화 없는600 + 전체 모험600), 무작위 정책600, 독립 후보6,000, 조합안1,200, 최종 제외1,800 = **19,200회** 측정. 모두 정지·무한 전투 0. 기존 회귀용 자동 플레이는 별도.
- 19개 레시피·화학 정보·속성, 전투 엔진, 원소 확률, 적 패턴, 보상, 반응, Battle UI·UX CSS를 기준 해시와 비교. 저장 관련 코드 변경 없음.
- TypeScript 검사 및 Vite 프로덕션 빌드 성공(70 modules). 개발용 QA와 실험 함수는 배포 번들 진입점에서 사용하지 않는다.
- 전체 자동 검사 **434 통과 / 1개 기본 제외**(명시적으로 실행하는 대규모 실험). 27개 테스트 파일 통과. 대규모 실험은 별도 실행해서 통과했다. 최초 전체 실행은 확률 표본 60,000개 검사가 5초 제한을 넘었다. 해당 통계 검사만 20초 제한으로 조정했고 검증 내용이나 게임 규칙은 바꾸지 않았다.
- 실제 브라우저: CH₄ 예상·실제23, O₂→CH₄33, FeCl₂의 워든 피해13와 예고7+7→4+4, NH₃ 추가 시에도4+4 유지, CO₂ 화염22→17→보호막12→HP5, C+C 보호막20·흡수18·반사3 확인. 재구성은3장 유지, 마법2/2 유지, 게이지0.
- 모바일320/390/430px에서 6상황 총18회 가로 넘침0. 재구성 닫힘·열림·선택·취소12회 모두 가방·카드·발동 버튼 좌표와 크기 변화0. [레이아웃](mobile-layout.json), [재구성 좌표](reconstruction-layout.json), [브라우저 기록](browser-checks.json).
- 기본 방어·공격 버튼 디자인과 상황별 가이드 유지. 반응4종, ZERO BURST, 공명, 재구성, 발견 저장·힌트·NEW는 기존 회귀 검사로 확인.
- **남은 한계:** C 의존도 높음, CH₄/FeCl₂ 조합 빈도 낮음, 일부 보스에서 미사용 마법 존재. 단기 자동 정책은 원소 장기 보관과 사람의 취향을 충분히 모델링하지 못한다. 실제 사람 플레이로 희귀 마법 완성 만족감, C를 남길지 공격에 쓸지의 판단, 긴 보관의 답답함을 추가 확인해야 한다.

## 재현

PowerShell에서 프로젝트 폴더 기준:

\`\`\`powershell
$env:CHEMAGE_LAB='baseline'; npm.cmd test -- src/test/phase11-experiments.test.ts --maxWorkers=1
$env:CHEMAGE_LAB='candidates'; npm.cmd test -- src/test/phase11-experiments.test.ts --maxWorkers=1
$env:CHEMAGE_LAB='final'; npm.cmd test -- src/test/phase11-experiments.test.ts --maxWorkers=1
Remove-Item Env:CHEMAGE_LAB
npm.cmd test -- --maxWorkers=2
npm.cmd run build
node scripts/phase11-report.mjs
\`\`\`

baseline-manifest.json은 이번 작업 시작 시 저장한 기준 증거다. 보존 검사를 위한 기준을 갱신하려는 경우에만 baseline 명령을 다시 실행한다. 원본 후보별 JSON은 개별 파일로 유지한다. 실험값 변경은 동기 테스트 범위에서만 적용하고 finally로 원복한다.
`;
fs.writeFileSync(dir+'report.md',report);
console.log('Wrote report.md, all-spells.csv, enemy-spells.csv, paired-outcomes.json');
