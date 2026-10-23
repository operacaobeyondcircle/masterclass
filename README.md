# Beyond Masterclass — Página de captura

Landing page da **Masterclass Arquitetura do Sucesso™** com envio de leads para um webhook (n8n, Make, Zapier, CRM etc.) através de uma função serverless na Vercel.

## Estrutura

```
public/index.html   → a página (estática)
api/lead.js         → recebe o formulário, valida e repassa ao webhook
vercel.json         → headers de segurança
.env.example        → variáveis de ambiente
```

## Como funciona

1. O formulário faz `POST /api/lead` com o JSON do lead.
2. `api/lead.js` valida, bloqueia bots (honeypot + limite por IP) e envia ao `WEBHOOK_URL`.
3. A URL do webhook fica só no servidor, nunca no navegador.

### Payload recebido no webhook (JSON)

```json
{
  "nome": "Maria Silva",
  "email": "maria@email.com",
  "whatsapp": "+5585999999999",
  "consentimento": true,
  "origem": "landing-masterclass-arquitetura-do-sucesso",
  "evento": "Masterclass Arquitetura do Sucesso",
  "pagina": "https://seusite.com.br/?utm_source=instagram",
  "referrer": "",
  "tracking": { "utm_source": "instagram" },
  "registradoEm": "2026-10-23T12:00:00.000Z",
  "ip": "200.0.0.1",
  "userAgent": "Mozilla/5.0 ..."
}
```

Se `WEBHOOK_SECRET` estiver definida, a requisição leva o header `x-webhook-secret` para o webhook conferir.

## Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `WEBHOOK_URL` | Sim | URL HTTPS do webhook que recebe os leads |
| `WEBHOOK_SECRET` | Não | Segredo enviado no header `x-webhook-secret` |
| `ALLOWED_ORIGINS` | Não | Domínios autorizados, separados por vírgula |

## Deploy na Vercel

1. Suba este repositório no GitHub.
2. Na Vercel: **Add New → Project** → importe o repositório.
3. Em *Framework Preset* deixe **Other**. Em *Output Directory* informe `public`.
4. Em **Environment Variables**, cadastre `WEBHOOK_URL` (e, se quiser, `WEBHOOK_SECRET` e `ALLOWED_ORIGINS`).
5. **Deploy**. Depois, adicione o domínio em *Settings → Domains*.

> Alterou uma variável de ambiente? Faça um **Redeploy** para ela valer.

## Testar localmente

```bash
npm i -g vercel
cp .env.example .env.local   # preencha WEBHOOK_URL
vercel dev
```

Teste rápido do endpoint:

```bash
curl -X POST http://localhost:3000/api/lead \
  -H "Content-Type: application/json" \
  -d '{"nome":"Teste Silva","email":"teste@email.com","whatsapp":"+5585999999999","consentimento":true}'
```

> Dica: para testar sem CRM, crie um endpoint gratuito em webhook.site e use como `WEBHOOK_URL`.
