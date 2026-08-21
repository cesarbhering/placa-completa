import https from 'node:https'

// Consulta SENATRAN server-side (homologacao), disparada APOS pagamento
// confirmado. Fluxo: pega a chave GCC ativa -> gera hash de consentimento
// (pago) -> consulta o veiculo no SERPRO gastando o hash (mTLS). Grava tudo no
// Supabase de homologacao. NUNCA chamar de superficie gratuita.

function pemFromEnv(v: string): Buffer | null {
  if (!v) return null
  const s = v.includes('BEGIN') ? v : Buffer.from(v, 'base64').toString('utf8')
  return Buffer.from(s)
}

// Todas as chaves candidatas, da mais nova pra mais antiga. Lista, e nao uma:
// ja aconteceu de a chave MAIS RECENTE estar expirada no GCC com uma valida
// logo atras — preso na primeira, o fluxo estornava pedido pagavel.
async function chavesCandidatas(supabase: any): Promise<{ id: string; api_key: string }[]> {
  const { data } = await supabase.from('gcc_api_keys').select('id,api_key').eq('status', 'active').order('created_at', { ascending: false })
  if (data && data.length) return data
  const { data: todas } = await supabase.from('gcc_api_keys').select('id,api_key').order('created_at', { ascending: false }).limit(1)
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
export async function consultarSenatran(placa: string): Promise<{ consultaId: string; ok: boolean; response: any }> {
  const config = useRuntimeConfig()
  const cert = pemFromEnv(config.senatranCertPem as string)
  const key = pemFromEnv(config.senatranKeyPem as string)
  if (!cert || !key) throw createError({ statusCode: 503, message: 'Certificados SENATRAN nao configurados.' })
  const supabase = usePremiumSupabase()

  const chaves = await chavesCandidatas(supabase)
  if (!chaves.length) throw createError({ statusCode: 503, message: 'Sem chave GCC ativa.' })

  // 1) hash de consentimento (pago). fetch nativo + parse explicito (o ofetch
  // se mostrou fragil aqui; o nativo funciona igual ao CLI que valida).
  // Tenta as chaves em ordem; 401 marca a chave como invalida no banco (pra
  // proxima requisicao nem tentar) e passa pra seguinte.
  let hash: string | null = null
  let chave: { id: string; api_key: string } | null = null
  // Fora do laco: o insert de gcc_consentimentos, mais abaixo, grava a
  // resposta da chave vencedora. Declarada dentro, dava ReferenceError em
  // producao de pedido — e o catch generico transformava isso em estorno.
  let consentResp: any = {}
  for (const candidata of chaves) {
    const consentRes = await fetch(`${config.gccBase}/consentimentos-ciencias`, {
      method: 'POST',
      headers: { accept: 'application/json', 'Api-Key': candidata.api_key, 'Content-Type': 'application/json' },
      // String() obrigatorio: o runtimeConfig do Nitro (destr) converte a string
      // numerica do env em NUMBER, e o GCC exige o CNPJ como STRING.
      body: JSON.stringify({ tipo_titular: null, cpf_cnpj: '', tipo_de_usuario: 1, cnpj_provedor: String(config.senatranCnpjProvedor || '37115342004154'), template_id: String(config.senatranTemplateId || '2932026-00001') }),
    })
    const consentText = await consentRes.text()
    consentResp = {}
    try { consentResp = JSON.parse(consentText) } catch { /* deixa vazio */ }
    hash = findHash(consentResp)
    if (hash) { chave = candidata; break }
    console.error('[senatran] consent sem hash. chave=', candidata.api_key.slice(0, 8), 'status=', consentRes.status, 'body=', consentText.slice(0, 200))
    if (consentRes.status === 401) {
      await supabase.from('gcc_api_keys').update({ status: 'invalid' }).eq('id', candidata.id)
    }
  }
  if (!hash || !chave) {
    throw createError({ statusCode: 502, message: 'Nao obtive numero_hash_consulta.' })
  }
  const { data: consent } = await supabase
    .from('gcc_consentimentos')
    .insert({ numero_hash_consulta: hash, status: 'created', api_key_id: chave.id, placa, raw_response: consentResp })
    .select()
    .single()

  // 2) consulta SENATRAN (gasta o hash)
  const out = await senatranGet({ url: config.senatranUrl as string, placa, hash, cert, key })
  let parsed: any
  try { parsed = JSON.parse(out.body) } catch { parsed = { _raw: out.body } }
  const ok = out.status >= 200 && out.status < 300

  const { data: consulta } = await supabase
    .from('senatran_consultas')
    .insert({ placa, consentimento_id: consent?.id, numero_hash_consulta: hash, http_status: out.status, ok, response: parsed })
    .select()
    .single()
  await supabase.from('gcc_consentimentos').update({ status: ok ? 'spent' : 'error', spent_at: new Date().toISOString() }).eq('id', consent?.id)

  if (!ok) throw createError({ statusCode: 502, message: 'SENATRAN retornou HTTP ' + out.status })
  return { consultaId: consulta.id, ok, response: parsed }
}
