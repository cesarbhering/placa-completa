import { origemDaSessao } from './origem-trafego'

/**
 * E-mail ao Cesar a cada clique no WhatsApp do site (pedido dele em 16/11/2026:
 * o numero e atendido a mao, sem bot). O clique so abre o WhatsApp da pessoa,
 * entao o site nao sabe se ela mandou mensagem. Nada identificavel vai no
 * aviso: so onde foi o clique, a categoria da pagina, o aparelho e a origem.
 */
export const ONDE_CLIQUE = ['flutuante', 'checkout', 'resultado_gratis', 'outro'] as const
export type OndeClique = (typeof ONDE_CLIQUE)[number]
export const ORIGENS_CLIQUE = ['bing', 'google', 'outra_campanha', 'sem_anuncio'] as const
export type OrigemClique = (typeof ORIGENS_CLIQUE)[number]

const ROTULO_ONDE: Record<OndeClique, string> = {
  flutuante: 'botão flutuante',
  checkout: 'link "Dúvidas?" do checkout',
  resultado_gratis: 'link "Dúvidas?" do resultado grátis',
  outro: 'outro link de WhatsApp',
}
const ROTULO_PAGINA: Record<string, string> = {
  home: 'página inicial',
  resultado: 'resultado da consulta grátis',
  relatorio: 'relatório pago',
  blog: 'blog',
  conteudo: 'outra página do site',
}
const ROTULO_ORIGEM: Record<OrigemClique, string> = {
  bing: 'anúncio do Bing',
  google: 'anúncio do Google',
  outra_campanha: 'outra campanha',
  sem_anuncio: 'sem anúncio (orgânico ou direto)',
}

export interface CliqueWhatsapp {
  onde: OndeClique
  pagina: string
  origem: OrigemClique
  aparelho: string
}

function tem<T extends string>(lista: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (lista as readonly string[]).includes(v)
}

/** `onde` do componente -> valor aceito pelo servidor. */
export function ondeDoClique(onde: unknown): OndeClique {
  return tem(ONDE_CLIQUE, onde) ? onde : 'outro'
}

/** Categoria da origem guardada na sessao. Nenhum id de clique sai do navegador. */
export function origemDoClique(o: Record<string, string> | undefined | null): OrigemClique {
  if (!o) return 'sem_anuncio'
  const fonte = String(o.utm_source || '').toLowerCase()
  if (o.msclkid || fonte === 'bing') return 'bing'
  if (o.gclid || fonte === 'google') return 'google'
  if (fonte || o.oppref || o.obref) return 'outra_campanha'
  return 'sem_anuncio'
}

/** Corpo recebido -> clique valido, ou null. Valor fora das listas vira categoria generica. */
export function validarClique(b: unknown, aparelho: string): CliqueWhatsapp | null {
  if (!b || typeof b !== 'object') return null
  const c = b as Record<string, unknown>
  if (!tem(ONDE_CLIQUE, c.onde)) return null
  const pagina = typeof c.pagina === 'string' && Object.prototype.hasOwnProperty.call(ROTULO_PAGINA, c.pagina) ? c.pagina : 'conteudo'
  const origem = tem(ORIGENS_CLIQUE, c.origem) ? c.origem : 'sem_anuncio'
  return { onde: c.onde, pagina, origem, aparelho: aparelho || 'desconhecido' }
}

export function assuntoClique(c: CliqueWhatsapp): string {
  return `Clique no WhatsApp do site: ${ROTULO_ONDE[c.onde]}`
}

export function textoClique(c: CliqueWhatsapp, quando: Date): string {
  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(quando)
  return [
    'Alguém clicou no WhatsApp do site.',
    '',
    `Quando: ${hora} (horário de Brasília)`,
    `Onde: ${ROTULO_ONDE[c.onde]}`,
    `Página: ${ROTULO_PAGINA[c.pagina] ?? ROTULO_PAGINA.conteudo}`,
    `Aparelho: ${c.aparelho}`,
    `Origem: ${ROTULO_ORIGEM[c.origem]}`,
    '',
    'O clique só abre o WhatsApp da pessoa. Ela pode não ter mandado a mensagem.',
    'Vários cliques da mesma pessoa em 10 minutos geram um aviso só.',
  ].join('\n')
}

/** Cliente: avisa o servidor sem atrasar nem quebrar o clique (beacon, depois fetch keepalive). */
export function avisarCliqueWhatsapp(onde: OndeClique, pagina: string): void {
  try {
    const corpo = JSON.stringify({ onde, pagina, origem: origemDoClique(origemDaSessao()) })
    const beacon = globalThis.navigator?.sendBeacon?.bind(globalThis.navigator)
    if (beacon && beacon('/api/contato/whatsapp-clique', new Blob([corpo], { type: 'application/json' }))) return
    void fetch('/api/contato/whatsapp-clique', { method: 'POST', headers: { 'content-type': 'application/json' }, body: corpo, keepalive: true }).catch(() => {})
  } catch {
    // O aviso nunca atrapalha o clique.
  }
}
