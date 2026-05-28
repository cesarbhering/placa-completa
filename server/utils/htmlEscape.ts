const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
}

export function escapeHtml(value: unknown): string {
  const text = value == null ? '' : String(value)
  return text.replace(/[&<>"']/g, (m) => HTML_ESCAPE_MAP[m])
}
