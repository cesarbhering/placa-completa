// Marca pra MOSTRAR pro cliente, derivada do payload cru da wdapi.
//
// Bug real (placa FHH1F97, Azera importado): pra veiculo importado o campo
// MARCA nao traz a marca, traz um codigo curto de importacao. A resposta vem
// assim:
//   MARCA: 'I'                     <- codigo, nao marca
//   MODELO: 'HYUNDAI AZERA 3.0 V6'
//   marcaModelo: 'I/HYUNDAI AZERA 3.0 V6'
//   listamodelo: ['HYUNDAI', 'AZERA', '3.0', 'V6']
// Mostrando MARCA cru, a tela dizia "Marca: I".
//
// Regra: so cai no fallback quando a MARCA e claramente um codigo (vazia, ate
// 2 caracteres, ou sem letra nenhuma). Caso domestico segue intacto: "VW",
// "GM" e "FIAT" tem que continuar aparecendo como vem, e nesses o MODELO nem
// comeca pela marca ("GOL 1.0"), entao derivar do modelo estragaria o dado.
//
// O corte de tamanho e "menos de 2 caracteres", nao "ate 2": VW e GM tem 2 e
// sao marcas de verdade na taxonomia da fonte. Codigo de mais de um caractere
// que apareca depois entra pela lista CODIGOS_IMPORTADO.

/** Codigos de importacao que aparecem no lugar da marca. */
const CODIGOS_IMPORTADO = new Set(['I', 'IMP', 'IMPORT'])

function primeiroToken(texto: unknown): string {
  return String(texto || '').trim().split(/[\s/]+/)[0] || ''
}

/** true quando o valor nao serve como marca pra mostrar na tela. */
export function marcaEhCodigo(marca: unknown): boolean {
  const m = String(marca ?? '').trim().toUpperCase()
  if (!m) return true
  if (CODIGOS_IMPORTADO.has(m)) return true
  if (!/[A-Z]/.test(m)) return true // "0", "-", numero solto
  return m.length < 2 // 1 caractere nunca e marca
}

/**
 * Marca de exibicao a partir do payload cru da wdapi. Devolve string vazia
 * quando nao da pra saber (melhor um campo vazio que "I" ou uma marca
 * inventada).
 */
export function marcaExibicao(api: any): string {
  const marca = String(api?.MARCA || api?.marca || '').trim()
  if (!marcaEhCodigo(marca)) return marca

  // Ordem de fallback: o primeiro item de listamodelo e o mais confiavel
  // (a fonte ja separou os tokens), depois SUBMODELO, depois o primeiro token
  // do MODELO, e por fim o pedaco depois da barra em marcaModelo.
  const lista = Array.isArray(api?.listamodelo) ? api.listamodelo : []
  const candidatos = [
    primeiroToken(lista[0]),
    primeiroToken(api?.SUBMODELO || api?.submodelo),
    primeiroToken(api?.MODELO || api?.modelo),
    primeiroToken(String(api?.marcaModelo || '').split('/').slice(1).join('/')),
  ]
  const escolhido = candidatos.find((c) => c && !marcaEhCodigo(c))
  return escolhido ? escolhido.toUpperCase() : ''
}
