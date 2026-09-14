// 오늘의 카드만 뽑아서 출력한다. API 호출 없음, 토큰 0.
// Cowork 스케줄 세션이 이걸 먼저 돌려서 "뭘 만들지"를 받아간다.
import { pickCombo } from './idea-space.mjs';
import { readHistory, today } from './generate.mjs';

const date = process.argv[2] || today();
const history = readHistory();

if (history.some((h) => h.date === date)) {
  console.log(JSON.stringify({ date, already_done: true, existing: history.find((h) => h.date === date) }, null, 2));
  process.exit(0);
}

const combo = pickCombo(date, history);
console.log(
  JSON.stringify(
    {
      date,
      already_done: false,
      day_number: history.length + 1,
      cards: {
        소재: combo.domain,
        형태: `${combo.artifact.kind} — ${combo.artifact.hint}`,
        제약: combo.constraint,
        언어: combo.lang,
      },
      combo: combo.combo,
      lang: combo.lang,
      kind: combo.artifact.kind,
      최근_25개: history.slice(-25).map((h) => `${h.slug}: ${h.title}`),
    },
    null,
    2,
  ),
);
