// Builds a self-contained HTML document for the WhatsApp consulta
// card, with all visuals inlined so Gotenberg can render without
// any external fetches.
//
// Visual language mirrors the Win98/2000 aesthetic of the site and
// the email — but tuned for portrait phone delivery (480px wide).

import type { ICV5Result } from './icv5'

interface SpRodizio {
  day: string
  digits: string
}

interface BuildCardArgs {
  data: Record<string, any>
  placa: string
  /** Pre-fetched chart as a data:image/png;base64 URI, optional. */
  chartDataUri?: string | null
  icv5?: ICV5Result | null
  rodizio?: SpRodizio | null
}

const escapeHtml = (value: unknown): string => {
  const text = value == null ? '' : String(value)
  return text.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[c] as string))
}

const formatBRL = (value: number): string =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function buildWhatsAppCardHtml({
  data,
  placa,
  chartDataUri,
  icv5,
  rodizio,
}: BuildCardArgs): string {
  const marca = escapeHtml(data.MARCA || data.marca || '-')
  const modelo = escapeHtml(data.MODELO || data.modelo || '-')
  const ano = escapeHtml(data.ano || '-')
  const anoModelo = escapeHtml(data.anoModelo || '-')
  const cor = escapeHtml(data.cor || '-')
  const municipio = escapeHtml(data.municipio || '-')
  const uf = escapeHtml(data.uf || '-')
  const situacao = escapeHtml(data.situacao || '-')
  const chassi = escapeHtml(data.extra?.chassi || data.chassi || '-')
  const extra = data.extra || {}
  const combustivel = escapeHtml(extra.combustivel || '-')
  const especie = escapeHtml(extra.especie || '-')
  const tipoVeiculo = escapeHtml(extra.tipo_veiculo || '-')

  const fipeData = data.fipe?.dados?.reduce(
    (best: any, item: any) => ((item.score || 0) > (best?.score || 0) ? item : best),
    null,
  )
  const fipeValor = escapeHtml(fipeData?.texto_valor || '')
  const fipeModelo = escapeHtml(fipeData?.texto_modelo || '')
  const fipeRef = escapeHtml(fipeData?.mes_referencia || '')

  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  const window_ = (title: string, body: string) => `
    <section class="card">
      <header class="card__title">
        <span>${title}</span>
        <span class="card__btns"><span>&#x2013;</span><span>&#x25A1;</span><span class="card__close">&times;</span></span>
      </header>
      <div class="card__body">${body}</div>
    </section>
  `

  const row = (label: string, value: string) => `
    <div class="row">
      <span class="row__label">${label}</span>
      <span class="row__value">${value}</span>
    </div>
  `

  const veiculoRows = [
    row('Placa', escapeHtml(placa)),
    row('Marca', marca),
    row('Modelo', modelo),
    row('Ano fab/mod', `${ano} / ${anoModelo}`),
    row('Cor', cor),
    row('Combustível', combustivel),
    row('Tipo', tipoVeiculo),
    row('Espécie', especie),
    row('Chassi', chassi),
    row('Município', `${municipio} - ${uf}`),
    row('Situação', situacao),
  ].join('')

  const fipeRows = fipeValor ? [
    row('Modelo FIPE', fipeModelo || '-'),
    row('Valor', fipeValor),
    fipeRef ? row('Referência', fipeRef) : '',
    chartDataUri ? `<div class="chart"><img src="${chartDataUri}" alt="Histórico FIPE" /></div>` : '',
  ].filter(Boolean).join('') : ''

  const rodizioRows = rodizio ? [
    row('Final da placa', escapeHtml(placa.slice(-1))),
    row('Dia do rodízio', escapeHtml(rodizio.day)),
    row('Finais restritos', escapeHtml(rodizio.digits)),
    row('Horário', '7h-10h e 17h-20h'),
    `<p class="footnote">Restrição válida apenas no Centro Expandido de SP capital, dias úteis. Isentos: elétricos, táxis, motos, ônibus, ambulâncias e veículos de deficientes.</p>`,
  ].join('') : ''

  const icv5Rows = icv5 ? [
    row('Manutenção 5 anos', formatBRL(icv5.manutencao5anos)),
    row('IPVA 5 anos', formatBRL(icv5.ipva5anos)),
    row('Custo total 5 anos', formatBRL(icv5.custoTotal5anos)),
    row('Índice ICV5', `${icv5.indiceIcv5}% - ${icv5.classificacao}`),
  ].join('') : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(placa)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 480px;
    background: linear-gradient(175deg, #0b1b8f 0%, #0d2db5 45%, #3066be 100%);
    color: #1a1a2e;
    font-family: Tahoma, Verdana, Geneva, sans-serif;
    padding: 16px 12px 20px;
  }
  .card {
    background: #fff;
    border: 1px solid #7f9db9;
    margin: 0 auto 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.18);
  }
  .card__title {
    background: linear-gradient(180deg, #3a7dd8 0%, #1d52c9 50%, #0f389b 100%);
    color: #fff;
    font-family: 'Trebuchet MS', Tahoma, sans-serif;
    font-weight: bold;
    font-size: 13px;
    padding: 4px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    text-shadow: 1px 1px 0 rgba(0,0,30,0.5);
  }
  .card__btns { display: flex; gap: 3px; font-size: 10px; }
  .card__btns span {
    background: #1a4bb2;
    border: 1px solid rgba(0,0,30,0.35);
    width: 18px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .card__close { background: #b5241b !important; }
  .card__body { padding: 0; }
  .row {
    display: flex;
    border-bottom: 1px solid #e8e6db;
    padding: 7px 12px;
    font-size: 12.5px;
  }
  .row:last-child { border-bottom: none; }
  .row__label {
    flex: 0 0 42%;
    font-weight: bold;
    color: #1a1a2e;
    background: #f8f7ee;
    margin: -7px 0 -7px -12px;
    padding: 7px 12px;
  }
  .row__value {
    flex: 1;
    color: #0831d9;
    font-weight: bold;
    padding-left: 12px;
    word-break: break-word;
  }
  .chart {
    padding: 12px;
    background: #fff;
    text-align: center;
    border-top: 1px solid #e8e6db;
  }
  .chart img {
    width: 100%;
    max-width: 440px;
    height: auto;
    border: 1px solid #c8c4b0;
  }
  .footnote {
    padding: 10px 12px;
    font-size: 10.5px;
    font-style: italic;
    color: #5a5a6a;
    background: #f8f7ee;
    border-top: 1px solid #e8e6db;
    margin: 0;
    line-height: 1.45;
  }
  .header {
    text-align: center;
    color: #fff;
    font-family: 'Trebuchet MS', Tahoma, sans-serif;
    margin-bottom: 12px;
  }
  .header__logo {
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 0.5px;
    text-shadow: 1px 1px 0 rgba(0,0,30,0.6);
  }
  .header__placa {
    font-family: 'Courier New', monospace;
    font-size: 22px;
    font-weight: bold;
    letter-spacing: 3px;
    background: #fff;
    color: #090c9b;
    display: inline-block;
    padding: 4px 16px;
    margin-top: 8px;
    border: 2px solid #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
  }
  .footer {
    text-align: center;
    color: #c5d2f0;
    font-size: 10.5px;
    margin-top: 4px;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header__logo">PlacaCompleta</div>
    <div class="header__placa">${escapeHtml(placa)}</div>
  </div>

  ${window_('Dados do Veículo', veiculoRows)}
  ${fipeValor ? window_('Tabela FIPE', fipeRows) : ''}
  ${rodizio ? window_('Rodízio Municipal — SP', rodizioRows) : ''}
  ${icv5 ? window_(`ICV5 — Custo 5 anos em ${escapeHtml(icv5.uf)}`, icv5Rows) : ''}

  <div class="footer">Consulta em ${escapeHtml(timestamp)} • placacompleta.com.br</div>
</body>
</html>`
}
