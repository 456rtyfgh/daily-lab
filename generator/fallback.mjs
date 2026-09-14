import { seedFromDate } from './idea-space.mjs';

// API 가 없거나 죽어도 잔디는 끊기지 않아야 한다.
// 폴백은 "그럴싸한 더미" 가 아니라 실제로 돌아가는 프로그램을 낸다.
//
// 여섯 갈래를 날짜 시드로 번갈아 고른다. 갈래마다 시드로 파라미터가 또 달라지므로
// 매일 다른 결과가 나온다. 카드(소재/형태/제약)는 이 경로에서는 쓰이지 않는다 —
// 카드를 해석하는 일은 모델의 몫이고, 폴백은 모델이 없을 때 도는 길이기 때문이다.

// 가운데 한 칸에서 시작했을 때 실제로 구조가 나오는 규칙들만 (Wolfram class III/IV 중심).
const INTERESTING = [
  18, 22, 26, 30, 41, 45, 54, 60, 62, 73, 75, 82, 86, 89, 90, 101, 102, 105, 106,
  110, 122, 124, 126, 129, 131, 135, 137, 146, 149, 150, 151, 153, 154, 161, 165,
  167, 181, 182, 183, 190, 193, 195, 225,
];
const slugWords = ['rule', 'cell', 'strip', 'lattice', 'echo', 'drift', 'bloom', 'weave'];
const antRules = ['LR', 'RL', 'LLRR', 'LRRL', 'RLLR', 'LRRRRRLLR', 'LLRRRLRLRLLR', 'RRLLLRLLLQ'.replace(/Q/, 'R')];

export function fallbackProject(combo, date) {
  const seed = seedFromDate(date);
  const families = [cellularAutomaton, langtonsAnt, maze, ulamSpiral];
  const pick = families[seed % families.length];
  return pick(seed, combo);
}

// ---------------------------------------------------------------- 1D 세포 자동자

function cellularAutomaton(seed, combo) {
  const rule = INTERESTING[seed % INTERESTING.length];
  const width = 61 + (seed % 5) * 20;
  const gens = 24 + (seed % 4) * 12;
  const slug = `rule-${rule}-${slugWords[seed % slugWords.length]}`;
  const lang = combo.lang === 'html' ? 'html' : combo.lang === 'python' ? 'python' : 'javascript';

  const files = [];
  let run;
  if (lang === 'html') {
    files.push({ path: 'index.html', content: htmlSource(rule, width, gens) });
    run = 'open index.html';
  } else if (lang === 'python') {
    files.push({ path: 'main.py', content: pySource(rule, width, gens) });
    run = `python3 main.py ${rule}`;
  } else {
    files.push({ path: 'index.js', content: jsSource(rule, width, gens) });
    run = `node index.js ${rule}`;
  }

  return {
    slug,
    lang,
    title: `Rule ${rule} — 1차원 세포 자동자`,
    pitch: `Elementary cellular automaton rule ${rule}, rendered as an ASCII strip. Zero dependencies.`,
    topics: ['cellular-automata', 'generative', 'ascii-art', 'zero-dependency'],
    why_interesting: `8비트짜리 규칙 하나가 ${width}칸 띠 위에서 ${gens}세대를 굴러가면 프랙탈이 나온다. 상태는 현재 한 줄만 들고 있으면 되므로 메모리는 세대 수와 무관하다. 인자를 바꾸면 나머지 255개 규칙도 전부 볼 수 있다.`,
    run_command: run,
    files,
    _fallback: true,
    _note: `규칙 ${rule} · 폭 ${width} · ${gens}세대`,
  };
}

// ---------------------------------------------------------------- 랭턴의 개미

function langtonsAnt(seed) {
  const rule = antRules[seed % antRules.length];
  const steps = [6000, 12000, 40000, 120000][(seed >>> 3) % 4];
  const width = 81 + ((seed >>> 5) % 3) * 20;
  const slug = `ant-${rule.toLowerCase()}-${(seed % 997).toString(36)}`;

  return {
    slug,
    lang: 'python',
    title: `개미 규칙 ${rule} — 튜밋 격자`,
    pitch: `Generalized Langton's ant (turmite) rule ${rule}, drawn as ASCII. Zero dependencies.`,
    topics: ['langtons-ant', 'turmite', 'cellular-automata', 'ascii-art', 'emergence'],
    why_interesting: `규칙은 L 과 R 로 된 문자열 하나가 전부다. 그런데 "LR" 은 만 보쯤에서 갑자기 고속도로를 놓기 시작하고, 색이 셋 이상이면 삼각형이나 나선 같은 구조가 나온다. 어느 규칙이 무엇을 그릴지는 돌려 보기 전에는 아무도 모른다 — 그래서 ${steps}보를 돌린다.`,
    run_command: `python3 main.py ${rule} ${steps} ${width}`,
    files: [{ path: 'main.py', content: antSource(rule, steps, width) }],
    _fallback: true,
    _note: `규칙 ${rule} · ${steps}보 · 폭 ${width}`,
  };
}

// ---------------------------------------------------------------- 미로

function maze(seed) {
  const cols = 20 + (seed % 6) * 4;
  const rows = 9 + ((seed >>> 4) % 5) * 3;
  const mazeSeed = seed % 100000;
  const slug = `maze-${cols}x${rows}-${(seed % 9973).toString(36)}`;

  return {
    slug,
    lang: 'javascript',
    title: `${cols}×${rows} 미로 — 만들고, 푼다`,
    pitch: `Seeded maze generation (randomized DFS) with a BFS shortest-path solve, in ASCII. Zero dependencies.`,
    topics: ['maze-generation', 'pathfinding', 'bfs', 'ascii-art', 'algorithms'],
    why_interesting: `생성은 randomized DFS 라 굽이가 길고 갈림길이 적은, 손으로 그린 것 같은 미로가 나온다. 풀이는 BFS 라서 찾은 경로가 곧 최단 경로다 — 증명이 알고리즘 안에 들어 있다. 시드 하나로 전체가 결정되므로 같은 시드는 언제나 같은 미로다.`,
    run_command: `node index.js ${mazeSeed} ${cols} ${rows}`,
    files: [{ path: 'index.js', content: mazeSource(mazeSeed, cols, rows) }],
    _fallback: true,
    _note: `${cols}×${rows} · 시드 ${mazeSeed}`,
  };
}

// ---------------------------------------------------------------- 울람 나선

function ulamSpiral(seed) {
  const size = 101 + (seed % 5) * 50;
  const slug = `ulam-spiral-${size}-${(seed % 9973).toString(36)}`;

  return {
    slug,
    lang: 'html',
    title: `울람 나선 ${size}×${size} — 소수는 흩어지지 않는다`,
    pitch: `Interactive Ulam spiral: integers in a square spiral, primes marked. Zero dependencies.`,
    topics: ['ulam-spiral', 'prime-numbers', 'canvas', 'visualization', 'number-theory'],
    why_interesting: `1963년 울람이 지루한 강연 중에 정수를 나선으로 적다가 발견했다. 소수를 칠하면 무작위로 흩어지는 대신 대각선 위에 줄을 선다. 그 대각선들이 n²+n+41 같은 2차식의 값이다. 아직 아무도 왜 그런지 완전히 설명하지 못했다.`,
    run_command: 'open index.html',
    files: [{ path: 'index.html', content: ulamSource(size) }],
    _fallback: true,
    _note: `${size}×${size} · ${size * size}까지의 정수`,
  };
}

// ---------------------------------------------------------------- 소스 템플릿

function antSource(rule, steps, width) {
  return `"""Generalized Langton's ant (turmite) on a wrapping grid.

개미 한 마리가 격자 위를 걷는다. 규칙은 L/R 문자열 하나뿐이다:
현재 칸의 색을 보고 그 자리의 문자대로 돌고, 칸 색을 하나 올리고, 한 칸 전진한다.
규칙이 "LR" 이면 만 보 즈음부터 개미가 스스로 고속도로를 놓기 시작한다.
"""

import sys

TURNS = {"L": -1, "R": 1}
# 북 동 남 서
DX = (0, 1, 0, -1)
DY = (-1, 0, 1, 0)
RAMP = " .:-=+*#%@"


def run(rule, width, height, steps):
    """개미를 steps 번 걷게 하고 최종 격자를 돌려준다."""
    colors = len(rule)
    grid = [[0] * width for _ in range(height)]
    x, y, facing = width // 2, height // 2, 0

    for _ in range(steps):
        color = grid[y][x]
        facing = (facing + TURNS[rule[color]]) % 4
        grid[y][x] = (color + 1) % colors
        x = (x + DX[facing]) % width
        y = (y + DY[facing]) % height

    return grid, x, y


def render(grid, ax, ay, colors):
    lines = []
    for y, row in enumerate(grid):
        out = []
        for x, c in enumerate(row):
            if x == ax and y == ay:
                out.append("@")
            elif c == 0:
                out.append(" ")
            else:
                out.append(RAMP[1 + (c * (len(RAMP) - 2)) // max(1, colors - 1)])
        lines.append("".join(out))
    return "\\n".join(lines)


def main():
    args = sys.argv[1:]
    rule = args[0].upper() if len(args) > 0 else ${JSON.stringify(rule)}
    try:
        steps = int(args[1]) if len(args) > 1 else ${steps}
        width = int(args[2]) if len(args) > 2 else ${width}
    except ValueError:
        print("usage: main.py [rule] [steps] [width]   e.g. main.py LR 12000 101", file=sys.stderr)
        return 1

    if not rule or any(ch not in TURNS for ch in rule):
        print("rule must be made of L and R only. Got: %s" % rule, file=sys.stderr)
        return 1
    if not 1 <= steps <= 5_000_000:
        print("steps must be from 1 to 5000000.", file=sys.stderr)
        return 1
    if not 11 <= width <= 400:
        print("width must be from 11 to 400.", file=sys.stderr)
        return 1

    height = max(11, width // 2)
    grid, ax, ay = run(rule, width, height, steps)

    painted = sum(1 for row in grid for c in row if c)
    print("rule %s  %d colors  %d steps  grid %dx%d" % (rule, len(rule), steps, width, height))
    print("-" * width)
    print(render(grid, ax, ay, len(rule)))
    print("-" * width)
    print("painted %d of %d cells (%.1f%%)" % (painted, width * height, 100.0 * painted / (width * height)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
`;
}

function mazeSource(seed, cols, rows) {
  return `// 미로를 만들고, 만든 김에 푼다.
//
// 생성은 randomized DFS(재귀 백트래킹) — 굽이가 길고 갈림길이 적은,
// 사람이 손으로 그린 것 같은 미로가 나온다.
// 풀이는 BFS — 너비 우선이라 찾은 경로가 곧 최단 경로다.
// 시드 하나로 전체가 결정되므로 같은 시드는 언제나 같은 미로다.

const WALL = '█';
const OPEN = ' ';
const PATH = '·';

/** mulberry32 — 짧고 충분히 고른 시드 PRNG. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 셀 격자를 벽 격자로 펼쳐서 판다.
 * 셀 (cx,cy) 는 벽 격자의 (2cx+1, 2cy+1) 에 대응하고,
 * 두 셀 사이의 벽은 그 중간 칸이다.
 */
function carve(cols, rows, rand) {
  const w = cols * 2 + 1;
  const h = rows * 2 + 1;
  const grid = Array.from({ length: h }, () => new Array(w).fill(WALL));

  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const stack = [[0, 0]];
  seen[0][0] = true;
  grid[1][1] = OPEN;

  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = [];
    if (cy > 0 && !seen[cy - 1][cx]) options.push([cx, cy - 1, 0, -1]);
    if (cx < cols - 1 && !seen[cy][cx + 1]) options.push([cx + 1, cy, 1, 0]);
    if (cy < rows - 1 && !seen[cy + 1][cx]) options.push([cx, cy + 1, 0, 1]);
    if (cx > 0 && !seen[cy][cx - 1]) options.push([cx - 1, cy, -1, 0]);

    if (!options.length) {
      stack.pop(); // 막다른 길 — 되돌아간다
      continue;
    }
    const [nx, ny, dx, dy] = options[Math.floor(rand() * options.length)];
    grid[cy * 2 + 1 + dy][cx * 2 + 1 + dx] = OPEN; // 사이 벽을 튼다
    grid[ny * 2 + 1][nx * 2 + 1] = OPEN;
    seen[ny][nx] = true;
    stack.push([nx, ny]);
  }
  return grid;
}

/** BFS. 찾은 경로가 곧 최단 경로다. */
function solve(grid, start, goal) {
  const h = grid.length;
  const w = grid[0].length;
  const key = (x, y) => y * w + x;
  const prev = new Map();
  const queue = [start];
  const seen = new Set([key(...start)]);

  for (let head = 0; head < queue.length; head++) {
    const [x, y] = queue[head];
    if (x === goal[0] && y === goal[1]) {
      const path = [];
      let cur = key(x, y);
      while (cur !== undefined) {
        path.push([cur % w, Math.floor(cur / w)]);
        cur = prev.get(cur);
      }
      return path.reverse();
    }
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (grid[ny][nx] === WALL) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, key(x, y));
      queue.push([nx, ny]);
    }
  }
  return null;
}

function main() {
  const seed = Number(process.argv[2] ?? ${seed});
  const cols = Number(process.argv[3] ?? ${cols});
  const rows = Number(process.argv[4] ?? ${rows});
  const show = (process.argv[5] ?? 'solved').toLowerCase();

  if (!Number.isInteger(seed)) {
    console.error('seed must be an integer.');
    process.exit(1);
  }
  if (!Number.isInteger(cols) || cols < 3 || cols > 120 || !Number.isInteger(rows) || rows < 3 || rows > 120) {
    console.error('cols and rows must be integers from 3 to 120.');
    process.exit(1);
  }
  if (show !== 'solved' && show !== 'blank') {
    console.error("last argument must be 'solved' or 'blank'.");
    process.exit(1);
  }

  const grid = carve(cols, rows, rng(seed));
  const start = [1, 1];
  const goal = [cols * 2 - 1, rows * 2 - 1];
  const path = solve(grid, start, goal);

  if (show === 'solved' && path) {
    for (const [x, y] of path) grid[y][x] = PATH;
    grid[start[1]][start[0]] = 'S';
    grid[goal[1]][goal[0]] = 'E';
  }

  console.log('maze ' + cols + 'x' + rows + '  seed ' + seed + '  ' + (show === 'solved' ? 'solved' : 'unsolved'));
  console.log(grid.map((row) => row.join('')).join('\\n'));
  console.log('shortest path: ' + (path ? path.length + ' cells' : 'none'));
}

main();
`;
}

function ulamSource(size) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ulam Spiral</title>
<style>
  :root { color-scheme: dark; --ink:#e9e6df; --bg:#101014; --dim:#7c7768; --accent:#66d9a0; }
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;background:var(--bg);color:var(--ink);
       font:14px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;
       display:flex;flex-direction:column;align-items:center;padding:24px 16px;gap:14px}
  h1{margin:0;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
  p{margin:0;max-width:660px;color:var(--dim);font-size:12.5px;text-align:center}
  canvas{image-rendering:pixelated;width:100%;max-width:620px;border:1px solid #2a2a31;background:#08080b;cursor:crosshair}
  .controls{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:center;max-width:620px;width:100%}
  label{display:flex;align-items:center;gap:8px}
  input[type=range]{accent-color:var(--accent)}
  output{min-width:4ch;color:var(--accent)}
  #readout{min-height:1.6em;color:var(--accent);font-size:12.5px}
</style>
</head>
<body>
  <h1>Ulam Spiral</h1>
  <p>Write the integers in a square spiral and mark the primes. They refuse to scatter &mdash;
     they pile onto diagonals, which are the values of quadratics like n&sup2; + n + 41.</p>
  <div class="controls">
    <label>size <input id="size" type="range" min="51" max="501" step="10" value="${size}"><output id="sizeOut">${size}</output></label>
    <label><input id="twin" type="checkbox"> twin primes only</label>
  </div>
  <canvas id="c"></canvas>
  <div id="readout">hover the grid</div>
<script>
  var canvas = document.getElementById('c');
  var ctx = canvas.getContext('2d');
  var sizeEl = document.getElementById('size');
  var sizeOut = document.getElementById('sizeOut');
  var twinEl = document.getElementById('twin');
  var readout = document.getElementById('readout');
  var state = { n: 0, sieve: null, coords: null };

  // 에라토스테네스의 체. n 까지 한 번에 걸러 둔다.
  function sieveUpTo(n) {
    var flags = new Uint8Array(n + 1);
    flags[0] = flags[1] = 1;
    for (var i = 2; i * i <= n; i++) {
      if (flags[i]) continue;
      for (var j = i * i; j <= n; j += i) flags[j] = 1;
    }
    return flags;
  }

  // 1 을 가운데 두고 바깥으로 감는 정사각 나선. 각 정수의 (x,y) 를 미리 계산한다.
  function spiral(size) {
    var total = size * size;
    var xs = new Int16Array(total + 1);
    var ys = new Int16Array(total + 1);
    var x = Math.floor(size / 2), y = Math.floor(size / 2);
    var dx = 1, dy = 0, run = 1, n = 1;
    xs[1] = x; ys[1] = y;
    while (n < total) {
      for (var twice = 0; twice < 2 && n < total; twice++) {
        for (var s = 0; s < run && n < total; s++) {
          x += dx; y += dy; n++;
          xs[n] = x; ys[n] = y;
        }
        var t = dx; dx = dy; dy = -t; // 왼쪽으로 90도
      }
      run++;
    }
    return { xs: xs, ys: ys };
  }

  function draw() {
    var size = Number(sizeEl.value);
    if (size % 2 === 0) size++;
    sizeOut.textContent = size;
    var total = size * size;

    var sieve = sieveUpTo(total);
    var co = spiral(size);
    state = { n: size, sieve: sieve, coords: co };

    canvas.width = size;
    canvas.height = size;
    var img = ctx.createImageData(size, size);
    for (var i = 0; i < img.data.length; i += 4) {
      img.data[i] = 8; img.data[i + 1] = 8; img.data[i + 2] = 11; img.data[i + 3] = 255;
    }

    var twinOnly = twinEl.checked;
    var marked = 0;
    for (var v = 2; v <= total; v++) {
      if (sieve[v]) continue;
      if (twinOnly) {
        var hasTwin = (v >= 2 && v - 2 >= 0 && !sieve[v - 2]) || (v + 2 <= total && !sieve[v + 2]);
        if (!hasTwin) continue;
      }
      var p = (co.ys[v] * size + co.xs[v]) * 4;
      img.data[p] = 102; img.data[p + 1] = 217; img.data[p + 2] = 160;
      marked++;
    }
    ctx.putImageData(img, 0, 0);
    readout.textContent = marked + ' marked of ' + total + ' integers';
  }

  canvas.addEventListener('mousemove', function (e) {
    if (!state.coords) return;
    var r = canvas.getBoundingClientRect();
    var gx = Math.floor((e.clientX - r.left) / r.width * state.n);
    var gy = Math.floor((e.clientY - r.top) / r.height * state.n);
    for (var v = 1; v <= state.n * state.n; v++) {
      if (state.coords.xs[v] === gx && state.coords.ys[v] === gy) {
        readout.textContent = v + (state.sieve[v] ? ' — composite' : ' — prime');
        return;
      }
    }
  });

  sizeEl.addEventListener('input', draw);
  twinEl.addEventListener('change', draw);
  draw();
</script>
</body>
</html>
`;
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
