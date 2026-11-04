# 인수인계서 - 화살 군단 (Arrow Legion)

최종 갱신: 2026-11-04

## 현재 상태
- 배포: GitHub Pages (main / root) → https://wanju1109.github.io/arrow-legion/
  - main에 push하면 1~2분 뒤 자동 반영된다. Cloudflare는 쓰지 않는다.
- 에버그린(evergreenjb) 커뮤니티 게시글에 iframe과 링크 카드로 올라가 있다.
  - 주소가 고정이라 push만 하면 게시글에도 반영된다.
  - iframe은 운영진이 `wanju1109.github.io/`를 허용해야 보인다.
- X-Frame-Options/CSP가 없어서 다른 사이트의 iframe에서 동작한다. 이 헤더를 추가하지 않는다.
- 최근 변경 (커밋 3089eae): 커뮤니티 피드백("돈이 적다", "보스가 약하다")을 반영해 코인 획득량을 늘리고 보스를 강화했다.

## 구성
- `index.html`: 게임 전체가 들어 있는 한 파일. 캔버스 게임이고 외부 라이브러리가 없다.
  - 효과음은 Web Audio로 합성한다.
  - 저장 데이터는 localStorage 키 `arrowLegionSave`에 들어간다: `{ level, best, coins, muted, up: { troops, power, rate } }`.
- `tools/balance-bot.js`: 밸런스 테스트용 봇. 게임에서는 쓰지 않는다.

## 게임 구조 (index.html)
- 진행: 드래그로 좌우 이동하고 궁수 군단은 자동으로 사격한다.
- 등장 요소:
  - 게이트: +, ×, ÷2. 쏘면 수치가 오른다.
  - 적: 적 무리(horde), 돌격 줄(rush), 거인(brute), 회전 톱날(saw)
  - 보상: 통(barrel), 포로 구출(cage), 강화 구슬(orb: 불화살/속사)
  - 마지막에 보스가 나온다.
- 적 강도: `sizeEnt()`가 시야에 들어온 순간의 병력 기준으로 정한다.
  - `baseDps()`, 레벨 계수 `lf = 1 + level*0.08`
- 보스 체력: `baseDps() * (8 + 1.1*min(L,20) + 0.3*max(0,L-20)) * (upMul()*buffMul)^0.3 + 20*L`
  - `upMul()`은 강화 배율, `buffMul`은 불화살·속사 구슬 배율이다.
- 보스 공격: 빨간 구역을 예고한 뒤 내려찍는다 (`pickZones` / `updateBoss` / `slam`).
  - 체력이 절반 아래가 되면 더 빨라지고, 양쪽 동시 공격도 더 자주 나온다.
  - 맞으면 병력을 `count*frac*0.5 + frac*(2+min(L,40))`만큼 잃는다.
- 코인: 모든 획득량에 `coinMul() = 1.6 + level*0.06`을 곱한다 (`addCoins` 안에서).
- 강화 (`UPS` 배열):
  - 병력: 20×1.5^lv, 최대 30
  - 공격력: 30×1.6^lv, 최대 25
  - 연사: 35×1.75^lv, 최대 10
- 진동: `buzz()`는 iframe 안에서는 동작하지 않는다.
- 오버레이 탭 보호: 실제 시간(`performance.now() - overAt`)으로 처리한다.

## 검증 방법
1. 로컬 서버를 띄운다. 예: 저장소 폴더에서 `python -m http.server 8765 --bind 127.0.0.1`
2. 새 브라우저 컨텍스트에서 `http://127.0.0.1:8765/index.html#debug`를 연다.
   - 디버그 훅 `window.__g`: `start(level)`, `step(sec)`, `paused`, `ents`, `squad`, `state`, `save`, `ups`, `btns`
3. 콘솔에서 다음을 실행한다.
   `__g.paused = true; eval(await (await fetch('tools/balance-bot.js')).text()); study('avg', 30, 3)`
   - `study(skill, maxL, reps)`: 강화를 사 가며 레벨을 진행시키고, 구간별 레벨당 판 수, 보스전 시간, 판당 코인을 보여 준다.
   - `balance()`: 강화 없이 특정 레벨의 승률을 본다.
   - 봇 실력은 `good`(회피 0.9)과 `avg`(회피 0.6)가 있다.
4. 화면을 직접 확인한다: 시작과 강화 버튼 클릭, 드래그, 콘솔 오류 없음.
5. push 후에는 Pages 배포본의 md5가 커밋한 `index.html`과 같은지 확인한다.

## 최근 봇 결과 (3089eae)
| 구간 | 결과 |
|---|---|
| 1~30레벨 (avg 봇) | 레벨당 평균 1.1판, 막히는 구간 없음, 보스전 7~10초, 판당 코인 100~1,200 |
| 50레벨 (강화 18/12/9) | 10판 중 10판 승리 |
| 110레벨 (강화 22/15/10) | 10판 중 6판 승리 |

실제 휴대폰에서의 체감 난이도는 아직 확인하지 않았다.

## 규칙
- 다른 게임의 이름, 캐릭터, 그림을 베끼지 않는다. 장르 메커니즘만 참고한다.
- 기존 저장 데이터와 호환을 유지한다. 필드를 추가할 때는 기본값을 둔다.
- 실제 플레이어 저장 데이터를 테스트에 쓰지 않는다. 테스트는 로컬 주소에서만 한다.
- push는 사용자에게 확인을 받은 뒤에 한다.
- 다른 저장소(특히 `wanju1109/our-town-fc`)는 건드리지 않는다.

## 다음 작업 후보
- 에버그린 댓글 피드백을 계속 반영한다 (코인, 난이도, 보스).
- 휴대폰에서 직접 플레이하며 난이도를 다듬는다.
