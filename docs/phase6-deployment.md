# PHASE 6 배포 검증

- 확인일: 2026-10-26
- 공개 주소: https://indong2026.github.io/CHEMAGE/
- 배포 소스: `releases/phase6`
- 커밋: `fd07790d08dea2ce08955a33018f4d8564b7d672`
- Actions: https://github.com/indong2026/CHEMAGE/actions/runs/40238438707
- 로컬 및 배포 폴더 자동 테스트: 15개 파일 / 241개 모두 통과.
- 배포 폴더 TypeScript 검사 및 프로덕션 빌드 통과.
- Linux CI: npm ci, 테스트, 빌드, Pages 게시 모두 성공.
- 공개 HTML HTTP 200. JS `index-B0GDozoU.js`, CSS `index-Dhb0lVLX.css`가 로컬 배포 산출물과 일치.
- 실제 공개 브라우저: VI 표시, 13개 마법 도감, 미발견 마법 연구 힌트 상세, 무료 1단계 힌트 공개 확인. 발견 수는 1/13 그대로 유지.
- 공개 힌트 화면: 390px에서 문서 너비 390px, 가로 넘침 없음. 브라우저 경고·오류 없음.
- 증거 화면: `phase6-live-pages.png`.
- package.json 의존성은 PHASE 4와 동일하여 기존 Linux CI 검증 잠금 파일을 사용하고 루트 버전만 6.0.0으로 갱신. 개발본의 불일치한 전이 의존성 잠금 정보도 동일하게 수정.
- 기존 PHASE 3/3.1/4 배포 폴더와 개발 node_modules 보존. 배포 폴더는 기존 의존성 폴더를 junction으로 재사용.

이 기록은 배포 후 로컬에 저장한 확인 기록이다. 이전 `phase6-verification.md`의 미배포 표시는 개발 완료 시점의 기록이며, 실제 게시 상태는 이 문서가 최신이다.
