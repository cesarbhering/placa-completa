// Renderer minimo de rich text dos posts (mesmo subset do IBV): **negrito**,
// [texto](url) e listas "- " / "1. ". Conteudo versionado no repo; mesmo assim
// escapa HTML e so gera tags da whitelist.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function renderInline(s: string): string {
  let out = escapeHtml(s)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, url) => {
    const externo = /^https?:\/\//.test(url) && !url.startsWith('https://placacompleta.com.br')
    return `<a href="${url}"${externo ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
  })
  return out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
}

export function renderRichText(text: string): string {
  if (!text) return ''
  const html: string[] = []
  for (const block of text.split(/\n\n+/)) {
    const lines = block.split('\n').filter((l) => l.trim() !== '')
    if (!lines.length) continue
    if (lines.every((l) => /^-\s+/.test(l))) html.push(`<ul>${lines.map((l) => `<li>${renderInline(l.replace(/^-\s+/, ''))}</li>`).join('')}</ul>`)
    else if (lines.every((l) => /^\d+\.\s+/.test(l))) html.push(`<ol>${lines.map((l) => `<li>${renderInline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`)
    else html.push(`<p>${lines.map(renderInline).join('<br>')}</p>`)
  }
  return html.join('')
}
