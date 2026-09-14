import fs from 'node:fs';
import path from 'node:path';
import { pickCombo } from './idea-space.mjs';
import { pickModel, complete } from './anthropic.mjs';
import { fallbackProject } from './fallback.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const BUILD = path.join(ROOT, 'build');
const HISTORY = path.join(ROOT, 'data', 'history.json');

export function today() {
  // 실행은 UTC지만 잔디는 사용자 기준. KST(UTC+9)로 날짜를 센다.
  const tz = process.env.TZ_OFFSET_HOURS ? Number(process.env.TZ_OFFSET_HOURS) : 9;
  return new Date(Date.now() + tz * 3600_000).toISOString().slice(0, 10);
}

export function readHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY, 'utf8'));
  } catch {
    return [];
  }
}

const SPEC_TOOL = {
  name: 'emit_project',
  description: '오늘의 미니 프로젝트를 완성된 파일 묶음으로 제출한다.',
  input_schema: {
    type: 'object',
    properties: {
      slug: {
        type: 'string',
        description: 'GitHub repo 이름. 소문자-하이픈, 3~40자, 영문만. 주제가 드러나는 이름.',
      },
      title: { type: 'string', description: '한 줄 제목 (한국어)' },
      pitch: { type: 'string', description: 'GitHub repo description. 영문 100자 이내, 무엇을 하는지.' },
      topics: {
        type: 'array',
        items: { type: 'string' },
        description: 'GitHub topics. 소문자-하이픈 3~6개.',
      },
      why_interesting: { type: 'string', description: '이게 왜 만들 가치가 있는지 2~3문장 (한국어)' },
      run_command: { type: 'string', description: '실행 방법 한 줄. 예: node index.js 42' },
      files: {
        type: 'array',
        description: '실제 파일들. 2~6개. README.md는 넣지 마라(자동 생성).',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'repo 루트 기준 상대 경로' },
            content: { type: 'string', description: '파일 전체 내용' },
          },
          required: ['path', 'content'],
        },
      },
    },
    required: ['slug', 'title', 'pitch', 'topics', 'why_interesting', 'run_command', 'files'],
  },
};

const SYSTEM = `너는 매일 하나씩 작고 단단한 프로그램을 만드는 엔지니어다.

원칙:
- 진짜로 돌아가야 한다. 붙여넣고 바로 실행되지 않는 코드는 실패다.
- 외부 패키지 금지. Node 표준 라이브러리, Python 표준 라이브러리, 브라우저 내장 API만 쓴다.
- 튜토리얼 코드 말고 완성품을 만든다. TODO, "여기에 구현", 생략 주석 금지.
- 규모는 100~300줄. 하루치다. 프레임워크를 세우지 마라.
- 흔한 주제(todo 앱, 계산기, 가위바위보, 숫자 맞추기)는 금지. 주어진 조합을 진지하게 밀어붙여라.
- 주석은 한국어, 식별자와 문자열 출력은 영어.
- html이면 <!doctype html>로 시작하는 단일 파일. CSS와 JS를 안에 인라인한다. CDN 금지.
- javascript면 ESM(.mjs 아님, package.json에 type:module)으로 node에서 바로 실행.
- python이면 python3 표준 라이브러리만.

emit_project 도구로만 답한다. 설명을 따로 쓰지 마라.`;

function buildPrompt(combo, history) {
  const recent = history.slice(-25).map((h) => `- ${h.slug}: ${h.title}`).join('\n') || '(없음)';
  return `오늘의 조합:
- 소재: ${combo.domain}
- 형태: ${combo.artifact.kind} — ${combo.artifact.hint}
- 제약: ${combo.constraint}
- 언어: ${combo.lang}

이 세 개를 전부 만족하는 프로젝트 하나를 만들어라. 제약은 장식이 아니라 설계의 중심이어야 한다.

최근에 만든 것들 (절대 겹치지 마라):
${recent}

emit_project를 호출해라.`;
}

const BAD_PATH = /(^\/|\.\.|^\.git\/|^node_modules\/)/;

function validate(spec, combo) {
  const errs = [];
  if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(spec.slug || '')) errs.push(`slug 형식 위반: ${spec.slug}`);
  if (!Array.isArray(spec.files) || spec.files.length === 0) errs.push('files 비어 있음');
  for (const f of spec.files || []) {
    if (!f.path || BAD_PATH.test(f.path)) errs.push(`위험한 경로: ${f.path}`);
    if (typeof f.content !== 'string' || f.content.trim().length < 20) errs.push(`내용이 빈 파일: ${f.path}`);
    if (/\bTODO\b|여기에 구현|구현하세요|\.\.\.$/m.test(f.content || '')) errs.push(`미완성 흔적: ${f.path}`);
  }
  const hasEntry = (spec.files || []).some((f) => /\.(mjs|js|py|html)$/.test(f.path));
  if (!hasEntry) errs.push('실행 가능한 엔트리 파일이 없음');
  if (combo.lang === 'html' && !(spec.files || []).some((f) => f.path.endsWith('.html'))) {
    errs.push('html 프로젝트인데 .html 파일이 없음');
  }
  return errs;
}

function renderReadme(spec, combo, date) {
  const files = spec.files.map((f) => `- \`${f.path}\``).join('\n');
  return `# ${spec.title}

> ${spec.pitch}

**${date}** · daily-lab day project

## 뭐 하는 건가

${spec.why_interesting}

## 어떻게 만들어졌나

이 프로젝트는 매일 자동으로 뽑히는 세 장의 카드로 설계됐다.

| 카드 | 값 |
|---|---|
| 소재 | ${combo.domain} |
| 형태 | ${combo.artifact.kind} |
| 제약 | ${combo.constraint} |

## 실행

\`\`\`bash
${spec.run_command}
\`\`\`

## 파일

${files}

---

매일 하나씩 만드는 [daily-lab](https://github.com/${process.env.GITHUB_OWNER || 'me'}/daily-lab)에서 자동 생성됐다.
`;
}

export async function generate({ date = today(), dry = false } = {}) {
  const history = readHistory();
  const combo = pickCombo(date, history);
  console.log(`[${date}] 조합: ${combo.domain} / ${combo.artifact.kind} / ${combo.constraint} (${combo.lang})`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  let spec;
  let source = 'claude';

  if (!apiKey || dry) {
    console.warn('  ANTHROPIC_API_KEY 없음 → 폴백 생성기 사용');
    spec = fallbackProject(combo, date);
    source = 'fallback';
  } else {
    const model = await pickModel(apiKey);
    console.log(`  모델: ${model}`);
    let lastErrs = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await complete(apiKey, {
        model,
        system: SYSTEM,
        user:
          buildPrompt(combo, history) +
          (lastErrs.length ? `\n\n직전 시도가 아래 이유로 거절됐다. 고쳐서 다시 제출해라:\n${lastErrs.join('\n')}` : ''),
        tools: [SPEC_TOOL],
        toolChoice: { type: 'tool', name: 'emit_project' },
      });
      const block = res.content.find((c) => c.type === 'tool_use');
      if (!block) {
        lastErrs = ['도구를 호출하지 않았다'];
        continue;
      }
      const candidate = block.input;
      const errs = validate(candidate, combo);
      if (!errs.length) {
        spec = candidate;
        break;
      }
      console.warn(`  검증 실패 (${attempt + 1}/3): ${errs.join(', ')}`);
      lastErrs = errs;
    }
    if (!spec) {
      console.warn('  3회 실패 → 폴백 생성기로 전환 (잔디는 끊지 않는다)');
      spec = fallbackProject(combo, date);
      source = 'fallback';
    }
  }

  // slug 충돌 방지: 과거에 쓴 이름이면 날짜를 붙인다.
  if (history.some((h) => h.slug === spec.slug)) spec.slug = `${spec.slug}-${date.replace(/-/g, '').slice(2)}`;

  fs.rmSync(BUILD, { recursive: true, force: true });
  const out = path.join(BUILD, spec.slug);
  fs.mkdirSync(out, { recursive: true });
  for (const f of spec.files) {
    const dest = path.join(out, f.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, f.content.endsWith('\n') ? f.content : f.content + '\n');
  }
  fs.writeFileSync(path.join(out, 'README.md'), renderReadme(spec, combo, date));
  if (combo.lang === 'javascript' && !spec.files.some((f) => f.path === 'package.json')) {
    fs.writeFileSync(
      path.join(out, 'package.json'),
      JSON.stringify({ name: spec.slug, version: '1.0.0', type: 'module', private: true, license: 'MIT' }, null, 2) + '\n',
    );
  }
  fs.writeFileSync(path.join(BUILD, 'spec.json'), JSON.stringify({ ...spec, combo, date, source }, null, 2));
  console.log(`  생성: ${spec.slug} (${spec.files.length + 1}개 파일, source=${source})`);
  return { spec, combo, date, source, dir: out };
}

if (import.meta.filename === process.argv[1]) {
  generate({ dry: process.argv.includes('--dry') }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
