#!/usr/bin/env bash
# daily-lab 부트스트랩.
# GitHub에 컨트롤러 repo를 만들고, 시크릿을 넣고, 첫 실행을 트리거한다.
#
#   GH_PAT=ghp_xxx ANTHROPIC_API_KEY=sk-ant-xxx ./scripts/bootstrap.sh
#
# GH_PAT 필요 권한 (fine-grained 말고 classic이 편하다):
#   repo, workflow, delete_repo(선택)

set -euo pipefail
cd "$(dirname "$0")/.."

: "${GH_PAT:?GH_PAT 환경변수가 필요하다 (https://github.com/settings/tokens)}"
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY 환경변수가 필요하다 (https://console.anthropic.com)}"

REPO="${REPO_NAME:-daily-lab}"

api() {
  curl -sS -X "$1" "https://api.github.com$2" \
    -H "authorization: Bearer $GH_PAT" \
    -H "accept: application/vnd.github+json" \
    -H "x-github-api-version: 2022-11-28" \
    ${3:+-d "$3"}
}

OWNER=$(api GET /user | python3 -c 'import sys,json;print(json.load(sys.stdin)["login"])')
echo "계정: $OWNER"

echo "→ repo 생성: $OWNER/$REPO"
api POST /user/repos "$(python3 -c "
import json;print(json.dumps({
  'name': '$REPO',
  'description': 'Ships one small, actually-working program every day. Fully automated.',
  'private': False, 'has_wiki': False, 'has_projects': False, 'auto_init': False,
}))")" >/dev/null || echo "  (이미 있으면 그대로 진행)"

echo "→ 시크릿 등록"
if ! command -v gh >/dev/null; then
  echo "  gh CLI가 없다. 시크릿은 아래 주소에서 직접 넣어라:"
  echo "  https://github.com/$OWNER/$REPO/settings/secrets/actions"
  echo "    GH_PAT             = (이 토큰)"
  echo "    ANTHROPIC_API_KEY  = (이 API 키)"
else
  echo -n "$GH_PAT"            | gh secret set GH_PAT            -R "$OWNER/$REPO"
  echo -n "$ANTHROPIC_API_KEY" | gh secret set ANTHROPIC_API_KEY -R "$OWNER/$REPO"
  [ -n "${DISCORD_WEBHOOK:-}" ] && echo -n "$DISCORD_WEBHOOK" | gh secret set DISCORD_WEBHOOK -R "$OWNER/$REPO"
  [ -n "${SLACK_WEBHOOK:-}" ]   && echo -n "$SLACK_WEBHOOK"   | gh secret set SLACK_WEBHOOK   -R "$OWNER/$REPO"
  [ -n "${NOTION_TOKEN:-}" ]    && echo -n "$NOTION_TOKEN"    | gh secret set NOTION_TOKEN    -R "$OWNER/$REPO"
  [ -n "${NOTION_DB_ID:-}" ]    && echo -n "$NOTION_DB_ID"    | gh secret set NOTION_DB_ID    -R "$OWNER/$REPO"
  echo "  완료"
fi

echo "→ 코드 푸시"
git init -q -b main 2>/dev/null || true
git add -A
git -c user.name="$OWNER" -c user.email="$OWNER@users.noreply.github.com" \
    commit -q -m "daily-lab: 매일 하나씩 만드는 자동 파이프라인" || echo "  (커밋할 변경 없음)"
git remote remove origin 2>/dev/null || true
git remote add origin "https://x-access-token:$GH_PAT@github.com/$OWNER/$REPO.git"
git push -q -u origin main --force

echo
echo "끝. 이제:"
echo "  매일 KST 09:10 에 자동 실행된다."
echo "  지금 당장 한 번 돌려보려면:"
echo "    https://github.com/$OWNER/$REPO/actions/workflows/daily.yml → Run workflow"
