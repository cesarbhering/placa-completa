# Dossiê web e premium para a auditoria de 26/set/2026

Escrito em 20/set/2026 pelo teammate web. Cobre o site (Nuxt 3) e o fluxo
premium pago, de 27/ago a 20/set. Tudo que tem número aqui foi medido no banco
de produção ou no próprio navegador na data indicada, não é estimativa.

Documento INTERNO: ele nomeia fontes de dado e mostra placas de pedidos reais,
duas coisas que não aparecem em nenhuma tela de cliente. Não contém chave,
token nem senha.

## 1. O número que importa

Últimos 14 dias, produção:

| Etapa | Quantidade | Conversão |
|---|---|---|
| Consultas grátis | 4.403 | |
| Cobranças Pix criadas | 71 | 1,6% das consultas |
| Pagas | 40 | 56% dos Pix, 0,9% das consultas |

Comparando com o mesmo levantamento de 07/set (2.901 consultas, 66 Pix, 19
pagos): o volume de consultas subiu 52%, as vendas dobraram, e a conversão do
Pix melhorou de 53% para 56%. O gargalo continua sendo o mesmo e é enorme: de
cada mil pessoas que consultam de graça, 16 chegam a gerar cobrança e 9 pagam.

Por status, desde 27/ago: 88 entregues, 37 aguardando pagamento, 5 expirados, 2
reembolsados, 1 travado em "consultando". Receita bruta entregue no período: R$
2.079,90.

Um dado que merece decisão na auditoria, com a ressalva de que ele encolheu
sozinho: 35 relatórios saíram a R$ 0,00 desde 27/ago, para 9 pessoas. São
pedidos com valor zero em pedidos_premium, ou seja, cupom de 100%, e cada um
custa consulta paga de verdade. No acumulado do período isso é 35 de 88
entregues, mas o número acumulado engana, porque a distribuição por semana
mostra uma rajada no fim de agosto que foi murchando: 22 na semana de 24/ago, 8
na de 31/ago, 3 na de 07/set e 2 na de 14/set. Nos últimos 14 dias são 5
relatórios para 2 pessoas. A pergunta para a auditoria não é como estancar um
ralo aberto, e sim se a rajada inicial foi investimento consciente em beta
testers.

## 2. O que subiu para produção desde 27/ago

Sessenta PRs. Agrupados pelo que mudaram para quem usa:

### Preço e checkout
- Preço da Completa caiu de R$ 44,90 para R$ 39,90 (#227).
- Saiu a tela de reconferência da placa, um degrau a menos antes do Pix (#229).
- Garantia reescrita para prometer só o que o código cumpre (#225).
- `/premium?placa=XXX` abre o checkout já com a placa (#230).
- O e-mail deixou de ser porteira do Pix: a cobrança é gerada só com a placa e o
  e-mail é pedido na tela do pagamento (#279). Efeito medido: 24 dos 71 pedidos
  dos últimos 14 dias nasceram sem e-mail, e 11 deles foram pagos assim. Sem
  essa mudança, essas 11 vendas provavelmente não existiriam.
- Quem paga sem e-mail pode pedir a entrega na própria página do relatório
  (#305), e informar o e-mail depois dispara o envio na hora (#304).
- Modal do Pix reescrito: cabia em 1.200px de altura numa tela de 844, agora
  cabe em 733 sem rolagem; no desktop virou duas colunas, 447px (#293, #299,
  #302). Clique fora não fecha mais no desktop, porque quem volta do app do
  banco clica fora sem querer.
- A tela passou a avisar que o recebedor aparece como Haste Technologies no app
  do banco (#296). Isso saiu de conferência no BR Code real: nem o nosso nome
  nem o da Woovi aparecem para quem paga.

### Produto: histórico de leilão
- Seção de histórico de leilão no relatório completo (#252), com termômetro de
  gravidade, evidências do que bateu e fotos do lote quando existem.
- Indício "possível" recolhido atrás de um botão (#253) e lote de perfil comum
  deixou de virar indício (#262): um Gol comum trazia quatro "possíveis" da
  mesma leiloeira, quase certamente carros diferentes.
- Nome de leiloeira particular nunca aparece; o filtro fica no saneamento da
  resposta, não na tela (#255).
- Sinal de leilão na consulta grátis (#307), depois refinado duas vezes (#313 e
  #315): hoje só o positivo aparece, em vermelho. Sem registro, a tela não fala
  de leilão, porque dizer "nenhum registro encontrado" entregava de graça, em
  quase toda placa, a dúvida que vende o relatório.
- Botão para baixar o edital do DETRAN em PDF (#320), com link assinado de 24
  horas gerado a cada clique.

### Produto: relatório
- P0 corrigido: uma scooter PCX 150 aparecia como CB 1000R de R$ 58.380 (#265).
  Junto veio a regra de nunca exibir valor quando a versão FIPE é ambígua.
- Perfil de moto: checagens e copy próprias, "esta moto" em vez de "este
  veículo" (#266).
- Origem de fabricação pelo chassi, com cidade só onde a base de leilões
  confirma o código da planta (#273). Cobertura medida: 83% da base de leilões e
  68% dos relatórios pagos recentes ganham cidade.
- Campo vazio por serviço lento se preenche na próxima abertura do relatório
  (#271), sem reescrever o que a pessoa comprou.

### Tráfego e SEO
- Página guia /carro-de-leilao e 19 páginas de modelo (#283, #284).
- 27 páginas que o Google rastreava e não indexava foram enriquecidas (#291). O
  diagnóstico foi o que mudou o remédio: elas eram 83,1% idênticas entre si.
  Depois do enriquecimento, 75,8%.
- Atribuição de origem gravada no próprio pedido (#247) e captura do msclkid do
  Bing (#245).
- Pixel da Meta ligado por env (#281); a tag do Google Ads já estava no site.

### Infraestrutura e incidentes
- Retry em falha de rede no fluxo pago e alerta em todo estorno automático
  (#317).
- npm ci que aguenta o registry cair (#287) e que confere se a dependência
  opcional do compilador de SCSS veio (#318).
- Adaptador de Pix com Woovi ao lado da AbacatePay, atrás de env (#311) e página
  de teste no homolog (#312).

## 3. Estado do fluxo grátis

1. Pessoa digita a placa. Não há mais captura de e-mail nem de WhatsApp: o
   resultado aparece na própria tela.
2. A consulta grátis mostra marca, modelo, ano de fabricação e do modelo, cor,
   combustível, origem, parte do chassi e valor FIPE.
3. Logo abaixo vem o bloco pago, com 19 verificações em cadeado.
4. O sinal de leilão entra no topo desse bloco, e tem três estados:
   - **positivo** (registro confirmado ou provável): linha vermelha, "Encontramos
     N registros de leilão para este carro. Detalhes (data, leiloeira, condição
     do veículo) no relatório completo". O CTA muda para "Ver o registro de
     leilão no relatório completo" e o título do bloco pago para de perguntar se
     existe registro, porque a linha acima acabou de dizer que existe.
   - **negativo** (a base respondeu e não achou): nada aparece.
   - **indisponível** (timeout, serviço fora, teto de uso): nada aparece, e o
     evento não dispara. Essa distinção custou um bug: por um dia, falha nossa
     virava "nenhum registro encontrado" na tela.

## 4. Completa contra Básica

A Básica (R$ 25) entrega ficha técnica completa: chassi inteiro, FIPE com
histórico, seguro estimado e custo em cinco anos, situação cadastral, espécie,
tipo, categoria, potência, cilindrada, eixos, lotação, município e UF, recall e
Renavam.

A Completa (R$ 39,90) acrescenta o que decide a compra: restrições nacionais e
estaduais, indicador de roubo e furto, registro de leilão no documento,
histórico de leilão cruzado com a nossa base, origem de fabricação pelo chassi,
gravame e alienação, RENAJUD, indicador de multas e comunicação de venda.

Na prática a Básica quase não vende: 95% escolhe a Completa, e nos últimos 14
dias ela teve 3 pedidos e 1 pago. Ela não ancora preço, divide a decisão.

## 5. Incidentes e estornos

Dois estornos automáticos desde 27/ago, os dois com causa conhecida:

| Data | Placa | Valor | Causa |
|---|---|---|---|
| 11/set | GOH5751 | R$ 39,90 | SENATRAN respondeu HTTP 495 (erro de certificado do lado deles) |
| 14/set | UDS2J40 | R$ 39,90 | "fetch failed" no consentimento, oscilação de rede da VPS |

O de 14/set virou o #317: não havia erro de negócio nenhum, a chamada
simplesmente não saiu, e sem retry o cliente pagou e levou estorno. Hoje há
retry só para falha de transporte, em quatro camadas, e ainda uma última
tentativa 60 segundos depois, antes de estornar.

Esse mesmo pedido expôs um segundo bug: ele ficou com status "falha" apesar do
estorno ter acontecido, então a tela dizia "não foi possível concluir" sem dizer
que o dinheiro voltou. A causa não foi reproduzida. O que foi feito é o que dá
para garantir: a gravação do status agora é conferida e falha nela dispara
alerta.

Incidentes anteriores que ainda valem como contexto: o abuso do wdapi em 27/ago
(bot raspou a API por um furo do rate limit) e a enumeração de placas pelo app
em setembro, que gerou a regra de o app nunca ficar atrás do site em segurança.

## 6. Dívidas técnicas e riscos

**Rate limits.** Hoje existem quatro, em lugares diferentes e com naturezas
diferentes: 15 por IP por hora nas chamadas que gastam crédito do wdapi
(contado no banco); 60 por IP por hora no sinal de leilão; 10 por hora por
relatório no edital; e 5 por hora por destinatário no envio da consulta grátis.
Os três últimos são em memória do processo, então reiniciar zera a janela. Para
o que eles protegem (varredura, não fraude) isso é aceitável, mas precisa ser
decisão consciente, não descoberta.

**Caches em memória.** Sinal de leilão (24h por placa, teto de 5.000 entradas),
chaves públicas da Woovi (6h) e geolocalização de IP (1h). Todos morrem no
restart e nenhum é compartilhado entre containers. Se um dia houver mais de uma
instância, a taxa de acerto cai e a chamada externa dobra.

**Service worker.** Está em autoUpdate, sem navigateFallback, e não faz
precache da home, que é SSR. O risco conhecido é servir bundle velho depois de
deploy; o histórico manda detectar build pelo hash do /_nuxt/*.js, não pela
data.

**CSP.** Está em modo report-only para várias diretivas e há violações
recorrentes de connect-src do gtag e do Bing, que entopem o log sem indicar
problema real. Imagem de terceiro é bloqueada de verdade, e isso já moldou duas
decisões: o QR da Woovi e o QR do Pix são gerados no servidor a partir do copia
e cola, em vez de carregar imagem do adquirente.

**Performance, medida em 20/set contra produção:**

| Página | LCP | CLS | TTFB |
|---|---|---|---|
| Home, celular 390x844 | 1,5s a 2,6s (3 medidas) | 0,02 | 472ms a 1.123ms |
| Home, desktop 1366 | 1,8s | 0,003 | 329ms |
| /carro-de-leilao, celular | 1,9s | 0,04 | 1.293ms |

Peso: 288 KB transferidos na home, 173 KB de JavaScript, 41 requisições no
celular. LCP e CLS estão na faixa boa. O que oscila é o TTFB, e ele varia com a
carga da VPS, não com a página: uma medida chegou a 2,5s logo após um período de
load alto. Esse é o risco de performance real do site, e ele não se resolve no
código do front.

**Dívida de produto que não é técnica.** A Básica ocupa espaço na decisão e
quase não vende. E existe um modal de teste do Pix da Woovi que só abre no
homolog, que precisa continuar 404 em produção para sempre.

## 7. O que está instrumentado

Eventos que existem hoje, com os nomes exatos: `consulta_success` (com channel),
`consulta_success_pwa`, `consulta_success_no_delivery`, `form_start`,
`form_submit`, `form_validation_error`, `premium_checkout_open` (com origin,
plano, ja_consultada e leilao_sinal), `add_payment_info`, `begin_checkout`,
`pix_gerado` (com com_email), `purchase` mais a conversão do Google Ads e o
purchase do UET do Bing, `leilao_sinal_visto` (com positivo), `cta_click`,
`share_whatsapp`, `vehicle_data_shared`, `vehicle_data_downloaded`,
`restricao_sem_copy`, `seguro_modal_shown`, `cotacao_solicitada`,
`store_badge_click`, `pwa_email_saved`, `new_consulta_click`.

Duas regras que já custaram bug e valem para qualquer evento novo: a conversão
de compra é deduplicada por token em três camadas, porque houve um dia com 30
purchases para 17 begin_checkout; e o evento do sinal de leilão só dispara
quando a base respondeu, nunca quando a consulta falhou.

**Medição no nosso servidor, nova.** Até agora tudo acima vivia só no gtag, que
roda no navegador, é amostrado e some com bloqueador de anúncio. O web-funil
fechou uma segunda via: os eventos abaixo vão também para `POST /api/evento` e
viram linha na tabela `eventos_funil` do Supabase premium. Esse dado não é
amostrado e não depende do navegador cooperar. Atenção da auditoria: o código
já está na dev, mas a migration ainda não foi aplicada em produção nem no
staging, então até isso acontecer o endpoint responde normal e não grava nada.

Eventos novos, nomes exatos: `resultado_exibido` (a consulta grátis renderizou
com dados), `cta_completa_visto` (o bloco bloqueado entrou na tela de verdade,
30% visível, uma vez por sessão), `cta_completa_click` (com `origem_cta` =
bloco_bloqueado ou barra_fixa, e que não se confunde com o `cta_click` antigo,
que é outro botão), `checkout_confirm_visto`, `checkout_fechado_sem_pagar` (com
o passo em que parou, e que de propósito não dispara depois do Pix gerado,
porque aí o abandono já está no próprio pedido) e `email_informado` (com `onde`
= checkout ou tela_pix, guardando só a marca de que informou; o endereço nunca
sai do navegador). Mais três espelhados dos que já existiam, sem nomes novos:
`premium_checkout_open`, `pix_gerado` e `leilao_sinal_visto`.

Duas decisões que evitam ler número inflado: a view `funil_diario` conta sessão
distinta por etapa, não linha, então observer repetido ou reload não infla; e o
campo do sinal de leilão guarda três estados (positivo, negativo, sem_sinal),
nunca colapsando "não sabemos" em "não tem".

Privacidade dessa tabela: sem e-mail, sem telefone, sem IP cru e sem
User-Agent cru. Do aparelho fica só a categoria, celular ou computador, e do IP
só um hash com sal do servidor, usado apenas para não contar a mesma pessoa
duas vezes. Esse sal vem de `FUNIL_IP_SALT`, e enquanto ele não estiver
configurado no ambiente a coluna do hash grava nulo de propósito, o que só
desliga a dedupe por IP: as etapas e a visão diária continuam funcionando. A sessão é um id anônimo em sessionStorage, não é cookie e morre
quando a aba fecha.

**O que continua sem instrumentação**, mesmo depois dessa rodada: o clique em
copiar o código Pix e o clique no botão do edital do DETRAN. O fechamento do
modal, a rolagem até o bloco pago e o preenchimento do e-mail deixaram a lista
de lacunas agora (antes só sabíamos que 3 dos 24 pedidos sem e-mail ganharam um
depois).

## 8. Cinco sugestões de conversão, com o raciocínio

**1. Matar a Básica, ou tirá-la da página de resultado.**
Ela teve 3 pedidos e 1 pago em 14 dias contra 68 da Completa. Duas opções no
mesmo ponto de decisão dividem a escolha, e quem hesita entre dois preços tende
a não escolher nenhum. O ganho não é o faturamento dela, é a decisão mais
simples para os outros 95%. Esforço: duas horas. Risco: perder a âncora de
preço, que dá para recuperar com o valor cheio riscado.

**2. Levar o bloco pago para cima do dobra, no celular.**
Hoje a pessoa vê o resultado grátis, e o bloco que vende está abaixo. No celular
isso é uma rolagem inteira, e quem não rola nunca vê a oferta. A barra fixa
ajuda, mas ela compete com o conteúdo em vez de apresentá-lo. Sugiro testar o
bloco pago imediatamente após os três primeiros campos livres, com o resto da
ficha grátis abaixo dele. Esforço: baixo. É o teste com maior potencial e o mais
fácil de reverter.

**3. Mostrar o preço na primeira menção ao relatório, não só no botão.**
O CTA diz "Ver o que essa placa revela · R$ 39,90", mas o bloco inteiro acima
fala de 19 verificações sem dizer quanto custa. Quem tem medo de preço alto sai
antes de chegar ao botão. R$ 39,90 é um preço bom para o que entrega, e
esconder um preço bom é desperdício.

**4. Dizer o que acontece depois do pagamento, antes do pagamento.**
A tela promete "liberado em até 5 minutos". Na prática mediana é bem mais
rápido, e o relatório abre na mesma tela. Quem nunca comprou não sabe disso e
teme pagar via Pix e ficar sem nada, que é o medo clássico do Pix. Uma linha
dizendo "o relatório abre nesta mesma tela assim que o pagamento cair, você não
precisa fazer mais nada" custa nada e ataca o medo direto.

**5. Aproveitar o sinal de leilão negativo, que hoje é silêncio.**
Tomamos a decisão certa de não dizer "nenhum registro encontrado", porque isso
entregava a resposta de graça. Mas 95% das placas caem nesse caso e para elas a
tela ficou sem nenhum argumento específico do veículo. Sugiro testar uma linha
que fale do que ainda não sabemos, sem dar resultado: algo como "o histórico de
leilão deste veículo está no relatório completo, junto com restrição, roubo e
gravame". Mantém a dúvida viva e devolve a especificidade. É o oposto do que
fizemos, então merece teste A/B de verdade, não troca direta.

## 9. O que eu levaria para a auditoria como pergunta aberta

- Os 35 relatórios de cortesia para 9 pessoas, quase todos concentrados no fim
  de agosto: foi investimento consciente em beta testers?
- A Básica continua existindo por quê?
- O TTFB oscilando com a carga da VPS é problema de infraestrutura, e nenhuma
  otimização de front resolve. Vale discutir com o infra na mesma reunião.
- Metade das melhorias recentes atacou o meio do funil (checkout e Pix), onde o
  volume é de dezenas. O topo tem milhares. A próxima rodada deveria ser toda no
  topo.
