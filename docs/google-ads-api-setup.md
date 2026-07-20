# Google Ads API — setup e checklist

Status vivo do processo de habilitar API do Google Ads pra automatizar campanha de R$300 do PlacaCompleta.

Última atualização: 17/jul/2026 02:00 CEST.

## Objetivo

Criar e gerenciar campanhas Search do PlacaCompleta via Python + `google-ads-python`, integrado com nossa stack (DataForSEO, VPS, systemd timers).

## Timeline atual

- **17/jul (hoje)** — App de Basic Access enviada. Google confirmou por email (assunto: "We've received your Google Ads API Basic Access Application").
- **Até 24/jul (5 dias úteis)** — janela oficial de review do Google (sem garantia, pode passar).
- **Se aprovado** — completar setup em ~30 min (vincular Haste ao MCC, rodar auth, criar campanha).
- **Se rejeitado** — analisar motivo, ajustar aplicação, reenviar.

## Credenciais coletadas

Guardadas em `/root/.google-ads-credentials.yaml` (chmod 600, root-only). Nada commitado no git.

| Campo | Status | Origem |
|---|---|---|
| `developer_token` | ✅ salvo (`GhjeUOmDRzsxLMm7aa4bWQ`) | MCC → Central de API |
| `client_id` | ✅ salvo | Google Cloud Console → OAuth Client (Desktop app) |
| `client_secret` | ✅ salvo | idem |
| `refresh_token` | ⏳ pendente | Gerado ao rodar `pc-ads-auth` |
| `login_customer_id` | ⏳ pendente (`4549147088` = PlacaCompleta MCC) | Canto superior direito do MCC |
| `customer_id` | ⏳ pendente (`8984323121` = Haste Technologies) | Conta cliente a ser vinculada |

Cloud Project: `gen-lang-client-0773094417` (auto-criado pelo Google, reaproveitado).

## Software instalado

- ✅ `google-ads` Python SDK v31.1.0 (`pip install --break-system-packages google-ads`)
- ✅ `pc-ads-auth` — helper CLI em `/usr/local/bin/pc-ads-auth` pra fluxo OAuth one-shot
- ✅ Skill `google-ads-manager` em `.agents/skills/google-ads-manager/` (playbook de estratégia)

## Configuração OAuth

- **Tipo de usuário:** Externo (Gmail pessoal, sem Workspace)
- **Status de publicação:** Testando (não Produção)
- **Test users:** cesarcbhering@gmail.com adicionado (pendente confirmação)
- **Escopos:** `https://www.googleapis.com/auth/adwords`
- **Sem verificação OAuth necessária** — Google confirmou que app de uso pessoal não é revisado

## Brand verification (do lado do Google Ads, não do Cloud)

- 1ª tentativa: rejeitada com falso positivo ("página inicial protegida por login" — não é verdade)
- Ação: pedir revisão manual ("Pedir outra análise") — 2-3 dias úteis
- Status atual: aguardando decisão

## Checklist quando Basic Access aprovar

Ordem sugerida:

- [ ] Vincular Haste Technologies (`898-432-3121`) ao MCC PlacaCompleta:
  - MCC → Contas → + → Vincular conta existente → digitar Haste ID → enviar convite
  - Trocar pra Haste → aceitar convite
- [ ] Confirmar Cesar como test user no OAuth consent screen
- [ ] Rodar `! pc-ads-auth` na VPS:
  - Abrir URL impressa no browser local
  - Autorizar com cesarcbhering@gmail.com
  - Aceitar aviso "app não verificado" (Avançado → Ir para o app)
  - Colar código no terminal
  - `refresh_token` entra automaticamente no yaml
- [ ] Cesar confere `~/.google-ads-credentials.yaml` completo
- [ ] Escrever `pc-ads-create-campaign.py` (dry-run primeiro)
- [ ] Rodar dry-run pra validar tudo
- [ ] Rodar campanha real com R$300

## Estrutura planejada da campanha

Rascunho — vamos refinar quando aprovar:

- **Tipo:** Search
- **Orçamento diário:** R$10 (30 dias × R$10 = R$300)
- **Geo:** Brasil
- **Idioma:** Português
- **Bidding:** Maximize Conversions (sem histórico ainda; migrar para Target CPA depois de 30+ conversões)
- **Keywords iniciais** (baseadas em DataForSEO com volume + LOW competition):
  - `tabela fipe pela placa` — 135k vol/mês, CPC ~$0.09
  - `fipe pela placa` — 90k vol/mês, CPC ~$0.07
  - `consultar tabela fipe pela placa` — 12k vol/mês, CPC ~$0.09
  - `valor fipe pela placa` — ~1k vol/mês
- **Match type:** Phrase match (equilíbrio entre precisão e volume)
- **Landing page:** `/tabela-fipe-por-placa` (o rebuild do PR #45)
- **RSA:** 3 títulos + 2 descrições, gerados via templates da skill

## Trade-offs conhecidos

- **Refresh token em modo Teste expira em 7 dias** (escopo sensível). Se virar recorrente, opções:
  1. Automatizar re-auth semanal (script + reminder)
  2. Publicar app (requer verificação OAuth, 2-6 semanas)
- **Login e customer IDs separados** — usamos MCC pra chamar API em nome da conta cliente
- **Basic Access limita a 15k operações/dia** — mais que suficiente pro nosso escopo

## Arquivos relacionados

- `~/.google-ads-credentials.yaml` — credenciais (não commitado)
- `/usr/local/bin/pc-ads-auth` — CLI OAuth helper
- `docs/google-ads-api-setup.md` — este arquivo
- `.agents/skills/google-ads-manager/SKILL.md` — playbook de estratégia

## Log de eventos

- **17/jul 00:00** — Skill `google-ads-manager` instalada.
- **17/jul 01:30** — Developer token gerado no MCC.
- **17/jul 01:40** — OAuth Client ID/Secret criado no Cloud Console.
- **17/jul 01:45** — Brand verification 1ª tentativa: falso positivo. Pedido revisão manual.
- **17/jul 01:55** — App enviada para Basic Access.
- **17/jul 02:00** — Este arquivo criado.

## Log de eventos (continuação)

- **20/jul** — Basic Access APROVADO pelo Google (email oficial da Compliance team).
- **20/jul** — OAuth completado: refresh_token gerado e salvo. Test user adicionado no consent screen. Google Ads API habilitada no projeto Cloud.
- **20/jul** — Conta cliente "PlacaCompleta" criada no MCC: ID 871-132-8209. Billing configurado.
- **20/jul** — GA4 vinculado ao Ads; evento `consulta_success` marcado como key event no GA4 e importado como conversao Principal (meta Inscricoes).
- **20/jul** — Revisao da estrategia (playbook google-ads-manager + DataForSEO fresh): removida keyword `pesquisar placa` (intent mismatch), trocada headline "Fonte FIPE Oficial" (claim arriscado), adicionados 15 negative keywords, 3 RSAs com pin strategy, mobile +20%, Search Partners OFF, end_date +30d.
- **20/jul** — **CAMPANHA CRIADA (PAUSED)**: `IBV FIPE Placa - Test #c3a77b`, ID 24050523074. Orcamento R$10/dia, termina 19/ago/2026. Aguardando ativacao manual na UI.

## Pos-launch checklist

- [ ] Cesar revisa a campanha na UI e clica Ativar
- [ ] Apos ativar: anuncios entram em analise de politica do Google (~1 dia util)
- [ ] Semana 1: revisar search terms report, adicionar negativos se aparecer lixo
- [ ] Confirmar `Formulário` e `Meta sugerida` rebaixadas pra acao secundaria (cosmetico, nao urgente)
- [ ] Dia 30 (19/ago): campanha para sozinha via end_date. Avaliar: custo por consulta < R$2 = escalar; R$2-5 = iterar; > R$5 = matar
- [ ] Fast-follow de produto: embutir formulario de consulta direto em /tabela-fipe-por-placa (reduz atrito do clique pago)
