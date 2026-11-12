# NFS-e automática para os clientes do PlacaCompleta

Desenho aprovado em conversa com o Cesar em 12/11/2026. O construtor deve conseguir planejar a implementação a partir deste documento sem voltar ao Cesar, exceto nos pontos marcados como "decisão pendente".

## 1. Intenção

Emitir uma Nota Fiscal de Serviço eletrônica (NFS-e, padrão nacional) para cada relatório pago, em nome de quem pagou, sem que o cliente precise fazer nada. A nota vai por e-mail para quem informou e-mail e fica disponível para download na página do relatório, logo abaixo do QR code de verificação de autenticidade.

Por que agora: desde 01/11/2026 a Prefeitura de São Paulo obriga as empresas do Simples Nacional a emitir NFS-e pelo Emissor Nacional (sistema nacional da NFS-e). A empresa é do Simples, sediada em São Paulo capital, e hoje não emite nota para as vendas do site. Emitir automaticamente resolve a obrigação fiscal e dá ao cliente um documento fiscal do que comprou.

## 2. Goals, non-goals, anti-goals

**Goals**
- Toda venda entregue gera uma NFS-e válida no sistema nacional, com o CPF/CNPJ e o nome de quem pagou como tomador.
- O cliente recebe a nota sem pedir: e-mail (quando há) e link na página do relatório.
- Estorno aprovado cancela a nota automaticamente.
- Nada do fluxo de venda e entrega fica mais lento ou mais frágil por causa da nota: a emissão é assíncrona e tolerante a falha.
- Venda sem CPF/CNPJ utilizável não gera nota; o Cesar é avisado e decide.

**Non-goals (fora deste projeto)**
- Notas para períodos anteriores à entrada em produção (backfill de vendas antigas). Pode vir depois, como tarefa separada, se o Cesar pedir.
- Emissão para o app via Google Play Billing: o Google é quem fatura o cliente nessas vendas. Pedidos com `canal = 'app'` e pagamento pela Play ficam fora. (Decisão pendente, ver §9.)
- Apuração de imposto, DAS, livro fiscal. A nota só informa; o recolhimento segue com o contador.
- Pedir CPF ao cliente no checkout. O CPF vem do meio de pagamento.
- Trocar o tomador da nota depois de emitida (cliente que pagou com Pix de terceiro e quer nota no próprio nome). Fora por enquanto; se virar demanda, é uma substituição de NFS-e, que a API suporta.

**Anti-goals (o que tornaria isso um fracasso mesmo funcionando)**
- Vazar CPF ou nome em log, snapshot, evento de funil, e-mail de alerta ou página pública.
- Emitir nota duplicada para o mesmo pedido, ou nota para pedido estornado.
- Travar a entrega do relatório porque a API nacional está fora do ar.
- Deixar notas sem emitir em silêncio: toda falha persistente tem que chegar ao Cesar.
- Nota com descrição falsa do serviço ou código escolhido para "pagar menos imposto". No Simples a alíquota não depende do código; o código tem que ser o que descreve o serviço.

## 3. Restrições

- **Serviço independente, "como se fosse contratado".** A emissão é um produto à parte, em repositório próprio (`cesarbhering/nfse-emissor`, privado), com container e banco próprios (SQLite em volume). O PlacaCompleta é um **cliente** dele: fala por HTTP com `URL + API key`, como falaria com um provedor de mercado (NFE.io, Nota Gateway, Focus). Nada no site conhece o padrão nacional, XML, certificado ou DPS: só o contrato HTTP de §4.8. Trocar de provedor é trocar a URL, a chave e, no máximo, um adaptador de 1 arquivo no site. Decisão do Cesar: plug and play para poder rotacionar de provedor. Hoje roda na mesma VPS, na rede docker interna (`http://nfse:3000`), sem porta pública; pode ir para outra máquina sem mudar o site.
- **Certificado.** A assinatura da DPS e o mTLS usam o e-CNPJ A1 da empresa (`/root/.secrets/cert-novo.pfx`, válido até 06/09/2027). É o mesmo certificado do SENATRAN: se ele vencer ou for trocado, os dois param. O serviço recebe o PFX por volume somente leitura e a senha por env, nunca pelo repositório.
- **Repositório público.** Nada de CNPJ em teste, CPF real, chave de acesso real, PFX ou senha no código, em fixture ou em commit. Dados da empresa (CNPJ, inscrição municipal, endereço, código do município) entram por env.
- **Ambientes.** Toda a implementação é validada primeiro na **produção restrita** (`sefin.producaorestrita.nfse.gov.br`, `adn.producaorestrita.nfse.gov.br`) e só depois aponta para produção, por env.
- **API nacional.** Síncrona: `POST /nfse` recebe `{ dpsXmlGZipB64 }` (DPS em XML, assinada com XMLDSig, comprimida em GZip, em Base64) e devolve 201 com `chaveAcesso` (50 dígitos), `idDPS` e `nfseXmlGZipB64`. Cancelamento: `POST /nfse/{chaveAcesso}/eventos` com o XML do evento assinado. Documentação oficial: Guia das APIs v1.2 (out/2025) e Anexo I (leiautes e regras de negócio da DPS). O DANFSe (PDF da nota) **não** é mais fornecido pela API desde 03/08/2026 (NT 008): o serviço gera o PDF a partir do XML da NFS-e.
- **LGPD.** CPF e nome do pagador passam a ser guardados, cifrados em repouso, com acesso só pelo servidor, pelo prazo da obrigação fiscal (5 anos). Base legal: cumprimento de obrigação legal (emissão de documento fiscal). A política de privacidade e os termos de uso são atualizados antes de ligar em produção (textos em §8).
- **Sem ruído para o cliente.** O Cesar não quer linha nova no checkout nem parágrafo novo nos e-mails de entrega. A nota aparece na página e, para quem tem e-mail, num e-mail próprio curto, no layout oficial.

## 4. Como funciona (o que o Cesar decidiu)

### 4.1 Captura do tomador
- No webhook de pagamento (Woovi/Pix, AbacatePay/Pix, Stripe/cartão) o código hoje descarta de propósito o CPF/CNPJ e o nome do pagador e guarda só um HMAC (`server/utils/pagador-hash.ts`). Isso muda: além do hash, o site passa a gravar `cpf_cnpj` (só dígitos) e `nome` do pagador, **cifrados** (AES-256-GCM com chave de env própria, `NUXT_TOMADOR_KEY`), numa tabela nova `pedidos_tomador` (pedido_id PK, doc_cifrado, nome_cifrado, origem: 'pix' | 'cartao', criado_em). RLS ligado, só service role.
- Fonte por gateway: Woovi `charge.payer.taxID.taxID` + `payer.name`; AbacatePay o equivalente no payload do pix; Stripe `billing_details.name` e, se existir, `tax_id` do customer. Cartão sem CPF/CNPJ é o caso comum: vira "sem tomador".
- A sanitização do payload de webhook (`sanearPayloadWebhook`) continua apagando esses campos de `webhook_events`: o dado só vive em `pedidos_tomador`.
- Logs e eventos continuam sem CPF e sem nome (mascarar sempre: `***.***.789-**`).

### 4.2 Quando emitir
- Gatilho: o pedido passa a `entregue` (campo `entregue_em` gravado em `server/utils/premium-processar.ts`). Só então o site enfileira a emissão no serviço (`POST http://nfse:3000/emissoes`), em `emVoo`, sem esperar resposta. Nunca antes da entrega: se a entrega falhar e virar estorno, não há nota para cancelar.
- Dados enviados ao serviço: id do pedido, token (para o link), placa, plano, valor em centavos, data/hora do pagamento (competência), e-mail do cliente (pode ser nulo), e o tomador (doc e nome, já decifrados pelo site, pela rede interna).
- Sem tomador (doc ausente ou inválido): o site nem chama o emissor; grava `nfse_status = 'sem_tomador'` e manda um e-mail curto ao Cesar com o id do pedido e o motivo (via `pc-mail`, sem CPF). Decisão do Cesar: "pula e me avisa". (O emissor também aceita `tomador` ausente e responde `sem_tomador`, para clientes que prefiram delegar a regra.)

### 4.3 Conteúdo da nota (DPS)
- Prestador/emitente: a empresa (CNPJ, IM, endereço, código IBGE de São Paulo 3550308), optante do Simples ME/EPP, regime de apuração pelo SN. Tudo por env.
- Tomador: CPF ou CNPJ + nome vindos do pagamento. Endereço do tomador não é obrigatório para pessoa física no padrão nacional e não o temos: não informar.
- Serviço: código de tributação nacional **17.01.02** ("análise, exame, pesquisa, coleta, compilação e fornecimento de dados e informações de qualquer natureza, inclusive cadastro e similares"). Código NBS: o construtor escolhe o item de NBS mais próximo na tabela oficial do Portal NFS-e e registra a escolha no README do serviço (decisão menor, minha).
- Descrição (`xDescServ`), modelo: `Consulta veicular por placa: relatório {Básica|Completa} com dados cadastrais, débitos, restrições e histórico de leilão do veículo de placa {PLACA}. Pedido {8 primeiros chars do id}.` Sem nome de fornecedor, sem CPF.
- Valor: o valor pago (`valor_centavos` do pedido, com cupom já aplicado). ISSQN: operação tributável, incidência no município do prestador (São Paulo). Para o Simples, informar a alíquota do SN conforme a opção do emitente no cadastro nacional (o construtor confirma na produção restrita qual campo o convênio de SP exige; ver §9).
- Grupo IBS/CBS: em 2026 é opcional (NT 004 v2.0); não informar nesta versão.
- Série da DPS: uma série fixa (ex.: `1`), numeração sequencial controlada pelo serviço (coluna `numero_dps`, única). `dhEmi` = agora; `dCompet` = data do pagamento.
- Ambiente: `tpAmb` 2 (produção restrita) ou 1 (produção), por env.

### 4.4 Emissão
- O serviço monta o XML da DPS, assina (XMLDSig enveloped, SHA-256, sobre `infDPS`, com o certificado A1), comprime (GZip), codifica (Base64) e faz o `POST /nfse` com mTLS usando o mesmo certificado.
- Sucesso (201): guarda `chave_acesso`, `id_dps`, o XML da NFS-e devolvido (descomprimido) e gera o PDF (DANFSe) a partir dele. Estado `emitida`.
- Rejeição de regra de negócio (4xx com código de erro): guarda o código e a mensagem; estado `rejeitada`; não repete sozinho (repetir a mesma DPS dá o mesmo erro). Alerta ao Cesar com o código.
- Falha de rede/5xx/timeout: estado `pendente`, retentativa com backoff (1 min, 5 min, 30 min, 2 h, 12 h; máximo 10 tentativas em 3 dias). **Antes** de reenviar, consulta `GET /dps/{id}` para saber se a DPS anterior já virou nota (evita duplicata quando o timeout foi só na resposta). Depois do limite, estado `falhou` e alerta.
- Idempotência: uma linha por pedido (`pedido_id` único); o site pode chamar o serviço quantas vezes quiser.

### 4.5 Entrega ao cliente
- O serviço avisa o site (`POST /api/premium/nfse/pronta`, rota interna com segredo) quando a nota está `emitida`. O site grava em `pedidos_premium`: `nfse_chave`, `nfse_numero`, `nfse_emitida_em`, `nfse_status`.
- **Página do relatório**: abaixo do bloco "Verificação de autenticidade", um bloco "Nota fiscal de serviço (NFS-e)" com número, data, valor e o link "Baixar nota fiscal (PDF)". O PDF é servido pelo site em `GET /api/premium/nfse/{token}.pdf`, que valida o token e busca o arquivo no serviço (`GET http://nfse:3000/emissoes/{pedidoId}/danfse`). Nada público sem o token do pedido. Enquanto a nota não existe, o bloco não aparece (nem "em processamento").
- **E-mail**: para pedido com e-mail, um e-mail curto no layout oficial (`premium-email.ts`), de contato@, pela Resend, com o PDF em anexo e o link. Assunto e texto em §8. Sai uma vez só (`nfse_email_em`).

### 4.6 Cancelamento por estorno
- Quando um estorno é efetivado (`server/api/premium/reembolsar.post.ts` muda o status para `reembolsado`, para qualquer gateway), o site chama `POST http://nfse:3000/emissoes/{pedidoId}/cancelar`, em `emVoo`.
- O serviço registra o evento de cancelamento (`POST /nfse/{chaveAcesso}/eventos`, evento e101101 com justificativa "estorno do pagamento"), guarda o XML do evento e marca `cancelada`. Falha de rede: mesma política de retentativa. Rejeição (ex.: prazo de cancelamento vencido): estado `cancelamento_rejeitado` e alerta ao Cesar, porque aí o caminho é pedido de cancelamento por análise fiscal, manual.
- O site atualiza `nfse_status = 'cancelada'`; a página passa a mostrar "Nota fiscal cancelada em {data}" com o PDF ainda disponível (documento cancelado é documento).
- Estorno antes da nota existir: o serviço marca o pedido como `nao_emitir` e nada é emitido.

### 4.7 Operação e observabilidade
- Tabela `emissoes` no SQLite do serviço: pedido_id, estado, numero_dps, serie, chave_acesso, id_dps, tentativas, proxima_tentativa_em, erro_codigo, erro_msg, xml_dps, xml_nfse, xml_evento_cancel, danfse_path, criado_em, emitida_em, cancelada_em. Tomador **não** é guardado no serviço além do XML (o XML da DPS contém CPF e nome: o banco e o volume do serviço são tão sensíveis quanto `pedidos_tomador`).
- Backup diário do SQLite e dos PDFs para o R2 (padrão do `pc-vin-decoder-backup`), bucket privado, retenção 5 anos para XML/PDF.
- Timer no host `pc-nfse-check` (a cada 30 min): pendentes há mais de 6 h, rejeitadas, falhas, `sem_tomador` e `cancelamento_rejeitado` viram um e-mail resumido ao Cesar (sem CPF), no máximo 1 por hora. Também confere a validade do certificado e avisa com 60 dias de antecedência (reaproveitar `pc-senatran-cert-check`).
- Painel: o `pc-fin-json` ganha a contagem de notas emitidas no mês e o total faturado em nota, para o financeiro conferir contra as vendas.
- Relatório diário das 9h do financeiro: linha "NFS-e: X emitidas, Y pendentes, Z sem tomador".

### 4.8 Contrato HTTP do emissor (o que o site consome)
Todo endpoint exige `Authorization: Bearer <API_KEY>`. A chave é por cliente (tabela `clientes` no emissor: nome, chave hash, ativo), para o mesmo serviço poder atender mais de um site no futuro. JSON em pt-BR, datas ISO.
- `POST /v1/notas` — cria uma emissão. Corpo: `{ referencia (id externo, único por cliente), valor_centavos, competencia (date), descricao, tomador?: { documento, nome }, email?, metadados? }`. Resposta 202 `{ id, estado }`. Chamar de novo com a mesma `referencia` devolve a mesma nota (idempotente).
- `GET /v1/notas/{id}` — estado e dados: `{ id, referencia, estado: pendente|emitida|rejeitada|falhou|sem_tomador|cancelada|cancelamento_rejeitado|nao_emitir, numero, serie, chave_acesso, emitida_em, cancelada_em, erro?: { codigo, mensagem }, links: { pdf, xml } }`.
- `GET /v1/notas/{id}/pdf` e `/xml` — o DANFSe e o XML da NFS-e.
- `POST /v1/notas/{id}/cancelar` — `{ motivo }`; 202.
- `POST /v1/clientes/{id}/webhook` (configuração) — URL e segredo para o emissor avisar o cliente a cada mudança de estado (`nota.emitida`, `nota.rejeitada`, `nota.cancelada`, `nota.falhou`, `nota.sem_tomador`), com assinatura HMAC no header. O site usa isso para preencher `nfse_*` e mandar o e-mail; se o webhook falhar, o site tem um job que consulta `GET /v1/notas/{id}` dos pendentes.
- `GET /v1/saude` — certificado (dias para vencer), ambiente, fila (pendentes, falhas), última emissão.
- Erros: 401 chave inválida, 404, 409 referência já cancelada, 422 corpo inválido (com a lista de campos).
- Os parâmetros fiscais do emitente (CNPJ, IM, endereço, código IBGE, regime, série, código de serviço padrão, NBS, descrição padrão) ficam no **emissor**, por cliente. O site manda só o que varia por venda. Assim, trocar de provedor não exige o site conhecer dados fiscais.
- O lado do site vira um adaptador `server/utils/nfse-provedor.ts` com a interface `{ emitir, consultar, cancelar, pdf }`, implementação `nfse-emissor` (o nosso) e espaço para outra. Envs no site: `NUXT_NFSE=on`, `NUXT_NFSE_URL`, `NUXT_NFSE_API_KEY`, `NUXT_NFSE_WEBHOOK_SECRET`.

## 5. Partes do "como" que o Cesar decidiu
- Emissor nacional (SP conveniado), não a Nota do Milhão.
- CPF/CNPJ e nome do pagador: capturados do Pix/cartão, guardados no nosso banco (segurança jurídica), nunca pedidos ao cliente.
- Emissão após o relatório gerado, não no pagamento.
- Sem tomador: pular e avisar.
- Estorno cancela a nota automaticamente.
- E-mail para quem tem e-mail; link abaixo do QR na página do relatório; nada de página pública de busca.
- Serviço em container e repositório separados, com banco próprio, fora do Supabase, consumido pelo site por URL + API key como um provedor externo (plug and play).
- Sem textos novos no checkout e nos e-mails de entrega.
- Código 17.01.02.

## 6. O que fica com o construtor
- Linguagem do emissor: Node 22 + Fastify + better-sqlite3 (mesmo padrão do vin-decoder), para reaproveitar Dockerfile, compose, rede e backup. Repositório `cesarbhering/nfse-emissor` (privado, criado pela Lead), com README de instalação em qualquer VPS (compose, envs, volume do certificado) e OpenAPI do contrato de §4.8. Licença e nome neutros: nada de "PlacaCompleta" dentro do emissor além do cadastro do cliente. Bibliotecas: `xml-crypto` (XMLDSig), `fast-xml-parser` ou montagem manual do XML, `node-forge` só se precisar converter o PFX (preferir `openssl` no build), geração do PDF com `pdfkit` ou Playwright/Chromium já existente no host (render-service) a partir de um HTML no leiaute do DANFSe (NT 008: campos obrigatórios, QR code de consulta no portal nacional, chave de acesso).
- Validar o XML contra o XSD oficial (Anexo I) antes de assinar, em teste e em runtime.
- Suíte de testes: montagem da DPS a partir de um pedido de exemplo (CNPJ e CPF de teste válidos pelo dígito, fictícios), assinatura verificável, compressão/decodificação, idempotência, política de retentativa, cancelamento, e o contrato HTTP do serviço. Sem chamar a API nacional nos testes (gravar fixtures da produção restrita com dados fictícios).
- No site: adaptador `nfse-provedor.ts`, rota interna do webhook, migrations (staging e prod) `pedidos_tomador` e colunas `nfse_*` em `pedidos_premium`, bloco na página, e-mail, job de reconciliação dos pendentes.
- Checklist de produção restrita antes de ligar: emitir uma nota com CPF de teste, baixar o PDF, cancelar, consultar pela chave, e repetir com CNPJ de tomador.
- Flag `NUXT_NFSE=on` no site e `NFSE_AMBIENTE=producao|restrita` no serviço; entra desligado.

## 7. Riscos conhecidos
- O certificado é compartilhado com o SENATRAN; a troca anual passa a exigir atualizar os dois (documentar no runbook do cert).
- A API nacional tem instabilidade relatada por integradores (produção restrita fora por dias em jan/2026). A fila com retentativa cobre; se ficar fora por mais de 3 dias, as notas acumulam e o alerta avisa.
- Cancelamento tem prazo municipal; estorno tardio pode cair em "cancelamento rejeitado" e exigir pedido manual.
- Geração do DANFSe por nós: o leiaute tem campos obrigatórios; se faltar algo, a nota continua válida (o que vale é o XML), mas o PDF fica fora do padrão. Validar com um DANFSe de referência emitido pelo emissor web.

## 8. Textos (aprovados em princípio; revisar antes de ligar)
- **Política de privacidade, §3.1 (dados fornecidos) e §9 (retenção)**: "Ao pagar um relatório, recebemos do meio de pagamento (Pix ou cartão) o nome e o CPF ou CNPJ de quem pagou. Guardamos esses dados para emitir a nota fiscal de serviço (NFS-e) em seu nome e para cumprir as obrigações fiscais da empresa. Eles ficam armazenados de forma cifrada pelo prazo exigido pela legislação tributária (5 anos) e não são usados para nenhuma outra finalidade." Ajustar também §3.4 (dados que NÃO são tratados), que hoje diz que não tratamos CPF. Versão em inglês da mesma página.
- **Termos de uso**, cláusula nova: "A nota fiscal de serviço é emitida automaticamente, após a entrega do relatório, no nome e CPF/CNPJ de quem efetuou o pagamento. Em caso de estorno, a nota é cancelada."
- **E-mail da nota** (layout oficial, de contato@): assunto "Sua nota fiscal do relatório da placa {PLACA}"; título "Nota fiscal emitida"; corpo: "Emitimos a nota fiscal de serviço do seu relatório. Ela vai em anexo e também fica disponível na página do relatório, abaixo do código de verificação." Botão "Ver meu relatório". Rodapé padrão.
- **Página do relatório**, bloco: "Nota fiscal de serviço (NFS-e) nº {numero}, emitida em {data}, valor R$ {valor}. [Baixar nota fiscal (PDF)]". Cancelada: "Nota fiscal nº {numero} cancelada em {data}. [Baixar nota fiscal (PDF)]".

## 9. Decisões do Cesar em 12/11 (fecham as pendências)
1. **Google Play fora da nota.** Pedidos com `pix_provider = 'google_play'` (ou `canal = 'app'` sem cobrança Pix/cartão) não vão ao emissor; `nfse_status = 'fora_escopo'`. Filtro configurável no adaptador.
2. **Sem notas retroativas.** Só vendas entregues depois de a flag ligar em produção. Os ~120 pedidos de 01/11 até lá ficam sem nota (risco fiscal registrado, aceito pelo Cesar).
3. **Credenciamento no Emissor Nacional: já existe.** Em 12/11 a Lead entrou no portal (nfse.gov.br/EmissorNacional) com o e-CNPJ pelo Playwright da VPS (`/root/nfse-cadastro/login.py`; o Browser Use não aceita certificado de cliente) e a empresa já estava cadastrada e com 4 NFS-e emitidas em 03/11 (série 26, outro serviço, exportação). Parâmetros reais, copiados do portal e de uma dessas notas:
   - Emitente: CNPJ 62.569.152/0001-67, razão social CESAR CANCADO BHERING TECNOLOGIA LTDA, **sem Inscrição Municipal** no cadastro (campo "-"; a API aceita emissão sem IM para SP), endereço RUA BOM PASTOR, 529, bairro IPIRANGA, CEP 04203-050, São Paulo/SP (IBGE 3550308).
   - Simples Nacional: "Microempresa ou Empresa de Pequeno Porte (ME/EPP)", regime especial "Nenhum". Na configuração do emitente, a opção de "valor aproximado dos tributos" está vazia: o construtor deixa o grupo de tributos aproximados fora da DPS (opcional) ou, se o convênio de SP exigir, usa a opção "Informar alíquota do Simples Nacional" com a alíquota que o Cesar passar depois.
   - Numeração: as notas existentes usam a série 26. O emissor usa **outra série** (ex.: 27) para não colidir com o que o Cesar emite à mão no portal, com numeração própria a partir de 1.
   - Serviço do PlacaCompleta: cTribNac 17.01.02 (não o 01.06.01 das notas existentes, que são outro serviço); NBS a escolher na tabela oficial; tributação do ISSQN "1 - Operação tributável", incidência São Paulo/SP, retenção "1 - Não retido".
   - Produção restrita: cadastro separado, a confirmar no primeiro teste; se não existir, o construtor faz o primeiro acesso lá com o mesmo certificado.
4. **Cartão sem CPF (4% das vendas nos últimos 60 dias) e qualquer outro "sem tomador":** pula e avisa, como decidido. Acréscimo (decisão menor, minha): o emissor aceita `POST /v1/notas/{id}/tomador` para emitir depois à mão, caso o Cesar consiga o CPF do cliente; estado `aguardando_tomador`. Pix (Woovi e AbacatePay, 85%) traz CPF do pagador.
5. **A nota nunca trava o relatório nem o e-mail (Cesar, 12/11, 15h50).** O relatório é gerado, gravado e entregue, e o e-mail de entrega sai, exatamente como hoje, sem esperar nada do emissor. A chamada ao emissor acontece depois de `entregue_em` gravado, em `emVoo`, com timeout curto (3 s) e qualquer erro só logado: se o emissor estiver fora, o pedido fica `nfse_status = 'a_enfileirar'` e o job de reconciliação tenta de novo. O bloco da nota na página e o e-mail da nota entram depois, quando ela existir. Nenhum caminho do fluxo de venda (checkout, processamento, entrega, e-mail de entrega, reenvio) pode retornar erro por causa da NFS-e.
6. **Área do administrador (Cesar, 12/11, 17h15).** O emissor tem uma página própria, `/admin`, para o Cesar ver as notas em tabela (referência, número, estado, valor, tomador mascarado, datas), filtrar por estado, baixar o PDF e o XML de cada uma, cancelar com motivo e **emitir uma nota à mão** (formulário: valor, competência, descrição, CPF/CNPJ e nome do tomador, e-mail opcional; a referência é gerada `manual-<data>-<n>`). Decisões da Lead: a página é servida pelo próprio emissor (HTML simples, sem framework), protegida por usuário e senha de env (`NFSE_ADMIN_USER`, `NFSE_ADMIN_SENHA`, HTTP Basic) e fica atrás do Cloudflare Access (login por código enviado ao e-mail do Cesar) em `emissor.placacompleta.com.br`, como o dashboard da TV; sem porta pública direta. Notas manuais pertencem a um cliente interno `admin` criado pela própria página.
