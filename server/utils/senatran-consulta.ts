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

async function chaveAtiva(supabase: any): Promise<{ id: string; api_key: string } | null> {
  let { data } = await supabase.from('gcc_api_keys').select('id,api_key').eq('status', 'active').order('created_at', { ascending: false }).limit(1)
  if (data && data.length) return data[0]
  ;({ data } = await supabase.from('gcc_api_keys').select('id,api_key').order('created_at', { ascending: false }).limit(1))
  return data && data.length ? data[0] : null
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

  const chave = await chaveAtiva(supabase)
  if (!chave) throw createError({ statusCode: 503, message: 'Sem chave GCC ativa.' })

  // 1) hash de consentimento (pago)
  const consentResp = await $fetch<any>(`${config.gccBase}/consentimentos-ciencias`, {
    method: 'POST',
    headers: { accept: 'application/json', 'Api-Key': chave.api_key, 'Content-Type': 'application/json' },
    body: { tipo_titular: null, cpf_cnpj: '', tipo_de_usuario: 1, cnpj_provedor: config.senatranCnpjProvedor, template_id: config.senatranTemplateId },
  })
  const hash = findHash(consentResp)
  if (!hash) throw createError({ statusCode: 502, message: 'Nao obtive numero_hash_consulta.' })
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
