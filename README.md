# CHEMAGE · PHASE 3

원소를 조합해 마법으로 싸우는 한국어 모바일 턴제 게임입니다.

**플레이:** https://indong2026.github.io/CHEMAGE/

이 저장소는 PHASE 3 완성본입니다. PHASE 3.1 개발 변경은 포함하지 않습니다.

- 한 턴에 마법 최대 2회 즉시 시전
- 전투 시작 원소 5개, 턴마다 3개, 기본 가방 12개
- 초과 신규 원소는 개당 마력 15, 시전마다 마력 10
- 마력 100에서 수동 ZERO BURST: 피해 30, 방어력 무시, 턴 소모
- 기존 방어 / 턴 종료 버튼 분리, 보호막은 최댓값 적용
- 마법 10종, 5전투, 보상, 도감 저장, 3단계 첫 전투 안내
- 효과음, 1×/2× 연출, 움직임 줄이기

## 개발

Node.js 22.12 이상.

```sh
npm ci
npm run dev
npm test
npm run build
```

79개 자동 테스트와 TypeScript/프로덕션 빌드 통과. 모바일 320px·390px에서 첫 전투를 확인했습니다. 새로고침하면 모험은 초기화되고 도감만 브라우저에 남습니다.

## 배포

main 브랜치에 푸시하면 GitHub Actions가 빌드 후 dist를 GitHub Pages에 배포합니다. Vite의 상대 경로 base를 사용해 /CHEMAGE/ 하위 경로에서도 자산을 불러옵니다.

[PHASE 3 검증 기록](docs/phase3-verification.md) · [밸런스 시뮬레이션](docs/phase3-balance.json)
