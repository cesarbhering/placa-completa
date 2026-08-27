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
    answer: 'A primeira olhada é. A consulta grátis aparece na própria tela, sem cadastro e sem pedir e-mail, e mostra marca, modelo, ano de fabricação e do modelo, cor, combustível, origem e o começo do chassi. Quem precisa de mais tem dois níveis pagos: a consulta básica, por R$ 19,90, traz valor FIPE com histórico de depreciação, seguro estimado, custo em 5 anos e a ficha técnica completa; o relatório completo, por R$ 44,90, traz também chassi e Renavam completos, restrição, roubo e furto, leilão, gravame, bloqueio judicial e indicador de multas.',
  },
  {
    question: 'Quais as formas de pagamento?',
    answer: 'Só Pix. É pagamento único, na hora, sem assinatura e sem guardar cartão. Assim que o Pix cai, o link do relatório libera sozinho.',
  },
  {
    question: 'Preciso criar conta ou assinar alguma coisa?',
    answer: 'Não. A consulta grátis não pede nem e-mail: o resultado aparece na tela. Nos níveis pagos você informa um e-mail apenas para receber o link do relatório, e não há cadastro, senha nem mensalidade.',
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
    answer: 'Sim. A consulta grátis não coleta nada seu. Nos níveis pagos, o e-mail serve apenas para enviar o link do relatório, que é privado. Não vendemos nem compartilhamos suas informações, e seguimos a LGPD.',
  },
  {
    question: 'Vocês emitem nota fiscal?',
    answer: 'Sim, emitimos. Basta solicitar pelo e-mail contato@placacompleta.com.br e disponibilizamos a nota em até 24 horas.',
  },
]
