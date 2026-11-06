// Compartilhar o resultado da consulta gratis no WhatsApp.
//
// Quem consultou e esta negociando um carro manda o link pra conversa
// (vendedor, conjuge, mecanico). Vai SO o link publico do resultado
// (/placa/<PLACA>) com UTM pra medir no GA/Clarity. Nada de dado pessoal,
// valor ou detalhe do relatorio pago no texto.
import { SITE_URL } from './jsonld-produto'

export const UTM_COMPARTILHAR = {
  utm_source: 'whatsapp',
  utm_medium: 'share',
  utm_campaign: 'resultado_gratis',
} as const

/** Placa so com letras e numeros, maiuscula (o que a rota /placa/:placa aceita). */
export function placaParaLink(placa: string | null | undefined): string {
  return String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** URL publica do resultado com as UTMs do compartilhamento. '' sem placa valida. */
export function urlResultadoCompartilhado(placa: string | null | undefined, base: string = SITE_URL): string {
  const p = placaParaLink(placa)
  if (p.length !== 7) return ''
  const qs = new URLSearchParams(UTM_COMPARTILHAR).toString()
  return `${base.replace(/\/+$/, '')}/placa/${p}?${qs}`
}

/**
 * "deste Uno 2015" quando modelo e ano estao na tela; so "deste carro" se
 * faltar o modelo. Ano so entra se for um ano de 4 digitos.
 */
export function rotuloVeiculo(modelo?: string | null, ano?: string | number | null): string {
  const m = String(modelo || '').replace(/\s+/g, ' ').trim()
  const a = String(ano ?? '').trim()
  if (!m) return 'deste carro'
  return /^\d{4}$/.test(a) ? `deste ${m} ${a}` : `deste ${m}`
}

export function textoCompartilhar(url: string, modelo?: string | null, ano?: string | number | null): string {
  return `Olha o que apareceu na consulta da placa ${rotuloVeiculo(modelo, ano)}: ${url}`
}

/** Link wa.me sem numero: o proprio usuario escolhe a conversa. '' sem placa valida. */
export function linkCompartilharWhatsapp(p: { placa: string | null | undefined; modelo?: string | null; ano?: string | number | null; base?: string }): string {
  const url = urlResultadoCompartilhado(p.placa, p.base)
  if (!url) return ''
  return `https://wa.me/?text=${encodeURIComponent(textoCompartilhar(url, p.modelo, p.ano))}`
}
