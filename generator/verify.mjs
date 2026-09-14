import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * 생성된 프로젝트를 실제로 굴려본다.
 * 안 돌아가는 코드를 올리면 잔디는 깔려도 repo는 쓰레기가 된다.
 */
export async function verifyProject(dir, lang) {
  const problems = [];
  const files = fs.readdirSync(dir, { recursive: true }).filter((f) => fs.statSync(path.join(dir, f)).isFile());

  for (const rel of files) {
    const abs = path.join(dir, rel);
    try {
      if (/\.(js|mjs)$/.test(rel)) {
        // 문법 검사만: 실행 부작용 없이 파싱되는지
        await run('node', ['--check', abs], { timeout: 20_000 });
      } else if (rel.endsWith('.py')) {
        await run('python3', ['-m', 'py_compile', abs], { timeout: 20_000 });
      } else if (rel.endsWith('.html')) {
        const src = fs.readFileSync(abs, 'utf8');
        if (!/<!doctype html>/i.test(src)) problems.push(`${rel}: doctype 없음`);
        if (/(src|href)=["']https?:\/\//i.test(src)) problems.push(`${rel}: 외부 CDN 참조 (오프라인에서 깨짐)`);
        const opens = (src.match(/<script\b/gi) || []).length;
        const closes = (src.match(/<\/script>/gi) || []).length;
        if (opens !== closes) problems.push(`${rel}: script 태그 짝이 안 맞음`);
      }
    } catch (err) {
      problems.push(`${rel}: ${String(err.stderr || err.message).trim().split('\n').slice(0, 3).join(' / ')}`);
    }
  }

  // 엔트리 실제 실행 (html 제외). 출력이 아예 없으면 의심한다.
  if (lang !== 'html') {
    const entry = files.find((f) => /^(index|main|cli|app)\.(js|mjs|py)$/.test(f)) || files.find((f) => /\.(js|mjs|py)$/.test(f));
    if (entry) {
      const cmd = entry.endsWith('.py') ? 'python3' : 'node';
      try {
        const { stdout } = await run(cmd, [path.join(dir, entry)], { timeout: 25_000, cwd: dir, maxBuffer: 4 << 20 });
        if (!stdout.trim()) problems.push(`${entry}: 실행은 됐지만 출력이 없음`);
      } catch (err) {
        if (err.killed) problems.push(`${entry}: 25초 안에 안 끝남 (무한 루프 의심)`);
        else problems.push(`${entry} 실행 실패: ${String(err.stderr || err.message).trim().split('\n')[0]}`);
      }
    }
  }

  return problems;
}

if (import.meta.filename === process.argv[1]) {
  const dir = process.argv[2];
  const lang = process.argv[3] || 'javascript';
  verifyProject(dir, lang).then((p) => {
    if (p.length) {
      console.error('문제:\n' + p.map((x) => '  - ' + x).join('\n'));
      process.exit(1);
    }
    console.log('검증 통과');
  });
}
