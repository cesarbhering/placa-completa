import { montarEmailAviso } from './premium-email'

// Texto do e-mail de acesso de parceiro. ARQUIVO UNICO DE REDACAO: trocar o
// texto aqui e so aqui (o Cesar aprova antes de ligar a feature).
// O codigo vai junto porque o app Android (WebView) nao le o cookie do Chrome:
// la dentro a pessoa digita o codigo na pagina /parceiro.

export const TEXTO_EMAIL_PARCEIRO = {
  assunto: 'Seu acesso de parceiro à PlacaCompleta',
  titulo: 'Acesso de parceiro',
  paragrafos: (codigo: string) => [
    'Recebemos um pedido de acesso de parceiro para este e-mail. Toque no botão abaixo no aparelho em que você vai consultar as placas: o acesso fica ativo nesse navegador.',
    `No app da PlacaCompleta, abra a página de parceiro e digite o código ${codigo}.`,
    'Cada aparelho precisa ativar o acesso uma vez. Se você não pediu este e-mail, pode ignorá-lo.',
  ],
  botao: 'Ativar o acesso neste aparelho',
  nota: 'O link e o código valem por 30 minutos e funcionam uma única vez.',
}

export function montarEmailParceiro(a: { link: string; codigo: string }) {
  const t = TEXTO_EMAIL_PARCEIRO
  return montarEmailAviso({
    link: a.link,
    titulo: t.titulo,
    paragrafos: t.paragrafos(a.codigo),
    assunto: t.assunto,
    botao: t.botao,
    nota: t.nota,
  })
}
