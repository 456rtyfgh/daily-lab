# daily-lab

매일 하나씩, 작지만 진짜로 돌아가는 프로그램을 만든다.

주제는 매일 세 장의 카드(**소재 × 형태 × 제약**)로 자동으로 뽑히고,
Claude가 그 조합에 맞는 프로젝트를 설계·구현하면,
문법 검사와 실제 실행을 통과한 것만 새 repo로 올라간다.

```
0개 · - ~ -
-
```

## 기록

| 날짜 | 프로젝트 | 형태 | 언어 |
|---|---|---|---|
| - | 아직 없음 | - | - |


## 구조

| 파일 | 역할 |
|---|---|
| `generator/idea-space.mjs` | 카드 덱. 20 × 12 × 16 = 3840 조합 |
| `generator/generate.mjs` | Claude API 호출 + 스키마 검증 + 재시도 |
| `generator/verify.mjs` | 생성물을 실제로 실행해 본다 |
| `generator/fallback.mjs` | API가 죽어도 잔디는 안 끊긴다 |
| `generator/publish.mjs` | repo 생성 · 푸시 · 인덱스 갱신 |
| `generator/connectors.mjs` | Discord / Slack / Notion / 웹훅 알림 |

## 직접 돌려보기

```bash
npm run dry     # API 없이 폴백으로 생성만
npm run gen     # Claude로 생성만 (푸시 안 함)
npm run publish # 생성 + 검증 + repo 푸시
```

---

*[456rtyfgh](https://github.com/456rtyfgh) · 자동 생성*
