# Cupom grátis: como funciona e quanto custa

Cupom com `permite_gratis = true` e desconto de 100% libera o relatório sem
Pix nenhum: o checkout reivindica a vaga, cria o pedido com valor zero e
dispara a entrega na hora (ver `server/api/premium/checkout.post.ts`, caminho
`gratisReivindicado`).

## Ele não é de graça pra nós

Cada resgate da completa dispara a consulta paga de verdade, uns R$ 5 por
relatório. Um cupom de 20 usos é uma nota fiscal de cerca de R$ 100 esperando
pra acontecer, e ela chega toda de uma vez se alguém resgatar tudo num dia.

Levantamento de 27/ago a 03/set de 2026, para registro:

| Cupom | Limite global | Usos | Pessoas |
|---|---|---|---|
| HEMORROIDAS | 20 | 14 | 2 |
| CTCF | 20 | 11 | 5 |
| SANTACASA | 10 | 5 | 3 |

Foram 30 relatórios entregues a R$ 0,00 no período, para 8 e-mails, uns R$ 150
de custo. No mesmo período houve 19 vendas pagas. São beta testers e amigos do
Cesar, ou seja, gasto combinado e não vazamento, mas vale ter o número à vista:
o custo dos cortesias ficou na mesma ordem de grandeza da margem das vendas.

## O detalhe que faz um cupom render 13 relatórios pra uma pessoa só

Os três cupons acima têm `limite_uso_por_cliente = null`. O limite global de 20
não impede que 20 sejam da mesma pessoa, e foi o que aconteceu: um dos e-mails
levou 13 relatórios.

Se a intenção é "um relatório por convidado", o campo a preencher é
`limite_uso_por_cliente = 1`. O limite global sozinho controla o orçamento
total, nunca a distribuição.

## Ao criar um cupom grátis

1. `limite_uso_global` é o teto do gasto: multiplique por R$ 5 antes de
   escolher o número.
2. `limite_uso_por_cliente` quase sempre deve ser 1. Sem ele, uma pessoa pode
   consumir o cupom inteiro.
3. `valido_ate` evita cortesia esquecida virando custo meses depois.
4. `email_restrito` prende o código a uma pessoa (é o que a recuperação de Pix
   abandonado usa), e a validação é sem caixa.

O uso é registrado em `cupons_premium_usos`, que é a fonte da verdade da
contagem; `usos_atual` no cupom é só cache de leitura e pode ficar defasado sem
quebrar nenhuma regra.
