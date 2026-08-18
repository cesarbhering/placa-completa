export interface HomepageFaq {
  question: string
  answer: string
}

// Alimenta o acordeao da home E o schema.org FAQPage. Resposta errada aqui vira
// rich result errado no Google, entao vale so o que e verdade do produto.
//
// Regras de copy (.agents/product-marketing.md): nao nomear a fonte dos dados,
// nada de travessao, nenhum numero que o dono nao tenha confirmado.
export const homepageFaqs: HomepageFaq[] = [
  {
    question: 'O que é o PlacaCompleta?',
    answer: 'É uma consulta veicular por placa. Você digita a placa e vê na hora o que o carro é. Se quiser ir além, os níveis pagos mostram o que ele carrega: restrição, roubo e furto, passagem por leilão, gravame e a ficha completa. Sem cadastro e sem assinatura.',
  },
  {
    question: 'A consulta é grátis?',
    answer: 'A primeira olhada é. A consulta grátis mostra marca, modelo, ano, cor, situação, valor FIPE, seguro estimado e custo em 5 anos. Quem precisa de mais tem dois níveis pagos: a consulta básica, por R$ 19,90, traz a ficha técnica completa com chassi e Renavam; o relatório completo, por R$ 44,90, traz também restrição, roubo e furto, leilão, gravame, bloqueio judicial e indicador de multas.',
  },
  {
    question: 'Quais as formas de pagamento?',
    answer: 'Só Pix. É pagamento único, na hora, sem assinatura e sem guardar cartão. Assim que o Pix cai, o link do relatório libera sozinho.',
  },
  {
    question: 'Preciso criar conta ou assinar alguma coisa?',
    answer: 'Não. Não tem cadastro, senha nem mensalidade. Você paga uma vez pela consulta que fez. O link do relatório fica salvo no seu navegador para reabrir depois, no mesmo aparelho.',
  },
  {
    question: 'Quanto tempo leva para o relatório ficar pronto?',
    answer: 'Segundos, na maioria das vezes. O sistema funciona 24 horas por dia, todo dia: você não depende de horário comercial nem entra em fila.',
  },
  {
    question: 'Paguei no Pix e o relatório não abriu. O que faço?',
    answer: 'Aguarde alguns instantes e recarregue a página: o relatório libera sozinho assim que o pagamento é confirmado. Se você fechou a aba, o link fica salvo no histórico do seu navegador, no mesmo aparelho. Se ainda assim não abrir, fale com a gente pelo contato do rodapé.',
  },
  {
    question: 'E se vocês não acharem o veículo?',
    answer: 'O valor volta pelo Pix automaticamente. Você não paga por uma consulta que não trouxe resultado.',
  },
  {
    question: 'Dá para descobrir o nome ou o endereço do dono pela placa?',
    answer: 'Não. Dado pessoal do proprietário é protegido por lei e não entra em nenhum dos nossos relatórios. O que você recebe é a situação do veículo, não a identificação de quem está no documento.',
  },
  {
    question: 'Consigo consultar um veículo antigo?',
    answer: 'Na maioria dos casos, sim. Veículos muito antigos podem ter registro incompleto, porque o cadastro nacional é mais recente do que eles. Se não acharmos o veículo, o valor é estornado automaticamente.',
  },
  {
    question: 'A consulta vale para todo o Brasil e qualquer veículo?',
    answer: 'Sim. A busca é nacional e aceita placa antiga (ABC1234) e Mercosul (ABC1D23), para carro, moto, caminhão, ônibus, van e qualquer veículo registrado no país.',
  },
  {
    question: 'Meus dados estão seguros?',
    answer: 'Sim. Seu e-mail serve apenas para enviar o resultado da consulta e o link do relatório é privado, só seu. Não vendemos nem compartilhamos suas informações, e seguimos a LGPD.',
  },
]
