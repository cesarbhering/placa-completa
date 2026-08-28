# FIPE: melhor candidato no relatório pago

## O problema (real, 4 testers + caso OXK7426)
O relatório pago herda o valor FIPE do "melhor score" da wdapi. No OXK7426 (Etios **HB X 1.3**, hatch), a wdapi devolveu **3 candidatos, todos Sedan 1.5** — o modelo correto nem estava na lista. Resultado: versão e preço errados num produto pago.

## Os sinais que já temos (por relatório pago)
| Fonte | Campo | Exemplo OXK7426 | O que discrimina |
|---|---|---|---|
| SENATRAN | descricaoMarcaModelo | `TOYOTA/ETIOS HB X` | Carroceria (HB/Sedan) + versão (X/XS/XLS...) |
| SENATRAN | cilindrada | `1329` | **1.3 vs 1.5 de forma determinística** |
| SENATRAN | potencia | `90` | Confirma motorização |
| wdapi | MODELO/SUBMODELO/VERSAO + anoModelo + combustível | `ETIOS...` | Redundância/tiebreak |
| wdapi | fipe.dados[] (com score) | 3 candidatos (incompletos!) | Ponto de partida, nunca teto |
| fipe-api (nossa) | universo de modelos da marca/ano | (endpoint novo) | **Lista completa de candidatos** |
| vin-decoder | VDS do chassi | `K19...` | Futuro: padrões por montadora |

## Arquitetura proposta (híbrida, só no fluxo pago)
1. **Universo**: buscar na NOSSA fipe-api todos os modelos da marca com preço no anoModelo (endpoint novo: `GET /modelos?marca=&ano=` devolvendo codigo_fipe + nome + valor). União com os candidatos da wdapi.
2. **Funil determinístico** (barato, auditável): filtra por cilindrada→motor (1.3/1.5...), carroceria (HB/Sedan, 4p/5p), combustível, ano. Se sobrar 1 → decidido SEM LLM.
3. **Haiku como juiz** (só quando sobra >1): prompt com os fatos (strings SENATRAN+wdapi, cilindrada, potência) + candidatos filtrados → devolve `{codigo_fipe, confianca, justificativa}`. Custo ~R$0,01-0,02/relatório (irrelevante vs R$5 do SERPRO).
4. **Ambiguidade honesta**: confiança baixa → o relatório mostra os 2-3 finalistas com faixa de valor ("Versões possíveis desta configuração") em vez de afirmar errado. Num produto pago, transparência > chute confiante.
5. **Snapshot**: grava a escolha + candidatos considerados + confiança (auditoria). Relatórios já congelados não mudam; os 4 casos dos testers podem ser re-emitidos manualmente após a feature.

## O que precisa ser criado
- [ ] Endpoint na fipe-api: listar modelos por marca/ano (Cesar pede ao fornecedor/repo da fipe-api)
- [ ] `server/utils/fipe-candidato.ts`: funil determinístico + juiz Haiku (Claude API; env nova `NUXT_ANTHROPIC_API_KEY`, secret via Coolify, nunca versionada)
- [ ] Integração na montagem do snapshot (relatorio-snapshot.ts) + exibição de "versões possíveis" quando ambíguo
- [ ] Métrica: log de {decidido_por: regra|haiku|ambiguo} pra acompanhar taxa de acerto

## Fora de escopo (agora)
Fluxo grátis fica como está (score da wdapi). VDS/vin-decoder como sinal entra depois, com base acumulada.
