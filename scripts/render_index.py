#!/usr/bin/env python3
"""data/history.json 으로 daily-lab 의 README 인덱스를 다시 그린다.

맥에는 node 가 없어서 python3 으로 같은 일을 한다 (macOS 기본 3.9 에서 동작).
"""
import json, sys, collections, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OWNER = sys.argv[1] if len(sys.argv) > 1 else "456rtyfgh"

history = json.loads((ROOT / "data" / "history.json").read_text(encoding="utf-8"))

rows = "\n".join(
    "| {date} | [{title}]({url}) | `{kind}` | {lang} |".format(**h)
    for h in reversed(history[-60:])
) or "| - | 아직 없음 | - | - |"

counts = collections.Counter(h["kind"] for h in history)
kinds = " · ".join("`%s` %d" % (k, n) for k, n in counts.most_common()) or "-"
first = history[0]["date"] if history else "-"
last = history[-1]["date"] if history else "-"
overflow = (
    "\n> 전체 기록은 [`data/history.json`](data/history.json)에 있다.\n"
    if len(history) > 60 else ""
)

(ROOT / "README.md").write_text(f"""# daily-lab

매일 하나씩, 작지만 진짜로 돌아가는 프로그램을 만든다.

주제는 매일 세 장의 카드(**소재 × 형태 × 제약**)로 자동으로 뽑히고,
Claude 가 그 조합에 맞는 프로젝트를 설계·구현하면,
문법 검사와 실제 실행을 통과한 것만 새 repo 로 올라간다.

```
{len(history)}개 · {first} ~ {last}
{kinds}
```

## 기록

| 날짜 | 프로젝트 | 형태 | 언어 |
|---|---|---|---|
{rows}
{overflow}
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

*[{OWNER}](https://github.com/{OWNER}) · 자동 생성*
""", encoding="utf-8")

print("README.md 갱신 — %d개 기록" % len(history))
