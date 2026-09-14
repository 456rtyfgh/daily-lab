import { seedFromDate } from './idea-space.mjs';

// API가 죽어도 잔디는 끊기지 않아야 한다.
// 폴백은 "그럴싸한 더미"가 아니라 실제로 돌아가는 프로그램을 낸다.
// 1D 엘리멘터리 오토마타 탐색기 — 그날의 시드로 규칙/폭/시작패턴이 전부 달라진다.

const slugWords = ['rule', 'cell', 'strip', 'lattice', 'echo', 'drift', 'bloom', 'weave'];

// 가운데 한 칸에서 시작했을 때 실제로 구조가 나오는 규칙들만 (Wolfram class III/IV 중심).
// 나머지 규칙은 수학적으로는 맞지만 세로 줄 하나만 그리고 끝난다 — 하루치 결과물로는 실패다.
const INTERESTING = [
  18, 22, 26, 30, 41, 45, 54, 60, 62, 73, 75, 82, 86, 89, 90, 101, 102, 105, 106,
  110, 122, 124, 126, 129, 131, 135, 137, 146, 149, 150, 151, 153, 154, 161, 165,
  167, 181, 182, 183, 190, 193, 195, 225,
];

export function fallbackProject(combo, date) {
  const seed = seedFromDate(date);
  const rule = INTERESTING[seed % INTERESTING.length];
  const width = 61 + (seed % 5) * 20; // 61 ~ 141
  const gens = 24 + (seed % 4) * 12;
  const word = slugWords[seed % slugWords.length];
  const slug = `rule-${rule}-${word}`;

  const isPy = combo.lang === 'python';
  const isHtml = combo.lang === 'html';

  const files = [];
  let run;

  if (isHtml) {
    files.push({ path: 'index.html', content: htmlSource(rule, width, gens) });
    run = 'open index.html';
  } else if (isPy) {
    files.push({ path: 'main.py', content: pySource(rule, width, gens) });
    run = `python3 main.py ${rule}`;
  } else {
    files.push({ path: 'index.js', content: jsSource(rule, width, gens) });
    files.push({
      path: 'package.json',
      content: JSON.stringify({ name: slug, version: '1.0.0', type: 'module', private: true, license: 'MIT' }, null, 2),
    });
    run = `node index.js ${rule}`;
  }

  return {
    slug,
    title: `Rule ${rule} — 1차원 세포 자동자 스트립`,
    pitch: `Elementary cellular automaton rule ${rule}, rendered as an ASCII strip. Zero dependencies.`,
    topics: ['cellular-automata', 'generative', 'ascii-art', 'zero-dependency'],
    why_interesting: `단 8비트짜리 규칙 하나가 ${width}칸짜리 띠 위에서 ${gens}세대를 굴러가면 프랙탈이 나온다. 규칙 ${rule}은 오늘 날짜에서 결정론적으로 뽑혔고, 인자를 바꾸면 나머지 253개도 전부 볼 수 있다. 상태는 두 줄만 들고 있으면 되므로 메모리는 세대 수와 무관하다.`,
    run_command: run,
    files,
    _fallback: true,
  };
}

function jsSource(rule, width, gens) {
  return `// 1차원 엘리멘터리 세포 자동자.
// 규칙 하나(0~255)가 세 칸의 이웃 상태를 다음 세대의 한 칸으로 접는다.
// 상태는 현재 세대 한 줄만 들고 있는다 — 메모리는 세대 수와 무관하다.

const ALIVE = '█';
const DEAD = ' ';

/** 규칙 번호를 8개 이웃 패턴(111..000)에 대한 비트 테이블로 편다. */
function ruleTable(rule) {
  return Array.from({ length: 8 }, (_, i) => (rule >> i) & 1);
}

/** 이웃 세 칸을 0..7 인덱스로 접는다. 경계는 원형으로 감는다. */
function step(row, table) {
  const n = row.length;
  const next = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const l = row[(i - 1 + n) % n];
    const c = row[i];
    const r = row[(i + 1) % n];
    next[i] = table[(l << 2) | (c << 1) | r];
  }
  return next;
}

function render(row) {
  let out = '';
  for (let i = 0; i < row.length; i++) out += row[i] ? ALIVE : DEAD;
  return out;
}

function main() {
  const rule = Number(process.argv[2] ?? ${rule});
  const width = Number(process.argv[3] ?? ${width});
  const gens = Number(process.argv[4] ?? ${gens});

  if (!Number.isInteger(rule) || rule < 0 || rule > 255) {
    console.error('rule must be an integer from 0 to 255. Got: ' + process.argv[2]);
    process.exit(1);
  }
  if (!Number.isInteger(width) || width < 3) {
    console.error('width must be an integer of at least 3.');
    process.exit(1);
  }

  const table = ruleTable(rule);
  let row = new Uint8Array(width);
  row[width >> 1] = 1; // 가운데 한 칸만 살려서 시작

  console.log('rule ' + rule + '  width ' + width + '  generations ' + gens);
  console.log('-'.repeat(width));
  for (let g = 0; g < gens; g++) {
    console.log(render(row));
    row = step(row, table);
  }
}

main();
`;
}

function pySource(rule, width, gens) {
  return `"""1차원 엘리멘터리 세포 자동자.

규칙 하나(0~255)가 세 칸의 이웃 상태를 다음 세대의 한 칸으로 접는다.
현재 세대 한 줄만 들고 있으므로 메모리는 세대 수와 무관하다.
"""

import sys

ALIVE = "\\u2588"
DEAD = " "


def rule_table(rule: int) -> list[int]:
    """규칙 번호를 8개 이웃 패턴에 대한 비트 테이블로 편다."""
    return [(rule >> i) & 1 for i in range(8)]


def step(row: list[int], table: list[int]) -> list[int]:
    """이웃 세 칸을 0..7 인덱스로 접는다. 경계는 원형으로 감는다."""
    n = len(row)
    return [table[(row[(i - 1) % n] << 2) | (row[i] << 1) | row[(i + 1) % n]] for i in range(n)]


def render(row: list[int]) -> str:
    return "".join(ALIVE if c else DEAD for c in row)


def main() -> int:
    args = sys.argv[1:]
    try:
        rule = int(args[0]) if len(args) > 0 else ${rule}
        width = int(args[1]) if len(args) > 1 else ${width}
        gens = int(args[2]) if len(args) > 2 else ${gens}
    except ValueError:
        print("arguments must be integers: main.py [rule] [width] [generations]", file=sys.stderr)
        return 1

    if not 0 <= rule <= 255:
        print(f"rule must be from 0 to 255. Got: {rule}", file=sys.stderr)
        return 1
    if width < 3:
        print("width must be at least 3.", file=sys.stderr)
        return 1

    table = rule_table(rule)
    row = [0] * width
    row[width // 2] = 1

    print(f"rule {rule}  width {width}  generations {gens}")
    print("-" * width)
    for _ in range(gens):
        print(render(row))
        row = step(row, table)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`;
}

function htmlSource(rule, width, gens) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rule ${rule}</title>
<style>
  :root { color-scheme: dark; --ink: #e8e6e1; --bg: #14130f; --accent: #d9a441; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--ink);
         font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
         display: flex; flex-direction: column; align-items: center; padding: 24px 16px; gap: 16px; }
  h1 { font-size: 15px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; margin: 0; color: var(--accent); }
  canvas { image-rendering: pixelated; width: 100%; max-width: 720px; border: 1px solid #2e2b24; background: #0b0a08; }
  .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: center; max-width: 720px; width: 100%; }
  label { display: flex; align-items: center; gap: 8px; }
  input[type=range] { accent-color: var(--accent); }
  output { min-width: 3ch; color: var(--accent); }
  button { background: none; border: 1px solid #3b372e; color: var(--ink); padding: 6px 14px; cursor: pointer; font: inherit; }
  button:hover { border-color: var(--accent); }
</style>
</head>
<body>
  <h1>Elementary Cellular Automaton</h1>
  <div class="controls">
    <label>rule <input id="rule" type="range" min="0" max="255" value="${rule}"><output id="ruleOut">${rule}</output></label>
    <label>width <input id="width" type="range" min="31" max="301" step="10" value="${width}"><output id="widthOut">${width}</output></label>
    <button id="random">random rule</button>
  </div>
  <canvas id="c"></canvas>
<script>
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const ruleEl = document.getElementById('rule');
  const widthEl = document.getElementById('width');
  const ruleOut = document.getElementById('ruleOut');
  const widthOut = document.getElementById('widthOut');

  // 규칙 번호를 8개 이웃 패턴에 대한 비트 테이블로 편다.
  const ruleTable = (rule) => Array.from({ length: 8 }, (_, i) => (rule >> i) & 1);

  // 이웃 세 칸을 0..7 인덱스로 접는다. 경계는 원형으로 감는다.
  function step(row, table) {
    const n = row.length;
    const next = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      next[i] = table[(row[(i - 1 + n) % n] << 2) | (row[i] << 1) | row[(i + 1) % n]];
    }
    return next;
  }

  function draw() {
    const rule = Number(ruleEl.value);
    const w = Number(widthEl.value);
    const h = Math.round(w * 0.62);
    ruleOut.textContent = rule;
    widthOut.textContent = w;

    canvas.width = w;
    canvas.height = h;
    const img = ctx.createImageData(w, h);
    const table = ruleTable(rule);
    let row = new Uint8Array(w);
    row[w >> 1] = 1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        const on = row[x];
        img.data[p] = on ? 217 : 11;
        img.data[p + 1] = on ? 164 : 10;
        img.data[p + 2] = on ? 65 : 8;
        img.data[p + 3] = 255;
      }
      row = step(row, table);
    }
    ctx.putImageData(img, 0, 0);
  }

  ruleEl.addEventListener('input', draw);
  widthEl.addEventListener('input', draw);
  document.getElementById('random').addEventListener('click', () => {
    ruleEl.value = String(Math.floor(Math.random() * 256));
    draw();
  });
  draw();
</script>
</body>
</html>
`;
}
