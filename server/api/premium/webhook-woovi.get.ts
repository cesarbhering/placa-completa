// Handshake de validacao do webhook da Woovi. Ao registrar um webhook, a Woovi
// bate na URL com GET (e HEAD) e so aceita o registro se receber 200. O handler
// de verdade e o .post.ts (assinatura RSA + processamento); aqui e so o aperto
// de mao, que nao carrega dado de pagamento nenhum, entao 200 fixo e seguro.
export default defineEventHandler(() => ({ ok: true, ping: true }))
