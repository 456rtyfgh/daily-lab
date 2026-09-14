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
| `generator/verify.mjs` | 생성물을 실제로 실행해 본다 |
| `scripts/ship-mac.sh` | repo 생성 · 푸시 · 인덱스 갱신 · Discord |
| `generator/generate.mjs` | (Actions 백업 경로) Claude API 로 생성 |
| `generator/fallback.mjs` | (Actions 백업 경로) API 가 죽었을 때 |

## 왜 맥에서 도나

클라우드 세션은 GitHub API 가 정책으로 막혀 있다. 그래서 코드를 쓰는 일은
클라우드에서, repo 를 만들고 푸시하는 일은 맥에서 한다. `scripts/ship-mac.sh`
가 맥 쪽 절반을 전부 맡는다.

---

*[{OWNER}](https://github.com/{OWNER}) · 자동 생성*
""", encoding="utf-8")

print("README.md 갱신 — %d개 기록" % len(history))
