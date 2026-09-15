import { dentroDoTetoDeEdital, refPertenceAoRelatorio, relatorioPodeBaixarEdital } from '../../utils/edital-leilao'

// Gera o link do edital do DETRAN pra UMA passagem de UM relatorio.
//
// A URL assinada nunca e guardada: ela vale 24h, entao um link no snapshot
// estaria morto no dia seguinte e vivo pra quem copiasse o JSON no primeiro.
// Cada clique gera o seu.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const token = String(body?.token || '').trim()
  const ref = String(body?.edital_ref || '').trim()

  if (!token || !ref) throw createError({ statusCode: 400, message: 'Pedido incompleto.' })

  // O teto e por relatorio, nao por IP: o link e caro (chave nossa na outra
  // ponta) e um relatorio legitimo clica poucas vezes.
  if (!dentroDoTetoDeEdital(token)) {
    throw createError({ statusCode: 429, message: 'Muitos downloads deste relatório. Tente daqui a pouco.' })
  }

  const supabase = usePremiumSupabase()
  const { data: pedido } = await supabase
    .from('pedidos_premium')
    .select('id,status,plano,relatorio_snapshot')
    .eq('token_entrega', token)
    .maybeSingle()

  // 404 e nao 403 em tudo: quem nao tem direito nao aprende nada sobre o que
  // existe do outro lado.
  if (!relatorioPodeBaixarEdital(pedido)) throw createError({ statusCode: 404, message: 'Edital não disponível.' })
  if (!refPertenceAoRelatorio(pedido!.relatorio_snapshot, ref)) {
    throw createError({ statusCode: 404, message: 'Edital não disponível.' })
  }

  const config = useRuntimeConfig()
  const base = String(config.leiloesApiUrl || '').replace(/\/+$/, '')
  const key = String(config.leiloesApiKey || '')
  if (!base || !key) throw createError({ statusCode: 503, message: 'Serviço de editais indisponível.' })

  try {
    const res = await $fetch<any>(`${base}/v1/edital-link`, {
      method: 'POST',
      headers: { 'X-API-Key': key, 'X-Origem': config.public.gated ? 'homolog-premium' : 'prod-premium' },
      body: { edital_ref: ref },
      timeout: 10000,
    })
    if (!res?.url) throw createError({ statusCode: 404, message: 'Edital não disponível.' })
    // So o que a tela usa. O resto da resposta (bytes, fonte) fica no servidor.
    return {
      url: String(res.url),
      expiraEm: res.expira_em ? String(res.expira_em) : null,
      nomeArquivo: res.nome_arquivo ? String(res.nome_arquivo) : null,
    }
  } catch (e: any) {
    if (e?.statusCode === 404) throw e
    console.warn('[edital] falhou:', e?.data?.message || e?.message)
    throw createError({ statusCode: 502, message: 'Não conseguimos gerar o link agora. Tente de novo.' })
  }
})
