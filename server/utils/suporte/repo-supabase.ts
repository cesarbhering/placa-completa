import type { Repo, Conversa, Tarefa } from './fluxo'

// Repo do atendimento no Supabase do premium (service role; RLS fechada).

const COLS = 'id,numero_hash,jid_cifrado,numero_mascarado,mensagens,nivel,status,motivo,pedido_id,contadores,silenciado_ate,ultima_resposta_em,n2_email_em,bloqueado_em,nota_pedida_em,nota,nota_em,nivel_final'

export function repoSupabase(sb: any): Repo {
  return {
    // Uma linha por atendimento: a atual e a mais recente do numero. Bloqueio
    // vale pro numero (suporte_bloqueios), entao conversa nova nasce bloqueada.
    async obterConversa(h) {
      const { data } = await sb.from('suporte_conversas').select(COLS).eq('numero_hash', h).order('criado_em', { ascending: false }).limit(1)
      const atual = (data?.[0] as Conversa) || null
      if (atual && await this.numeroBloqueado(h)) return { ...atual, status: 'bloqueada' } as Conversa
      return atual
    },
    async numeroBloqueado(h) {
      const { data: bl } = await sb.from('suporte_bloqueios').select('numero_hash').eq('numero_hash', h).is('desbloqueado_em', null).maybeSingle()
      return !!bl
    },
    async conversaPorId(id) {
      const { data } = await sb.from('suporte_conversas').select(COLS).eq('id', id).maybeSingle()
      return (data as Conversa) || null
    },
    async criarConversa(c) {
      const { data, error } = await sb.from('suporte_conversas').insert(c).select(COLS).single()
      if (error) throw new Error(`suporte_conversas insert: ${error.message}`)
      return data as Conversa
    },
    async salvarConversa(c) {
      const { id, ...resto } = c
      // Copia velha da conversa (resposta agendada antes do bloqueio) nunca
      // desfaz um bloqueio gravado no meio.
      let q = sb.from('suporte_conversas').update({ ...resto, atualizado_em: new Date().toISOString() }).eq('id', id)
      if (c.status !== 'bloqueada') q = q.neq('status', 'bloqueada')
      await q
    },
    async criarTarefa(t) {
      await sb.from('suporte_tarefas').insert({ ...t, status: 'pendente' })
    },
    async tarefaPendenteDaConversa(conversaId) {
      const { data } = await sb.from('suporte_tarefas').select('*').eq('conversa_id', conversaId).eq('status', 'pendente').order('criado_em', { ascending: false }).limit(1)
      return (data?.[0] as Tarefa) || null
    },
    async tarefasRespondidas() {
      const { data } = await sb.from('suporte_tarefas').select('*').eq('status', 'respondida').not('resposta', 'is', null).order('criado_em').limit(20)
      return (data as Tarefa[]) || []
    },
    async marcarTarefa(id, campos) {
      await sb.from('suporte_tarefas').update(campos).eq('id', id)
    },
    async tarefasPendentesDesde(antesDe) {
      const { data } = await sb.from('suporte_tarefas').select('*').eq('status', 'pendente').is('escalada_em', null).lt('criado_em', antesDe).limit(20)
      return (data as Tarefa[]) || []
    },
    async conversasAbertasSemRespostaDesde(antesDe) {
      const { data } = await sb.from('suporte_conversas').select(COLS).eq('status', 'aberta').lt('ultima_resposta_em', antesDe).order('ultima_resposta_em').limit(50)
      return (data as Conversa[]) || []
    },
    async registrarBloqueio(h, motivo) {
      await sb.from('suporte_bloqueios').upsert({ numero_hash: h, motivo, criado_em: new Date().toISOString(), desbloqueado_em: null })
    },
  }
}
