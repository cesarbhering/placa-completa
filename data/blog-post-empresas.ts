import type { BlogPost } from './blog-posts'
import { PLANOS, precoBRL } from '../shared/planos'

// Post "Para empresas" (20/out/2026). Regras de copy: nunca dizer que um carro
// "tem" problema (so "consta" / "indicador"), sem travessao, sem citar a fonte
// de dados do registro, sem valor de pacote (a proposta e sob consulta em
// /para-empresas). Preco avulso so via shared/planos.

const PRECO_COMPLETA = precoBRL(PLANOS.completa.valorCentavos)

export const postPacoteEmpresas: BlogPost = {
  slug: 'consulta-veicular-em-pacote-para-lojistas-e-despachantes',
  title: 'Consulta veicular em pacote para lojistas e despachantes: desconto e suporte prioritário',
  seoTitles: [
    'Consulta veicular em pacote para lojistas e despachantes',
    'Consulta de placa em pacote para lojistas e despachantes',
    'Pacote de consultas veiculares para lojistas',
  ],
  metaDescription: 'Pacote de consultas do PlacaCompleta para lojistas, garagens e despachantes: desconto por volume, suporte prioritário, Pix e consultas liberadas na hora.',
  publishedAt: '2026-10-20',
  categoria: 'Para empresas',
  capa: {
    src: '/images/blog/consulta-veicular-em-pacote-para-lojistas-e-despachantes.png',
    og: '/images/blog/consulta-veicular-em-pacote-para-lojistas-e-despachantes-1200.png',
    alt: 'Consulta veicular em pacote para lojistas, garagens e despachantes: desconto por volume e suporte prioritário.',
    largura: 1600,
    altura: 836,
  },
  content: [
    {
      type: 'intro',
      text: 'Quem vive de comprar e vender carro usado decide com a placa na mão. Cada veículo que entra no estoque é uma aposta, e a consulta é o que separa uma boa compra de um problema que só aparece depois. Para quem consulta várias placas por semana, o PlacaCompleta tem agora **consulta veicular em pacote para lojistas, garagens, despachantes e pequenas financeiras**, com desconto por volume e suporte prioritário.',
    },
    {
      type: 'heading',
      heading: 'Por que consultar toda placa antes de fechar',
      text: 'O anúncio mostra o carro. A consulta mostra o que o anúncio não conta. Antes de pagar ou de financiar, vale ver se a placa traz indicadores de:\n\n- **Leilão:** passagem por leilão muda o valor de revenda e a conversa com o comprador.\n- **Sinistro:** indício de sinistro importa para a avaliação e para o seguro.\n- **Gravame e restrições:** alienação, restrição judicial ou administrativa podem travar a transferência.\n- **Roubo ou furto:** ocorrência registrada é motivo para parar a negociação.\n- **Recall:** campanha de recall aberta é algo que o comprador vai perguntar.\n\nA consulta não substitui a vistoria nem o laudo cautelar. Ela mostra, em minutos, o que **consta** para aquela placa, e ajuda a decidir se vale seguir para a vistoria.',
    },
    {
      type: 'heading',
      heading: 'O custo de um carro problemático no estoque',
      text: 'Um veículo com pendência escondida raramente sai barato. Ele fica parado esperando comprador, pode travar na transferência, gera retrabalho do despachante, volta como reclamação ou vira desconto forçado para sair do pátio. Cada dia de estoque parado é capital preso e vaga ocupada.\n\nCompare isso com o custo da consulta. O relatório completo avulso do PlacaCompleta custa ' + PRECO_COMPLETA + ' por placa. Um único carro problemático evitado costuma custar bem mais do que muitas consultas. Por isso, para quem compra com frequência, o hábito de consultar toda placa antes de fechar tende a se pagar.',
    },
    {
      type: 'heading',
      heading: 'O que muda no pacote para empresas',
      text: 'O pacote foi pensado para quem consulta com frequência e não quer repetir o checkout a cada placa:\n\n- **Desconto por volume:** quanto mais consultas no pacote, menor o custo de cada uma.\n- **Suporte prioritário:** seu atendimento passa na frente quando surgir dúvida sobre um relatório.\n- **Resposta comercial em até 24 horas úteis:** você envia a proposta e recebe retorno da nossa equipe.\n- **Pagamento no Pix:** sem burocracia de cartão corporativo.\n- **Consultas liberadas na hora:** depois de fechado, o saldo fica disponível para usar.\n\nO valor do pacote depende do volume que você precisa, por isso ele é combinado direto com a nossa equipe.',
    },
    {
      type: 'heading',
      heading: 'Para quem é',
      text: '**Lojistas e garagens** que consultam cada carro antes de comprar ou de anunciar. **Despachantes** que querem conferir a situação do veículo antes de abrir o processo de transferência. **Pequenas financeiras** que checam o bem antes de aprovar o crédito. Se a sua rotina inclui mais de uma placa por semana, o pacote tende a fazer sentido.',
    },
    {
      type: 'cta',
      text: 'Conte quantas consultas você usa por mês e receba a proposta do pacote em até 24 horas úteis.',
      ctaLabel: 'Pedir proposta para a minha empresa',
      ctaTo: '/para-empresas',
    },
    {
      type: 'faq',
      heading: 'Perguntas frequentes',
      faq: [
        { q: 'Quanto custa o pacote de consultas para empresas?', a: 'O valor depende do volume de consultas e é combinado com a nossa equipe. Você envia a proposta pela página para empresas e recebe a resposta comercial em até 24 horas úteis. Para comparar, o relatório completo avulso custa ' + PRECO_COMPLETA + ' por placa.' },
        { q: 'Como recebo as consultas depois de fechar o pacote?', a: 'O pagamento é feito por Pix e as consultas ficam liberadas na hora, prontas para usar nas placas que você precisar.' },
        { q: 'A consulta substitui a vistoria ou o laudo cautelar?', a: 'Não. A consulta mostra os indicadores que constam para a placa, como leilão, sinistro, gravame, restrições, roubo e recall. A vistoria presencial e o laudo cautelar continuam recomendados antes de fechar a compra.' },
        { q: 'O pacote serve para despachantes e financeiras?', a: 'Sim. O pacote é para quem consulta com frequência: lojistas, garagens, despachantes e pequenas financeiras. Informe o seu perfil e o volume na proposta.' },
      ],
    },
  ],
}
