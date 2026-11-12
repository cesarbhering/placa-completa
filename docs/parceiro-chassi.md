# Parceiros com chassi completo na consulta grátis

Decisão do Cesar, 12/nov/2026. Uma lista curta de e-mails de empresas parceiras vê o chassi completo
no resultado da consulta grátis (web e app). Para todo o resto, nada muda: o chassi segue mascarado.

## Ligar, cadastrar, revogar

- Flag: `NUXT_PARCEIRO_CHASSI=on` (desligada por padrão; sem ela, as rotas respondem igual e nada acontece).
- Segredo do cookie: `NUXT_PARCEIRO_CHASSI_SECRET` (sem ele, é derivado da service key). Trocar o segredo
  derruba todos os cookies.
- Cadastro (só pelo banco, service role; e-mail nunca no repositório):
  `insert into parceiros_chassi (email_normalizado, nome_empresa) values (lower(trim('<email>')), '<empresa>');`
- Revogar: `update parceiros_chassi set ativo = false where ...`. O cookie para de valer em até 30 s (cache
  curto em memória por processo).
- Auditoria e limite: `parceiros_chassi_uso` (parceiro, placa, hash do IP, canal, hora). Limite de 20
  consultas por hora por parceiro; acima disso a pessoa volta a ser visitante comum até a hora virar.

## Como a pessoa ativa

1. Abre `/parceiro` (sem link em nenhuma página, `noindex`, fora do sitemap) e informa o e-mail.
2. A resposta é sempre a mesma. Se o e-mail estiver na lista e ativo, chega um e-mail (de contato@) com
   um link e um código de 8 caracteres, válidos por 30 min e de uso único. Texto em
   `server/utils/parceiro-chassi-email.ts`.
3. **PC e navegador do celular:** toca no link, abre `/parceiro/entrar` e toca em "Ativar neste aparelho".
   O token só é gasto nesse clique (POST): os filtros de link do e-mail corporativo, que abrem o link
   antes da pessoa, não queimam o acesso.
4. **App Android:** o app atual roda numa WebView (Capacitor), que **não** divide cookie com o Chrome.
   O link aberto no Chrome não ativa o app. Dentro do app, a pessoa abre `placacompleta.com.br/parceiro`
   (ou `app.placacompleta.com.br/parceiro`), informa o e-mail e digita o código do e-mail. No app antigo
   (TWA, roda dentro do Chrome) o cookie do Chrome vale, então o link basta.
5. O cookie (`pc_parceiro`, HttpOnly, Secure, SameSite=Lax, 180 dias) fica no domínio-mãe
   `placacompleta.com.br`, então vale para `www.` e `app.` no mesmo navegador. Cada aparelho ativa uma vez.

## O que muda na resposta da consulta grátis

Só com cookie válido + parceiro ativo + dentro do limite (decisão 100% no servidor):
- `basico.chassiParcial` traz o chassi da fonte (inteiro quando a PlacaFipe mandou 17 caracteres; a WDAPI
  às vezes manda parcial, e sai como veio) e `basico.chassiParceiro: true` (selo "parceiro" na tela).
- No app, `data` sai sem a máscara do chassi e com `parceiro: true`.
- O parceiro não passa pelo gate de e-mail nem pelo limite grátis por hora. O Turnstile continua valendo.
- A resposta sai com `Cache-Control: private, no-store`. O POST da consulta não é cacheado pela Cloudflare,
  e o `placa_cache` continua guardando o dado inteiro só no servidor, como sempre.
- E-mail e WhatsApp da consulta continuam com o chassi mascarado.
