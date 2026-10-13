// Opal AI - Cloudflare Worker GRATIS (Workers AI, tanpa API key)
// Melayani halaman web (folder public) + endpoint /chat.

// Ganti nama model di sini kalau mau. Daftar: developers.cloudflare.com/workers-ai/models/
const MODELS = {
  quick: '@cf/meta/llama-3.1-8b-instruct',
  default: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  complex: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
};
const MAX_CHARS = 30000;
const MAX_TOKENS = 1500;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/chat') return env.ASSETS.fetch(req);
    if (req.method !== 'POST') return json({ error: 'method' }, 405);

    let body;
    try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

    const raw = Array.isArray(body.messages) ? body.messages : [];
    const messages = [];
    let total = 0;
    for (const m of raw) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) continue;
      total += m.content.length;
      const last = messages[messages.length - 1];
      if (last && last.role === m.role) last.content += '\n\n' + m.content;
      else messages.push({ role: m.role, content: m.content });
    }
    if (!messages.length || messages[messages.length - 1].role !== 'user') return json({ error: 'bad_messages' }, 400);
    if (total > MAX_CHARS) return json({ error: 'prompt_too_large' }, 413);

    const model = MODELS[body.tier] || MODELS.default;
    try {
      const out = await env.AI.run(model, { messages, max_tokens: MAX_TOKENS });
      const text = (out && (out.response || out.choices?.[0]?.message?.content)) || '';
      return json({ text: String(text), truncated: false });
    } catch (e) {
      // Biasanya karena jatah gratis harian habis (reset 00:00 UTC / 07:00 WIB)
      return json({ error: 'ai_error' }, 429);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json' } });
}
