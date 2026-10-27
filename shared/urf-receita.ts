// Unidade da Receita Federal (URF) do despacho de importacao (Cesar, 22/out/2026).
//
// O bloco de importacao do relatorio trazia "Órgão de despacho (Receita/SRF):
// 727600", que e o codigo da URF: 7 digitos com zero a esquerda (0727600 =
// Porto de Vitoria, ES). Os 2 primeiros digitos sao a Regiao Fiscal.
//
// Fonte: lista publica de URF de despacho da Fazcomex
// (https://www.fazcomex.com.br/npe/urf-de-despacho-na-exportacao/, 170 codigos,
// consultada em 27/out/2026), que reproduz a tabela aduaneira do Siscomex. A
// tabela do Siscomex nao estava acessivel daqui para conferir. Nomes em grafia
// normal (acentos e caixa); prefixos da fonte expandidos: ALF = Alfandega,
// IRF = Inspetoria, ARF = Agencia, DRF = Delegacia. UF pela unidade (os 3
// primeiros digitos identificam a jurisdicao; 0317903, IRF Sao Luis, e MA).

/** Codigo (7 digitos) -> [nome, UF]. */
export const URF_RECEITA: Record<string, [string, string]> = {
  '0117600': ['Aeroporto Internacional de Brasília', 'DF'],
  '0120100': ['Goiânia', 'GO'],
  '0120200': ['Anápolis', 'GO'],
  '0130100': ['Cuiabá', 'MT'],
  '0130151': ['Cáceres', 'MT'],
  '0140100': ['Campo Grande', 'MS'],
  '0145100': ['Mundo Novo', 'MS'],
  '0145200': ['Corumbá', 'MS'],
  '0145300': ['Ponta Porã', 'MS'],
  '0145351': ['Bela Vista', 'MS'],
  '0145352': ['Porto Murtinho', 'MS'],
  '0147600': ['Alfândega de Corumbá', 'MS'],
  '0147700': ['Alfândega de Mundo Novo', 'MS'],
  '0147800': ['Alfândega de Ponta Porã', 'MS'],
  '0147851': ['Agência de Bela Vista', 'MS'],
  '0147852': ['Agência de Porto Murtinho', 'MS'],
  '0150100': ['Palmas', 'TO'],
  '0210200': ['Santarém', 'PA'],
  '0210251': ['Óbidos', 'PA'],
  '0210300': ['Marabá', 'PA'],
  '0217600': ['Porto de Belém', 'PA'],
  '0217602': ['Barcarena', 'PA'],
  '0217700': ['Aeroporto Internacional de Belém', 'PA'],
  '0217800': ['Alfândega de Belém', 'PA'],
  '0217801': ['Inspetoria do Aeroporto Internacional de Belém', 'PA'],
  '0227600': ['Porto de Manaus', 'AM'],
  '0227603': ['Tabatinga', 'AM'],
  '0227700': ['Aeroporto Eduardo Gomes', 'AM'],
  '0230100': ['Rio Branco', 'AC'],
  '0230151': ['Brasiléia', 'AC'],
  '0230154': ['Assis Brasil', 'AC'],
  '0230155': ['Inspetoria de Epitaciolândia', 'AC'],
  '0240100': ['Macapá', 'AP'],
  '0240151': ['Oiapoque', 'AP'],
  '0240152': ['Santana', 'AP'],
  '0250100': ['Porto Velho', 'RO'],
  '0250151': ['Guajará-Mirim', 'RO'],
  '0260100': ['Boa Vista', 'RR'],
  '0260151': ['Pacaraima', 'RR'],
  '0260152': ['Bonfim', 'RR'],
  '0317600': ['Porto de Fortaleza', 'CE'],
  '0317700': ['Aeroporto Internacional Pinto Martins', 'CE'],
  '0317800': ['Porto de Pecém', 'CE'],
  '0317900': ['Alfândega de Fortaleza', 'CE'],
  '0317901': ['Inspetoria do Aeroporto Internacional Pinto Martins', 'CE'],
  '0317903': ['Inspetoria de São Luís', 'MA'],
  '0320151': ['Inspetoria do Porto de São Luís', 'MA'],
  '0327600': ['Porto de São Luís', 'MA'],
  '0330100': ['Teresina', 'PI'],
  '0410251': ['Petrolina', 'PE'],
  '0415100': ['Inspetoria de Recife', 'PE'],
  '0417700': ['Aeroporto Guararapes', 'PE'],
  '0417800': ['Porto de Suape', 'PE'],
  '0417900': ['Alfândega de Recife', 'PE'],
  '0417901': ['Inspetoria do Aeroporto Internacional dos Guararapes', 'PE'],
  '0417902': ['Inspetoria do Porto de Suape', 'PE'],
  '0420152': ['Parnamirim', 'RN'],
  '0420154': ['Inspetoria de Natal', 'RN'],
  '0420252': ['Areia Branca', 'RN'],
  '0430151': ['Cabedelo', 'PB'],
  '0440151': ['Maceió', 'AL'],
  '0510352': ['Inspetoria de Porto Seguro', 'BA'],
  '0510353': ['Inspetoria de Ilhéus', 'BA'],
  '0510551': ['Porto Seguro', 'BA'],
  '0510552': ['Ilhéus', 'BA'],
  '0517600': ['Porto de Salvador', 'BA'],
  '0517602': ['Porto de Aratu', 'BA'],
  '0517700': ['Aeroporto Internacional de Salvador Dep. Luís Eduardo', 'BA'],
  '0517800': ['Alfândega de Salvador', 'BA'],
  '0517801': ['Inspetoria do Aeroporto Internacional de Salvador', 'BA'],
  '0520100': ['Aracaju', 'SE'],
  '0610300': ['Governador Valadares', 'MG'],
  '0610400': ['Juiz de Fora', 'MG'],
  '0610500': ['Uberaba', 'MG'],
  '0610600': ['Varginha', 'MG'],
  '0610613': ['Delegacia de Poços de Caldas', 'MG'],
  '0610800': ['Montes Claros', 'MG'],
  '0610900': ['Uberlândia', 'MG'],
  '0611200': ['Poços de Caldas', 'MG'],
  '0615100': ['Inspetoria de Belo Horizonte', 'MG'],
  '0617700': ['Alfândega de Belo Horizonte', 'MG'],
  '0710200': ['Niterói', 'RJ'],
  '0710251': ['Inspetoria de Campos dos Goytacazes', 'RJ'],
  '0710252': ['Inspetoria de Macaé', 'RJ'],
  '0710300': ['Nova Iguaçu', 'RJ'],
  '0710400': ['Campos dos Goytacazes', 'RJ'],
  '0710500': ['Volta Redonda', 'RJ'],
  '0711000': ['Macaé', 'RJ'],
  '0717600': ['Porto do Rio de Janeiro', 'RJ'],
  '0717700': ['Aeroporto Internacional do Rio de Janeiro', 'RJ'],
  '0717800': ['Porto de Itaguaí', 'RJ'],
  '0727600': ['Porto de Vitória', 'ES'],
  '0810200': ['Araçatuba', 'SP'],
  '0810300': ['Bauru', 'SP'],
  '0810700': ['São José do Rio Preto', 'SP'],
  '0810800': ['Taubaté', 'SP'],
  '0810900': ['Ribeirão Preto', 'SP'],
  '0811000': ['Sorocaba', 'SP'],
  '0811200': ['Limeira', 'SP'],
  '0811203': ['Piracicaba', 'SP'],
  '0811800': ['Marília', 'SP'],
  '0812000': ['São José dos Campos', 'SP'],
  '0812003': ['Delegacia de Taubaté', 'SP'],
  '0812051': ['São Sebastião', 'SP'],
  '0812200': ['Araraquara', 'SP'],
  '0812300': ['Franca', 'SP'],
  '0812400': ['Jundiaí', 'SP'],
  '0812500': ['Piracicaba', 'SP'],
  '0817600': ['Aeroporto Internacional de São Paulo/Guarulhos', 'SP'],
  '0817700': ['Aeroporto Internacional de Viracopos', 'SP'],
  '0817800': ['Porto de Santos', 'SP'],
  '0817900': ['São Paulo', 'SP'],
  '0910200': ['Londrina', 'PR'],
  '0910300': ['Cascavel', 'PR'],
  '0910351': ['Santo Antônio do Sudoeste', 'PR'],
  '0910352': ['Capanema', 'PR'],
  '0910400': ['Ponta Grossa', 'PR'],
  '0910500': ['Maringá', 'PR'],
  '0910600': ['Foz do Iguaçu', 'PR'],
  '0910651': ['Guaíra', 'PR'],
  '0910652': ['Santa Helena', 'PR'],
  '0915200': ['Curitiba', 'PR'],
  '0917500': ['Alfândega de Foz do Iguaçu', 'PR'],
  '0917501': ['Inspetoria de Guaíra', 'PR'],
  '0917502': ['Inspetoria de Santa Helena', 'PR'],
  '0917800': ['Porto de Paranaguá', 'PR'],
  '0917900': ['Alfândega de Curitiba', 'PR'],
  '0920200': ['Joinville', 'SC'],
  '0920300': ['Joaçaba', 'SC'],
  '0920351': ['Dionísio Cerqueira', 'SC'],
  '0920400': ['Blumenau', 'SC'],
  '0920500': ['Lages', 'SC'],
  '0925200': ['Florianópolis', 'SC'],
  '0925251': ['Imbituba', 'SC'],
  '0927501': ['Inspetoria do Aeroporto Internacional de Florianópolis', 'SC'],
  '0927502': ['Inspetoria de Imbituba', 'SC'],
  '0927700': ['Porto de São Francisco do Sul', 'SC'],
  '0927800': ['Itajaí', 'SC'],
  '0927900': ['Alfândega de Dionísio Cerqueira', 'SC'],
  '1010200': ['Pelotas', 'RS'],
  '1010252': ['Jaguarão', 'RS'],
  '1010253': ['Bagé', 'RS'],
  '1010300': ['Santa Maria', 'RS'],
  '1010351': ['Inspetoria de Santana do Livramento', 'RS'],
  '1010400': ['Passo Fundo', 'RS'],
  '1010600': ['Caxias do Sul', 'RS'],
  '1010700': ['Novo Hamburgo', 'RS'],
  '1010851': ['Porto Mauá', 'RS'],
  '1010852': ['Porto Xavier', 'RS'],
  '1010900': ['Uruguaiana', 'RS'],
  '1010951': ['Itaqui', 'RS'],
  '1010953': ['São Borja', 'RS'],
  '1010954': ['Barra do Quaraí', 'RS'],
  '1010955': ['Quaraí', 'RS'],
  '1011100': ['Santa Cruz do Sul', 'RS'],
  '1015400': ['Porto Alegre', 'RS'],
  '1015500': ['Chuí', 'RS'],
  '1015600': ['Santana do Livramento', 'RS'],
  '1017500': ['Alfândega de Uruguaiana', 'RS'],
  '1017501': ['Inspetoria de Itaqui', 'RS'],
  '1017502': ['Inspetoria de Quaraí', 'RS'],
  '1017503': ['Inspetoria de São Borja', 'RS'],
  '1017504': ['Inspetoria de Porto Mauá', 'RS'],
  '1017505': ['Inspetoria de Porto Xavier', 'RS'],
  '1017600': ['Aeroporto Salgado Filho, Porto Alegre', 'RS'],
  '1017700': ['Porto de Rio Grande', 'RS'],
  '1017701': ['Inspetoria de Chuí', 'RS'],
  '1017800': ['Alfândega de Porto Alegre', 'RS'],
  '1017801': ['Inspetoria do Aeroporto Internacional Salgado Filho', 'RS'],
  '1017900': ['Alfândega de Santana do Livramento', 'RS'],
}

/** Regiao Fiscal da Receita pelos 2 primeiros digitos ("07" -> "7ª Região Fiscal"). */
export function regiaoFiscal(codigo: string): string | null {
  const n = Number(codigo.slice(0, 2))
  return n >= 1 && n <= 10 ? `${n}ª Região Fiscal` : null
}

/** "727600" / "0727600" / 727600 -> "0727600"; o que nao for codigo de URF: null. */
export function normalizarUrf(bruto: unknown): string | null {
  const s = String(bruto ?? '').replace(/\D/g, '')
  if (!s || /^0+$/.test(s) || s.length > 7) return null
  return s.padStart(7, '0')
}

export interface UrfReceita { codigo: string; nome: string | null; uf: string | null; regiao: string | null }

export function urfReceita(bruto: unknown): UrfReceita | null {
  const codigo = normalizarUrf(bruto)
  if (!codigo) return null
  const achou = URF_RECEITA[codigo]
  return { codigo, nome: achou?.[0] ?? null, uf: achou?.[1] ?? null, regiao: regiaoFiscal(codigo) }
}

/** "Porto de Vitória (ES), URF 0727600"; desconhecido: "URF 0727699". */
export function textoUrf(bruto: unknown): string | null {
  const u = urfReceita(bruto)
  if (!u) return null
  return u.nome ? `${u.nome} (${u.uf}), URF ${u.codigo}` : `URF ${u.codigo}`
}
