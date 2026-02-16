export interface HomepageFaq {
  question: string
  answer: string
}

export const homepageFaqs: HomepageFaq[] = [
  {
    question: 'O que é o PlacaCompleta?',
    answer: 'O PlacaCompleta é um serviço online e gratuito de consulta veicular. Basta digitar a placa do veículo para receber dados completos como marca, modelo, ano, cor, valor FIPE, situação e muito mais diretamente no seu e-mail.',
  },
  {
    question: 'A consulta é realmente grátis?',
    answer: 'Sim, 100% grátis. Não cobramos nada, não exigimos cadastro e não há limite de consultas. Os dados são enviados direto no seu e-mail em segundos.',
  },
  {
    question: 'Quais dados eu recebo na consulta?',
    answer: 'Você recebe marca, modelo, ano de fabricação e modelo, cor, valor atualizado na tabela FIPE, município e estado de registro, situação do veículo, chassi parcial, tipo de combustível, espécie, quantidade de passageiros e mais.',
  },
  {
    question: 'Como funciona a consulta por placa?',
    answer: 'É simples: digite a placa do veículo no formato ABC1D23 ou ABC1234, informe seu e-mail e clique em consultar. Em segundos você recebe todos os dados no e-mail informado.',
  },
  {
    question: 'Meus dados estão seguros?',
    answer: 'Sim. Seu e-mail é utilizado apenas para enviar o resultado da consulta. Não compartilhamos suas informações com terceiros e seguimos as diretrizes da LGPD.',
  },
  {
    question: 'Posso consultar qualquer tipo de veículo?',
    answer: 'Sim, o PlacaCompleta consulta carros, motos, caminhões, ônibus, vans e qualquer veículo registrado no Brasil com placa no formato padrão ou Mercosul.',
  },
]
