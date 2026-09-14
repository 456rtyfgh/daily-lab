#!/usr/bin/env bash
# 오늘의 프로젝트를 GitHub 에 올린다. 맥에서 실행한다.
#
#   ./scripts/ship-mac.sh <slug>
#
# 사전 조건:
#   .staging/<slug>/          프로젝트 파일들 (README.md 포함)
#   .staging/<slug>.meta.json {slug,title,pitch,topics[],run_command,combo{domain,kind,constraint,lang}}
#   ~/Documents/.tools/secrets/github.token
#   ~/Documents/.tools/secrets/discord.webhook   (없으면 알림만 건너뜀)

set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

SLUG=${1:?사용법: ./scripts/ship-mac.sh <slug>}
DIR="$ROOT/.staging/$SLUG"
META="$ROOT/.staging/$SLUG.meta.json"
[ -d "$DIR" ]  || { echo "프로젝트 디렉터리가 없다: $DIR" >&2; exit 1; }
[ -f "$META" ] || { echo "메타 파일이 없다: $META" >&2; exit 1; }

GH=$(cat ~/Documents/.tools/secrets/github.token)
OWNER=$(curl -sS https://api.github.com/user -H "authorization: Bearer $GH" | python3 -c 'import json,sys;print(json.load(sys.stdin)["login"])')
TODAY=$(date +%F)

read -r TITLE PITCH <<<"$(python3 - "$META" <<'PY'
import json,sys
m=json.load(open(sys.argv[1],encoding="utf-8"))
print(m["title"].replace("\n"," "), "\t", m["pitch"].replace("\n"," "), sep="\t")
PY
)" || true
TITLE=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1],encoding="utf-8"))["title"])' "$META")
PITCH=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1],encoding="utf-8"))["pitch"][:350])' "$META")
TOPICS=$(python3 -c 'import json,sys;m=json.load(open(sys.argv[1],encoding="utf-8"));print(json.dumps({"names":sorted(set([t.lower() for t in m["topics"]]+["daily-lab"]))[:9]}))' "$META")

# 오늘 이미 만들었으면 중단
if python3 -c 'import json,sys;h=json.load(open("data/history.json",encoding="utf-8"));sys.exit(0 if any(x["date"]==sys.argv[1] for x in h) else 1)' "$TODAY"; then
  echo "$TODAY 는 이미 만들었다. 중단."; exit 0
fi

echo "→ repo 생성: $OWNER/$SLUG"
CODE=$(python3 -c 'import json,sys;print(json.dumps({"name":sys.argv[1],"description":sys.argv[2],"private":False,"has_wiki":False,"has_projects":False,"has_issues":False,"auto_init":False}))' "$SLUG" "$PITCH" \
  | curl -sS -o /tmp/dl_repo.json -w "%{http_code}" -X POST https://api.github.com/user/repos \
      -H "authorization: Bearer $GH" -H "accept: application/vnd.github+json" -H "content-type: application/json" --data-binary @-)
if [ "$CODE" != "201" ]; then
  echo "repo 생성 실패 ($CODE):"; python3 -c 'import json;print(json.load(open("/tmp/dl_repo.json")).get("message"))'; exit 1
fi
URL=$(python3 -c 'import json;print(json.load(open("/tmp/dl_repo.json"))["html_url"])')

curl -sS -o /dev/null -X PUT "https://api.github.com/repos/$OWNER/$SLUG/topics" \
  -H "authorization: Bearer $GH" -H "accept: application/vnd.github+json" -d "$TOPICS"

echo "→ 푸시"
( cd "$DIR"
  rm -rf .git
  git init -q -b main
  git add -A
  git -c user.name="$OWNER" -c user.email="$OWNER@users.noreply.github.com" commit -q -F - <<MSG
$TITLE

$PITCH
MSG
  git remote add origin "https://x-access-token:$GH@github.com/$OWNER/$SLUG.git"
  git push -q -u origin main )

echo "→ 기록 갱신"
python3 - "$META" "$URL" "$TODAY" <<'PY'
import json,sys,pathlib
meta=json.load(open(sys.argv[1],encoding="utf-8")); url,today=sys.argv[2],sys.argv[3]
p=pathlib.Path("data/history.json"); h=json.loads(p.read_text(encoding="utf-8"))
c=meta["combo"]
h.append({"date":today,"slug":meta["slug"],"title":meta["title"],"pitch":meta["pitch"],
          "url":url,"lang":c["lang"],"combo":"|".join([c["domain"],c["kind"],c["constraint"]]),
          "kind":c["kind"],"source":"cowork","verified":True})
p.write_text(json.dumps(h,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
PY
python3 scripts/render_index.py "$OWNER"

git add data/history.json README.md
git -c user.name="$OWNER" -c user.email="$OWNER@users.noreply.github.com" commit -q -m "log: $TODAY $TITLE"
git push -q

WH_FILE=~/Documents/.tools/secrets/discord.webhook
if [ -f "$WH_FILE" ]; then
  echo "→ Discord"
  COUNT=$(python3 -c 'import json;print(len(json.load(open("data/history.json",encoding="utf-8"))))')
  python3 - "$META" "$URL" "$COUNT" > /tmp/dl_discord.json <<'PY'
import json,sys
m=json.load(open(sys.argv[1],encoding="utf-8")); url,count=sys.argv[2],sys.argv[3]
c=m["combo"]
print(json.dumps({"embeds":[{"title":m["title"],"url":url,"description":m["pitch"],"color":5793266,
  "fields":[{"name":"카드","value":" × ".join([c["domain"],c["kind"],c["constraint"]])},
            {"name":"실행","value":"`%s`"%m["run_command"]}],
  "footer":{"text":"day %s · daily-lab"%count}}]}, ensure_ascii=False))
PY
  curl -sS -o /dev/null -w "  discord %{http_code}\n" -X POST "$(cat "$WH_FILE")" -H "content-type: application/json" --data-binary @/tmp/dl_discord.json || true
fi

rm -rf "$DIR" "$META"
echo
echo "=== $URL ==="
