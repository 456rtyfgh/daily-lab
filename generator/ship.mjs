// 이미 만들어진 프로젝트 디렉터리를 받아서 검증 → repo 생성 → 푸시 → 인덱스 갱신 → 알림.
// Claude가 직접 파일을 쓴 경우(Cowork 스케줄 세션)에 쓴다. API 키가 필요 없다.
//
//   node generator/ship.mjs <프로젝트_디렉터리> <메타.json>
//
// 메타.json 형식:
//   { slug, title, pitch, topics: [], why_interesting, run_command,
//     combo: { domain, kind, constraint, lang } }

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { verifyProject } from './verify.mjs';
import { notify } from './connectors.mjs';
import { renderIndex } from './publish.mjs';
import { readHistory, today } from './generate.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const HISTORY = path.join(ROOT, 'data', 'history.json');

function token() {
  const t = process.env.GH_PAT || process.env.GITHUB_TOKEN;
  if (!t) throw new Error('GH_PAT 환경변수가 없다');
  return t;
}

async function gh(method, endpoint, body) {
  const res = await fetch('https://api.github.com' + endpoint, {
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
  if (!res.ok) throw new Error(`GitHub ${method} ${endpoint} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

const sh = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

function renderReadme(m, date, owner) {
  return `# ${m.title}

> ${m.pitch}

**${date}** · daily-lab day project

## 뭐 하는 건가

${m.why_interesting}

## 어떻게 만들어졌나

매일 자동으로 뽑히는 세 장의 카드로 설계됐다.

| 카드 | 값 |
|---|---|
| 소재 | ${m.combo.domain} |
| 형태 | ${m.combo.kind} |
| 제약 | ${m.combo.constraint} |

## 실행

\`\`\`bash
${m.run_command}
\`\`\`

---

매일 하나씩 만드는 [daily-lab](https://github.com/${owner}/daily-lab)에서 자동 생성됐다.
`;
}

async function main() {
  const dir = path.resolve(process.argv[2] || '');
  const metaPath = path.resolve(process.argv[3] || '');
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`디렉터리가 없다: ${dir}`);
  if (!fs.existsSync(metaPath)) throw new Error(`메타 파일이 없다: ${metaPath}`);

  const m = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  for (const k of ['slug', 'title', 'pitch', 'topics', 'why_interesting', 'run_command', 'combo']) {
    if (!m[k]) throw new Error(`메타에 ${k} 가 없다`);
  }
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(m.slug)) throw new Error(`slug 형식 위반: ${m.slug}`);

  const date = m.date || today();
  const history = readHistory();
  if (history.some((h) => h.date === date)) {
    console.log(`${date} 는 이미 만들었다. 중단.`);
    return;
  }

  console.log('검증 중...');
  const problems = await verifyProject(dir, m.combo.lang || 'javascript');
  if (problems.length) {
    console.error('문제:\n' + problems.map((p) => '  - ' + p).join('\n'));
    if (process.env.STRICT !== '0') throw new Error('검증 실패. 코드를 고치고 다시 실행해라. (STRICT=0 으로 무시 가능)');
  }
  console.log('  통과');

  const owner = (await gh('GET', '/user')).login;

  // README는 항상 여기서 붙인다 (Claude가 안 써도 됨)
  if (!fs.existsSync(path.join(dir, 'README.md'))) {
    fs.writeFileSync(path.join(dir, 'README.md'), renderReadme(m, date, owner));
  }

  let slug = m.slug;
  let repo;
  try {
    repo = await gh('POST', '/user/repos', {
      name: slug,
      description: m.pitch.slice(0, 350),
      private: false,
      has_issues: false,
      has_wiki: false,
      has_projects: false,
      auto_init: false,
    });
  } catch (err) {
    if (!/already exists/i.test(err.message)) throw err;
    slug = `${slug}-${date.replace(/-/g, '').slice(2)}`;
    console.warn(`  이름 충돌 → ${slug}`);
    repo = await gh('POST', '/user/repos', { name: slug, description: m.pitch.slice(0, 350), private: false, auto_init: false });
  }

  const names = [...new Set([...m.topics.map((t) => t.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '')).filter(Boolean), 'daily-lab'])].slice(0, 9);
  await gh('PUT', `/repos/${owner}/${slug}/topics`, { names });

  fs.rmSync(path.join(dir, '.git'), { recursive: true, force: true });
  sh('git', ['init', '-q', '-b', 'main'], dir);
  sh('git', ['config', 'user.name', owner], dir);
  sh('git', ['config', 'user.email', `${owner}@users.noreply.github.com`], dir);
  sh('git', ['add', '-A'], dir);
  sh('git', ['commit', '-q', '-m', `${m.title}\n\n${m.pitch}\n\ncards: ${m.combo.domain} / ${m.combo.kind} / ${m.combo.constraint}`], dir);
  sh('git', ['remote', 'add', 'origin', `https://x-access-token:${token()}@github.com/${owner}/${slug}.git`], dir);
  sh('git', ['push', '-q', '-u', 'origin', 'main'], dir);
  console.log(`푸시 완료: ${repo.html_url}`);

  history.push({
    date, slug, title: m.title, pitch: m.pitch, url: repo.html_url,
    lang: m.combo.lang, combo: `${m.combo.domain}|${m.combo.kind}|${m.combo.constraint}`,
    kind: m.combo.kind, source: 'cowork', verified: problems.length === 0,
  });
  fs.mkdirSync(path.dirname(HISTORY), { recursive: true });
  fs.writeFileSync(HISTORY, JSON.stringify(history, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, 'README.md'), renderIndex(history, owner));

  await notify({
    spec: { title: m.title, pitch: m.pitch, run_command: m.run_command, why_interesting: m.why_interesting, topics: m.topics },
    combo: { domain: m.combo.domain, artifact: { kind: m.combo.kind }, constraint: m.combo.constraint, combo: '', lang: m.combo.lang },
    date, url: repo.html_url, count: history.length, source: 'cowork', problems,
  });

  console.log(`\n=== day ${history.length} · ${repo.html_url} ===`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
