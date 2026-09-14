import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generate, readHistory } from './generate.mjs';
import { verifyProject } from './verify.mjs';
import { notify } from './connectors.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const HISTORY = path.join(ROOT, 'data', 'history.json');
const GH = 'https://api.github.com';

function token() {
  const t = process.env.GH_PAT || process.env.GITHUB_TOKEN;
  if (!t) throw new Error('GH_PAT 환경변수가 없다 (repo 생성 권한이 있는 PAT 필요)');
  return t;
}

async function gh(method, endpoint, body) {
  const res = await fetch(GH + endpoint, {
    method,
    headers: {
      authorization: `Bearer ${token()}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
      'user-agent': 'daily-lab',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${method} ${endpoint} → ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}

function sh(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

export async function publish({ dry = process.env.DRY_RUN === '1' } = {}) {
  const { spec, combo, date, source, dir } = await generate();

  console.log('검증 중...');
  const problems = await verifyProject(dir, spec.lang || combo.lang);
  if (problems.length) {
    console.error('생성물이 검증을 통과하지 못했다:\n' + problems.map((p) => '  - ' + p).join('\n'));
    if (process.env.STRICT === '1') throw new Error('STRICT 모드: 중단');
    console.warn('  경고로 넘기고 계속 진행한다 (STRICT=1로 막을 수 있다)');
  } else {
    console.log('  통과');
  }

  if (dry) {
    console.log(`[DRY RUN] ${spec.slug} 를 만들었지만 푸시하지 않는다. 결과: ${dir}`);
    return { spec, combo, date, source, url: null, dry: true };
  }

  const me = await gh('GET', '/user');
  const owner = me.login;

  console.log(`repo 생성: ${owner}/${spec.slug}`);
  let repo;
  try {
    repo = await gh('POST', '/user/repos', {
      name: spec.slug,
      description: spec.pitch.slice(0, 350),
      private: false,
      has_issues: false,
      has_wiki: false,
      has_projects: false,
      auto_init: false,
    });
  } catch (err) {
    if (!/already exists/i.test(err.message)) throw err;
    console.warn('  이미 있는 이름 → 날짜 접미사를 붙여 재시도');
    spec.slug = `${spec.slug}-${Date.now().toString(36).slice(-4)}`;
    repo = await gh('POST', '/user/repos', { name: spec.slug, description: spec.pitch.slice(0, 350), private: false, auto_init: false });
  }

  if (spec.topics?.length) {
    const names = spec.topics.map((t) => t.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')).filter(Boolean).slice(0, 8);
    await gh('PUT', `/repos/${owner}/${spec.slug}/topics`, { names: [...new Set([...names, 'daily-lab'])] });
  }

  // 푸시
  const authUrl = `https://x-access-token:${token()}@github.com/${owner}/${spec.slug}.git`;
  sh('git', ['init', '-q', '-b', 'main'], dir);
  sh('git', ['config', 'user.name', process.env.GIT_NAME || 'daily-lab bot'], dir);
  sh('git', ['config', 'user.email', process.env.GIT_EMAIL || 'daily-lab@users.noreply.github.com'], dir);
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-q', '-m', `${spec.title}\n\n${spec.pitch}\n\ncards: ${combo.domain} / ${combo.artifact.kind} / ${combo.constraint}`], dir);
  sh('git', ['remote', 'add', 'origin', authUrl], dir);
  sh('git', ['push', '-q', '-u', 'origin', 'main'], dir);
  console.log(`  푸시 완료: ${repo.html_url}`);

  // 히스토리 갱신 (컨트롤러 repo에도 커밋 → 여기 잔디도 같이 깔린다)
  const history = readHistory();
  history.push({
    date,
    slug: spec.slug,
    title: spec.title,
    pitch: spec.pitch,
    url: repo.html_url,
    lang: combo.lang,
    combo: combo.combo,
    kind: combo.artifact.kind,
    source,
    verified: problems.length === 0,
  });
  fs.mkdirSync(path.dirname(HISTORY), { recursive: true });
  fs.writeFileSync(HISTORY, JSON.stringify(history, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'README.md'), renderIndex(history, owner));

  await notify({ spec, combo, date, url: repo.html_url, count: history.length, source, problems });

  return { spec, combo, date, source, url: repo.html_url, count: history.length };
}

export function renderIndex(history, owner) {
  const rows = [...history]
    .reverse()
    .slice(0, 60)
    .map((h) => `| ${h.date} | [${h.title}](${h.url}) | \`${h.kind}\` | ${h.lang} |`)
    .join('\n');

  const byKind = {};
  for (const h of history) byKind[h.kind] = (byKind[h.kind] || 0) + 1;
  const kinds = Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, n]) => `\`${k}\` ${n}`).join(' · ');

  const first = history[0]?.date ?? '-';
  const last = history.at(-1)?.date ?? '-';

  return `# daily-lab

매일 하나씩, 작지만 진짜로 돌아가는 프로그램을 만든다.

주제는 매일 세 장의 카드(**소재 × 형태 × 제약**)로 자동으로 뽑히고,
Claude 가 그 조합에 맞는 프로젝트를 설계·구현하면,
문법 검사와 실제 실행을 통과한 것만 새 repo 로 올라간다.

\`\`\`
${history.length}개 · ${first} ~ ${last}
${kinds || '-'}
\`\`\`

## 기록

| 날짜 | 프로젝트 | 형태 | 언어 |
|---|---|---|---|
${rows || '| - | 아직 없음 | - | - |'}
${history.length > 60 ? '\n> 전체 기록은 [\`data/history.json\`](data/history.json)에 있다.\n' : ''}
## 구조

| 파일 | 역할 |
|---|---|
| \`generator/idea-space.mjs\` | 카드 덱. 20 × 12 × 16 = 3840 조합 |
| \`generator/pick.mjs\` | 오늘의 카드를 뽑는다 (API 호출 없음) |
| \`generator/generate.mjs\` | Claude API 로 그날의 프로젝트를 설계·구현 |
| \`generator/verify.mjs\` | 생성물을 실제로 실행해 본다 |
| \`generator/fallback.mjs\` | API 가 죽어도 잔디는 안 끊긴다 |
| \`generator/publish.mjs\` | repo 생성 · 푸시 · 인덱스 갱신 |
| \`generator/connectors.mjs\` | Discord / Slack / Notion / 웹훅 알림 |
| \`scripts/ship-mac.sh\` | (수동 경로) 맥에서 올릴 때 쓰는 스크립트 |

## 어떻게 도나

\`.github/workflows/daily.yml\` 이 매일 KST 09:10 에 GitHub 러너에서 돈다.
아침 실행이 실패하면 22:10 에 한 번 더 시도하고, 이미 오늘치가 있으면 건너뛴다.

---

*[${owner}](https://github.com/${owner}) · 자동 생성*
`;
}

if (import.meta.filename === process.argv[1]) {
  publish().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
