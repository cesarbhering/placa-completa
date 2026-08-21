import https from 'node:https'

// Consulta SENATRAN server-side (homologacao), disparada APOS pagamento
// confirmado. Fluxo: pega a chave GCC ativa -> gera hash de consentimento
// (pago) -> consulta o veiculo no SERPRO gastando o hash (mTLS). Grava tudo no
// Supabase de homologacao. NUNCA chamar de superficie gratuita.

export type Ambiente = 'homolog' | 'producao'

function pemFromEnv(v: string): Buffer | null {
  if (!v) return null
  const s = v.includes('BEGIN') ? v : Buffer.from(v, 'base64').toString('utf8')
  return Buffer.from(s)
}

// Resolve o conjunto de config (GCC + SERPRO) por ambiente. Prod REUSA cert/key
// de homolog quando os de prod estao vazios; cnpj/template idem (fallback).
function configPorAmbiente(config: any, ambiente: Ambiente) {
  if (ambiente === 'producao') {
    return {
      gccBase: String(config.gccBaseProd || ''),
      senatranUrl: String(config.senatranUrlProd || ''),
      cnpj: String(config.senatranCnpjProvedorProd || config.senatranCnpjProvedor || ''),
      template: String(config.senatranTemplateIdProd || config.senatranTemplateId || ''),
      certPem: String(config.senatranCertPemProd || config.senatranCertPem || ''),
      keyPem: String(config.senatranKeyPemProd || config.senatranKeyPem || ''),
    }
  }
  return {
    gccBase: String(config.gccBase || ''),
    senatranUrl: String(config.senatranUrl || ''),
    cnpj: String(config.senatranCnpjProvedor || ''),
    template: String(config.senatranTemplateId || ''),
    certPem: String(config.senatranCertPem || ''),
    keyPem: String(config.senatranKeyPem || ''),
  }
}

// Todas as chaves candidatas do ambiente pedido, da mais nova pra mais antiga.
// Lista, e nao uma: ja aconteceu de a chave MAIS RECENTE estar expirada no GCC
// com uma valida logo atras. Preso na primeira, o fluxo estornava pedido
// pagavel. O filtro por ambiente so RESTRINGE o conjunto; NUNCA cai pra chave
// de outro ambiente.
async function chavesCandidatas(supabase: any, ambiente: Ambiente): Promise<{ id: string; api_key: string }[]> {
  const { data } = await supabase.from('gcc_api_keys').select('id,api_key').eq('ambiente', ambiente).eq('status', 'active').order('created_at', { ascending: false })
  if (data && data.length) return data
  const { data: todas } = await supabase.from('gcc_api_keys').select('id,api_key').eq('ambiente', ambiente).order('created_at', { ascending: false }).limit(1)
  return todas || []
}

function findHash(obj: any): string | null {
  let found: string | null = null
  const walk = (o: any) => {
    if (found || o == null || typeof o !== 'object') return
    for (const k of Object.keys(o)) {
      if (/numero_hash_consulta/i.test(k) && typeof o[k] === 'string') { found = o[k]; return }
      walk(o[k])
    }
  }
  walk(obj)
  return found
}

function senatranGet(opts: { url: string; placa: string; hash: string; cert: Buffer; key: Buffer }): Promise<{ status: number; body: string }> {
  const certEncoded = encodeURIComponent(opts.cert.toString())
  const u = new URL(`${opts.url}?placa=${encodeURIComponent(opts.placa)}&pagina=1`)
  return new Promise((resolve, reject) => {
    const req = https.request(
      { method: 'GET', hostname: u.hostname, port: 443, path: u.pathname + u.search, cert: opts.cert, key: opts.key, headers: { accept: '*/*', 'x-ssl-client-cert': certEncoded, 'x-jwt': opts.hash } },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode || 0, body: b })) },
    )
    req.on('error', reject)
    req.end()
  })
}

// Executa a consulta paga. Retorna o id da linha em senatran_consultas + o dado.
// ambiente ausente => 'homolog' (comportamento identico ao de hoje).
export async function consultarSenatran(placa: string, ambiente: Ambiente = 'homolog'): Promise<{ consultaId: string; ok: boolean; response: any; trace: any[] }> {
  // trace de homologacao: cada chamada externa (GCC + SERPRO) com URL, status e
  // corpo. Anexado ao erro em toda falha e devolvido no sucesso. Pode expor
  // detalhe (ferramenta de teste), mas NUNCA a api-key inteira (so prefixo).
  const trace: any[] = []
  const config = useRuntimeConfig()
  const env = configPorAmbiente(config, ambiente)
  const cert = pemFromEnv(env.certPem)
  const key = pemFromEnv(env.keyPem)
  if (!cert || !key) {
    trace.push({ etapa: 'config', erro: 'Certificados SENATRAN nao configurados.' })
    const err = createError({ statusCode: 503, message: 'Certificados SENATRAN nao configurados.' })
    ;(err as any).trace = trace
    throw err
  }
  const supabase = usePremiumSupabase()

  const chaves = await chavesCandidatas(supabase, ambiente)
  trace.push({ etapa: 'config', ambiente, gccBase: env.gccBase, senatranUrl: env.senatranUrl, cnpj: env.cnpj, template: env.template, chavePrefix: (chaves[0]?.api_key || '').slice(0, 6) })
  if (!chaves.length) {
    trace.push({ etapa: 'chave GCC', erro: 'sem chave ativa pra ambiente ' + ambiente })
    const err = createError({ statusCode: 503, message: 'Sem chave GCC ativa.' })
    ;(err as any).trace = trace
    throw err
  }

  // 1) hash de consentimento (pago). fetch nativo + parse explicito (o ofetch
  // se mostrou fragil aqui; o nativo funciona igual ao CLI que valida).
  // Tenta as chaves em ordem; 401 marca a chave como invalida no banco (pra
  // proxima requisicao nem tentar) e passa pra seguinte.
  let hash: string | null = null
  let chave: { id: string; api_key: string } | null = null
  // Fora do laco: o insert de gcc_consentimentos, mais abaixo, grava a
  // resposta da chave vencedora. Declarada dentro, dava ReferenceError em
  // producao de pedido, e o catch generico transformava isso em estorno.
  let consentResp: any = {}
  let ultimaHttp = 0
  let ultimoTexto = ''
  for (const candidata of chaves) {
    let consentRes: Response
    let consentText = ''
    try {
      consentRes = await fetch(`${env.gccBase}/consentimentos-ciencias`, {
        method: 'POST',
        headers: { accept: 'application/json', 'Api-Key': candidata.api_key, 'Content-Type': 'application/json' },
        // String() obrigatorio: o runtimeConfig do Nitro (destr) converte a string
        // numerica do env em NUMBER, e o GCC exige o CNPJ como STRING.
        body: JSON.stringify({ tipo_titular: null, cpf_cnpj: '', tipo_de_usuario: 1, cnpj_provedor: String(env.cnpj), template_id: String(env.template) }),
      })
      consentText = await consentRes.text()
    } catch (e: any) {
      trace.push({ etapa: 'GCC consentimento', metodo: 'POST', url: `${env.gccBase}/consentimentos-ciencias`, chavePrefix: candidata.api_key.slice(0, 6), erro: String(e) })
      const err = createError({ statusCode: 502, message: 'Falha de rede no GCC.' })
      ;(err as any).trace = trace
      throw err
    }
    ultimaHttp = consentRes.status
    ultimoTexto = consentText
    consentResp = {}
    try { consentResp = JSON.parse(consentText) } catch { /* deixa vazio */ }
    hash = findHash(consentResp)
    trace.push({ etapa: 'GCC consentimento', metodo: 'POST', url: `${env.gccBase}/consentimentos-ciencias`, chavePrefix: candidata.api_key.slice(0, 6), http: consentRes.status, ok: consentRes.ok, hashObtido: !!hash, resumo: consentText.slice(0, 1200) })
    if (hash) { chave = candidata; break }
    console.error('[senatran] consent sem hash. chave=', candidata.api_key.slice(0, 8), 'status=', consentRes.status, 'body=', consentText.slice(0, 200))
    if (consentRes.status === 401) {
      await supabase.from('gcc_api_keys').update({ status: 'invalid' }).eq('id', candidata.id)
    }
  }
  if (!hash || !chave) {
    console.error('[senatran] nenhuma chave obteve hash. status=', ultimaHttp, 'body=', ultimoTexto.slice(0, 300))
    const err = createError({ statusCode: 502, message: 'Nao obtive numero_hash_consulta.' })
    ;(err as any).trace = trace
    throw err
  }
  const { data: consent } = await supabase
    .from('gcc_consentimentos')
    .insert({ numero_hash_consulta: hash, status: 'created', api_key_id: chave.id, placa, raw_response: consentResp })
    .select()
    .single()

  // 2) consulta SENATRAN (gasta o hash)
  let out: { status: number; body: string }
  try {
    out = await senatranGet({ url: env.senatranUrl, placa, hash, cert, key })
  } catch (e: any) {
    trace.push({ etapa: 'SERPRO consulta', metodo: 'GET', url: env.senatranUrl + ' (placa=' + placa + ')', erro: String(e) })
    const err = createError({ statusCode: 502, message: 'Falha de rede no SERPRO.' })
    ;(err as any).trace = trace
    throw err
  }
  let parsed: any
  try { parsed = JSON.parse(out.body) } catch { parsed = { _raw: out.body } }
  const ok = out.status >= 200 && out.status < 300
  trace.push({ etapa: 'SERPRO consulta', metodo: 'GET', url: env.senatranUrl + ' (placa=' + placa + ')', http: out.status, ok, resumo: (out.body || '').slice(0, 1200) })

  const { data: consulta } = await supabase
    .from('senatran_consultas')
    .insert({ placa, consentimento_id: consent?.id, numero_hash_consulta: hash, http_status: out.status, ok, response: parsed })
    .select()
    .single()
  await supabase.from('gcc_consentimentos').update({ status: ok ? 'spent' : 'error', spent_at: new Date().toISOString() }).eq('id', consent?.id)

  if (!ok) {
    const err = createError({ statusCode: 502, message: 'SENATRAN retornou HTTP ' + out.status })
    ;(err as any).trace = trace
    throw err
  }
  return { consultaId: consulta.id, ok, response: parsed, trace }
}
