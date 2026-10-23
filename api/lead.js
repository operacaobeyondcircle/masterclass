// Função serverless da Vercel: recebe o lead do formulário e repassa ao webhook.
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   WEBHOOK_URL      (obrigatória)  URL HTTPS do webhook (n8n, Make, Zapier, CRM...)
//   WEBHOOK_SECRET   (opcional)     enviada no header "x-webhook-secret" para o webhook validar a origem
//   ALLOWED_ORIGINS  (opcional)     domínios permitidos, separados por vírgula. Ex.: https://seusite.com.br,https://www.seusite.com.br

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Limite simples por IP (best effort: a memória é por instância serverless)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 5;
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  return list.length > max;
}

const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  // Verificação de origem (opcional)
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  if (allowed.length && origin && !allowed.includes(origin)) {
    return res.status(403).json({ ok: false, error: 'Origem não permitida' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ ok: false, error: 'Muitas tentativas. Tente novamente em instantes.' });
  }

  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('WEBHOOK_URL não configurada');
    return res.status(500).json({ ok: false, error: 'Servidor não configurado' });
  }

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};

  // Honeypot: finge sucesso para não dar pista a bots
  if (body.website) return res.status(200).json({ ok: true });

  const nome = clean(body.nome, 120);
  const email = clean(body.email, 160).toLowerCase();
  const whatsapp = clean(body.whatsapp, 20);
  const digits = whatsapp.replace(/\D/g, '');

  if (nome.length < 3) return res.status(400).json({ ok: false, error: 'Nome inválido' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ ok: false, error: 'E-mail inválido' });
  if (digits.length < 12 || digits.length > 13) return res.status(400).json({ ok: false, error: 'WhatsApp inválido' });
  if (body.consentimento !== true) return res.status(400).json({ ok: false, error: 'Consentimento obrigatório' });

  const tracking = {};
  if (body.tracking && typeof body.tracking === 'object') {
    for (const [k, v] of Object.entries(body.tracking).slice(0, 10)) tracking[clean(k, 40)] = clean(v, 200);
  }

  const lead = {
    nome,
    email,
    whatsapp: '+' + digits,
    consentimento: true,
    origem: clean(body.origem, 100),
    evento: clean(body.evento, 120),
    pagina: clean(body.pagina, 500),
    referrer: clean(body.referrer, 500),
    tracking,
    registradoEm: new Date().toISOString(),
    ip,
    userAgent: clean(req.headers['user-agent'], 300),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.WEBHOOK_SECRET) headers['x-webhook-secret'] = process.env.WEBHOOK_SECRET;

    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(lead),
      signal: controller.signal,
    });

    if (!upstream.ok) {
      console.error('Webhook respondeu', upstream.status);
      return res.status(502).json({ ok: false, error: 'Falha ao registrar inscrição' });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Erro ao chamar webhook:', err.name === 'AbortError' ? 'timeout' : err.message);
    return res.status(502).json({ ok: false, error: 'Falha ao registrar inscrição' });
  } finally {
    clearTimeout(timer);
  }
};

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
