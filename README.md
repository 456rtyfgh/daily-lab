# daily-lab

매일 하나씩, 작지만 진짜로 돌아가는 프로그램을 만든다.

주제는 매일 세 장의 카드(**소재 × 형태 × 제약**)로 자동으로 뽑히고,
Claude 가 그 조합에 맞는 프로젝트를 설계·구현하면,
문법 검사와 실제 실행을 통과한 것만 새 repo 로 올라간다.

```
8개 · 2026-09-14 ~ 2026-09-20
`benchmark` 3 · `simulation` 2 · `cli` 1 · `algorithm` 1 · `library` 1
```

## 기록

| 날짜 | 프로젝트 | 형태 | 언어 |
|---|---|---|---|
| 2026-09-20 | [36×12 미로 — 만들고, 푼다](https://github.com/456rtyfgh/maze-36x12-4h1) | `benchmark` | javascript |
| 2026-09-19 | [28×9 미로 — 만들고, 푼다](https://github.com/456rtyfgh/maze-28x9-22u) | `benchmark` | javascript |
| 2026-09-18 | [개미 규칙 RL — 튜밋 격자](https://github.com/456rtyfgh/ant-rl-13) | `simulation` | python |
| 2026-09-17 | [Rule 18 — 1차원 세포 자동자](https://github.com/456rtyfgh/rule-18-echo) | `library` | javascript |
| 2026-09-16 | [울람 나선 101×101 — 소수는 흩어지지 않는다](https://github.com/456rtyfgh/ulam-spiral-101-4qi) | `benchmark` | javascript |
| 2026-09-15 | [28×21 미로 — 만들고, 푼다](https://github.com/456rtyfgh/maze-28x21-72r) | `algorithm` | javascript |
| 2026-09-14 | [개미 규칙 LRRRRRLLR — 튜밋 격자](https://github.com/456rtyfgh/ant-lrrrrrllr-7q) | `simulation` | python |
| 2026-09-14 | [세 몸이 그리는 8자 — ASCII N-body 시뮬레이터](https://github.com/456rtyfgh/verlet-orbits-ascii) | `cli` | javascript |

## 구조

| 파일 | 역할 |
|---|---|
| `generator/idea-space.mjs` | 카드 덱. 20 × 12 × 16 = 3840 조합 |
| `generator/pick.mjs` | 오늘의 카드를 뽑는다 (API 호출 없음) |
| `generator/generate.mjs` | Claude API 로 그날의 프로젝트를 설계·구현 |
| `generator/verify.mjs` | 생성물을 실제로 실행해 본다 |
| `generator/fallback.mjs` | API 가 죽어도 잔디는 안 끊긴다 |
| `generator/publish.mjs` | repo 생성 · 푸시 · 인덱스 갱신 |
| `generator/connectors.mjs` | Discord / Slack / Notion / 웹훅 알림 |
| `scripts/ship-mac.sh` | (수동 경로) 맥에서 올릴 때 쓰는 스크립트 |

## 어떻게 도나

`.github/workflows/daily.yml` 이 매일 KST 09:10 에 GitHub 러너에서 돈다.
아침 실행이 실패하면 22:10 에 한 번 더 시도하고, 이미 오늘치가 있으면 건너뛴다.

---

*[456rtyfgh](https://github.com/456rtyfgh) · 자동 생성*
