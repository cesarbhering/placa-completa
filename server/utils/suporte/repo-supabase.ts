import type { Repo, Conversa, Tarefa } from './fluxo'

// Repo do atendimento no Supabase do premium (service role; RLS fechada).

const COLS = 'id,numero_hash,jid_cifrado,numero_mascarado,mensagens,nivel,status,motivo,pedido_id,contadores,silenciado_ate,ultima_resposta_em,n2_email_em,bloqueado_em'

export function repoSupabase(sb: any): Repo {
  return {
    async obterConversa(h) {
      const { data } = await sb.from('suporte_conversas').select(COLS).eq('numero_hash', h).maybeSingle()
      return (data as Conversa) || null
    },
    async conversaPorId(id) {
      const { data } = await sb.from('suporte_conversas').select(COLS).eq('id', id).maybeSingle()
      return (data as Conversa) || null
    },
    async criarConversa(c) {
      const { data, error } = await sb.from('suporte_conversas').insert(c).select(COLS).single()
      if (error) {
        // Corrida: duas mensagens do mesmo numero ao mesmo tempo.
        const { data: ja } = await sb.from('suporte_conversas').select(COLS).eq('numero_hash', c.numero_hash).maybeSingle()
        if (ja) return ja as Conversa
        throw new Error(`suporte_conversas insert: ${error.message}`)
      }
      return data as Conversa
    },
    async salvarConversa(c) {
      const { id, ...resto } = c
      await sb.from('suporte_conversas').update({ ...resto, atualizado_em: new Date().toISOString() }).eq('id', id)
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
    async registrarBloqueio(h, motivo) {
      await sb.from('suporte_bloqueios').upsert({ numero_hash: h, motivo, criado_em: new Date().toISOString(), desbloqueado_em: null })
    },
  }
}
