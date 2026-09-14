// 전부 선택 사항. 해당 환경변수가 없으면 조용히 건너뛴다.
// 커넥터 하나가 죽어도 파이프라인 전체를 죽이지 않는다.

async function safely(name, fn) {
  try {
    const r = await fn();
    if (r !== false) console.log(`  ${name} 전송됨`);
  } catch (err) {
    console.warn(`  ${name} 실패 (무시): ${err.message.slice(0, 160)}`);
  }
}

export async function notify(ctx) {
  const { spec, combo, date, url, count, source, problems = [] } = ctx;
  const flag = problems.length ? ' ⚠️ 검증 경고' : '';
  const line = `${date} · #${count} · ${spec.title}${flag}`;
  const cards = `${combo.domain} × ${combo.artifact.kind} × ${combo.constraint}`;

  await Promise.all([
    process.env.DISCORD_WEBHOOK &&
      safely('Discord', () =>
        fetch(process.env.DISCORD_WEBHOOK, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            embeds: [
              {
                title: spec.title,
                url,
                description: spec.pitch,
                color: problems.length ? 0xd98841 : 0x5865f2,
                fields: [
                  { name: '카드', value: cards },
                  { name: '실행', value: '`' + spec.run_command + '`' },
                ],
                footer: { text: `day ${count} · ${source}${problems.length ? ' · ' + problems.length + '개 경고' : ''}` },
                timestamp: new Date().toISOString(),
              },
            ],
          }),
        }).then((r) => r.ok || Promise.reject(new Error('HTTP ' + r.status))),
      ),

    process.env.SLACK_WEBHOOK &&
      safely('Slack', () =>
        fetch(process.env.SLACK_WEBHOOK, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            text: line,
            blocks: [
              { type: 'section', text: { type: 'mrkdwn', text: `*<${url}|${spec.title}>*\n${spec.pitch}` } },
              { type: 'context', elements: [{ type: 'mrkdwn', text: `${cards} · day ${count}` }] },
            ],
          }),
        }).then((r) => r.ok || Promise.reject(new Error('HTTP ' + r.status))),
      ),

    // Notion 데이터베이스에 한 줄씩 쌓기
    process.env.NOTION_TOKEN &&
      process.env.NOTION_DB_ID &&
      safely('Notion', async () => {
        const res = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            authorization: `Bearer ${process.env.NOTION_TOKEN}`,
            'notion-version': '2022-06-28',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            parent: { database_id: process.env.NOTION_DB_ID },
            properties: {
              Name: { title: [{ text: { content: spec.title } }] },
              Date: { date: { start: date } },
              URL: { url },
              Kind: { select: { name: combo.artifact.kind } },
              Language: { select: { name: combo.lang } },
            },
            children: [
              { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: spec.why_interesting } }] } },
              { object: 'block', type: 'code', code: { language: 'shell', rich_text: [{ text: { content: spec.run_command } }] } },
            ],
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      }),

    // 아무 데나 쏘고 싶을 때 (Zapier / n8n / IFTTT / 자체 서버)
    process.env.GENERIC_WEBHOOK &&
      safely('Webhook', () =>
        fetch(process.env.GENERIC_WEBHOOK, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ date, count, url, source, title: spec.title, pitch: spec.pitch, topics: spec.topics, combo: combo.combo, problems }),
        }).then((r) => r.ok || Promise.reject(new Error('HTTP ' + r.status))),
      ),
  ].filter(Boolean));
}
