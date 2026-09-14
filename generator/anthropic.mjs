const API = 'https://api.anthropic.com/v1';
const VERSION = '2023-06-01';

/** 사용 가능한 모델을 직접 조회해서 고른다. 모델 ID 하드코딩은 반드시 언젠가 썩는다. */
export async function pickModel(apiKey, prefer = process.env.MODEL) {
  if (prefer) return prefer;
  const res = await fetch(`${API}/models?limit=100`, {
    headers: { 'x-api-key': apiKey, 'anthropic-version': VERSION },
  });
  if (!res.ok) throw new Error(`models 조회 실패 ${res.status}: ${await res.text()}`);
  const { data } = await res.json();
  const ids = data.map((m) => m.id);
  // sonnet 계열을 우선(속도/비용), 없으면 opus, 없으면 아무거나. 같은 계열 안에선 최신순.
  const rank = (id) => (/sonnet/.test(id) ? 0 : /opus/.test(id) ? 1 : /haiku/.test(id) ? 2 : 3);
  ids.sort((a, b) => rank(a) - rank(b) || (a < b ? 1 : -1));
  if (!ids.length) throw new Error('사용 가능한 모델이 없다');
  return ids[0];
}

export async function complete(apiKey, { model, system, user, maxTokens = 16000, tools, toolChoice }) {
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${API}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`일시 오류 ${res.status}: ${await res.text()}`);
      if (!res.ok) throw Object.assign(new Error(`API ${res.status}: ${await res.text()}`), { fatal: true });
      return await res.json();
    } catch (err) {
      if (err.fatal) throw err;
      lastErr = err;
      const wait = 2 ** attempt * 3000;
      console.warn(`  재시도 ${attempt + 1}/4 (${Math.round(wait / 1000)}s 후): ${err.message.slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}
