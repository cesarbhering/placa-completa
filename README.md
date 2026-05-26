# PlacaCompleta

## Rodando localmente

```bash
npm install
npm run dev
```

Para dev sem analytics:
```bash
npm run dev:no-analytics
```

### Testes

```bash
npm run test           # unitários
npm run test:e2e       # e2e (Playwright)
npm run test:all       # unitários + e2e
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto no Supabase |
| `SUPABASE_SERVICE_KEY` | Chave de serviço (secreta) |
| `SUPABASE_ANON_KEY` | Chave pública |
| `RESEND_API_KEY` | API key do Resend (envio de emails) |
| `PLACA_API_TOKEN` | Token da API de consulta de placa |
| `API_KEY_OPENAI` | API key da OpenAI |
| `DISABLE_ANALYTICS` | `true` para desabilitar GA em dev |

Para testes e2e, copie `.env.test.example` para `.env.test`.

---

## Roadmap

### Em andamento

- [ ] **ICV5** — Melhorar dados, cálculos e visual/fluxo
- [ ] **Gráfico FIPE** — Melhorar dados e visual/fluxo

### Features / Melhorias

- [ ] SEO para o ICV5
- [ ] Comprar domínios mortos para backlinks
- [ ] Backlinks em posts de blogs / guest posts
- [ ] Melhorar design da página (com designer — orçamento Igor Gordo + 2)
- [ ] Segurança — Profunda revisão de segurança

---

## Metas

| Meta | Prazo | Status |
|---|---|---|
| 1.000 consultas | fim de março/2026 | - |
| 5.000 consultas | fim de abril/2026 | - |
| Licença SENATRAN em mãos | fim de maio/2026 | - |

<!-- hosted on Coolify VPS, auto-deploy via webhook -->
