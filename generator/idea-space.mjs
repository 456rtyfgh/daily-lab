// 조합 폭발로 중복을 막는다.
// domain × artifact × constraint = 20 * 12 * 16 = 3840 조합 (10년치)
// 매일 날짜 기반 결정론적 셔플 + history 중복 차단.

export const DOMAINS = [
  '시간과 달력', '텍스트와 언어', '색과 빛', '소리와 리듬', '지도와 좌표',
  '숫자와 수열', '암호와 인코딩', '그래프와 네트워크', '확률과 무작위', '정렬과 탐색',
  '파일과 포맷', '터미널과 셸', '이미지 픽셀', '물리 시뮬레이션', '게임 규칙',
  '금융과 단위 환산', '천문과 우주', '생물과 성장 패턴', '음식과 레시피', '기억과 학습',
];

export const ARTIFACTS = [
  { kind: 'cli', hint: '인자를 받는 명령줄 도구' },
  { kind: 'web-toy', hint: 'index.html 하나로 도는 인터랙티브 웹 장난감' },
  { kind: 'visualizer', hint: 'canvas/SVG로 그리는 시각화' },
  { kind: 'algorithm', hint: '알고리즘 구현 + 테스트' },
  { kind: 'parser', hint: '작은 문법을 읽는 파서/인터프리터' },
  { kind: 'generator', hint: '무언가를 절차적으로 생성하는 도구' },
  { kind: 'simulation', hint: '규칙을 돌려 상태가 진화하는 시뮬레이션' },
  { kind: 'game', hint: '조작 가능한 미니 게임' },
  { kind: 'library', hint: '한 가지 일만 잘 하는 작은 라이브러리' },
  { kind: 'data-art', hint: '데이터를 그림으로 바꾸는 실험' },
  { kind: 'benchmark', hint: '두 방법을 재고 비교하는 측정 도구' },
  { kind: 'puzzle-solver', hint: '퍼즐을 푸는 솔버' },
];

export const CONSTRAINTS = [
  '외부 의존성 0개',
  '핵심 로직 100줄 이하',
  '출력이 전부 ASCII 아트',
  '순수 함수만 사용',
  '재귀 없이 구현',
  '단일 파일',
  '메모리 O(1)',
  '입력 없이 결정론적으로 동작',
  '실시간 60fps 목표',
  '모든 값이 정수',
  '설정 가능한 시드 하나로 전체 결과가 결정됨',
  '에러 메시지가 사람 말로 친절하게',
  '테스트가 구현보다 길어야 함',
  '한 줄씩 스트리밍 출력',
  '이모지 없이 흑백만',
  '되돌리기(undo) 지원',
];

export const LANGS = ['javascript', 'python', 'html'];

// 날짜를 시드로 쓰는 작은 PRNG (mulberry32)
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromDate(dateStr) {
  let h = 2166136261;
  for (const ch of dateStr) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 그날의 조합을 뽑는다. history에 있는 조합은 최대 40회까지 피해서 재추첨. */
export function pickCombo(dateStr, history = []) {
  const used = new Set(history.map((h) => h.combo).filter(Boolean));
  let seed = seedFromDate(dateStr);
  for (let attempt = 0; attempt < 40; attempt++) {
    const r = rng(seed + attempt * 7919);
    const domain = DOMAINS[Math.floor(r() * DOMAINS.length)];
    const artifact = ARTIFACTS[Math.floor(r() * ARTIFACTS.length)];
    const constraint = CONSTRAINTS[Math.floor(r() * CONSTRAINTS.length)];
    const combo = `${domain}|${artifact.kind}|${constraint}`;
    if (!used.has(combo)) {
      const lang =
        artifact.kind === 'web-toy' || artifact.kind === 'visualizer' || artifact.kind === 'game' || artifact.kind === 'data-art'
          ? 'html'
          : LANGS[Math.floor(r() * 2)];
      return { domain, artifact, constraint, combo, lang };
    }
  }
  // 전부 소진되면 그냥 마지막 것을 쓴다 (현실적으로 3840일 뒤)
  const r = rng(seed);
  const domain = DOMAINS[Math.floor(r() * DOMAINS.length)];
  const artifact = ARTIFACTS[Math.floor(r() * ARTIFACTS.length)];
  const constraint = CONSTRAINTS[Math.floor(r() * CONSTRAINTS.length)];
  return { domain, artifact, constraint, combo: `${domain}|${artifact.kind}|${constraint}`, lang: 'javascript' };
}
