<script setup lang="ts">
// "Suas consultas": lista as consultas premium salvas neste navegador
// (localStorage). Nao renderiza nada quando vazio, entao e seguro montar na
// home sem poluir quem nunca consultou. Ver useConsultaHistory.
const { itens, sync, clear } = useConsultaHistory()
onMounted(sync)

const pago = (s: string) => s === 'entregue' || s === 'pago' || s === 'consultando'

function rotuloStatus(s: string) {
  if (s === 'entregue') return 'Pago'
  if (s === 'pago' || s === 'consultando') return 'Processando'
  if (s === 'expirado') return 'Pix expirou'
  if (s === 'reembolsado') return 'Reembolsado'
  return 'Pagamento pendente'
}

function fmtData(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return ''
  }
}
</script>

<template>
  <section v-if="itens.length" class="pcHist">
    <div class="pcHist__bar">
      <b>Suas consultas</b>
      <button type="button" class="pcHist__clear" @click="clear">Limpar</button>
    </div>
    <div class="pcHist__body">
      <p class="pcHist__cap">
        <span aria-hidden="true">🔒</span>
        Salvas só neste navegador. Um jeito rápido de voltar aos seus relatórios ou concluir um pagamento.
      </p>
      <ul class="pcHist__list">
        <li v-for="it in itens" :key="it.token" class="pcHist__row">
          <span class="pcHist__pl">{{ it.placa }}</span>
          <span class="pcHist__info">
            <b>{{ it.veiculo || 'Consulta veicular' }}</b>
            <small>{{ pago(it.status) ? 'Consultada' : 'Iniciada' }} em {{ fmtData(it.criadoEm) }}</small>
          </span>
          <span class="pcHist__st" :class="pago(it.status) ? 'ok' : 'pend'">{{ rotuloStatus(it.status) }}</span>
          <NuxtLink v-if="it.status === 'entregue'" class="pcHist__act" :to="`/premium/${it.token}`">Ver relatório</NuxtLink>
          <NuxtLink v-else class="pcHist__act pcHist__act--pay" :to="`/premium/${it.token}`">Concluir</NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.pcHist {
  border: 1px solid #c4ccdc;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 8px 24px rgba(0, 40, 85, 0.08);
  font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
}
.pcHist__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, #0a3d78, #002855);
  color: #fff;
  padding: 8px 14px;
  font-size: 14px;
}
.pcHist__clear {
  background: transparent;
  border: 0;
  color: #b9c7dd;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
}
.pcHist__clear:hover { color: #fff; text-decoration: underline; }
.pcHist__cap {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #6b7a95;
  font-size: 12px;
  margin: 0;
  padding: 12px 16px 4px;
}
.pcHist__list { list-style: none; margin: 0; padding: 0; }
.pcHist__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid #eef2f8;
}
.pcHist__pl {
  background: #002855;
  color: #fff;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 1px;
  border-radius: 5px;
  padding: 4px 8px;
  white-space: nowrap;
}
.pcHist__info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.pcHist__info b { font-size: 14px; color: #12203a; }
.pcHist__info small { color: #6b7a95; font-size: 12px; }
.pcHist__st { font-size: 12px; font-weight: 700; white-space: nowrap; }
.pcHist__st.ok { color: #1e9e4a; }
.pcHist__st.pend { color: #c67c00; }
.pcHist__act {
  border: 1px solid #002855;
  color: #002855;
  background: #fff;
  border-radius: 7px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}
.pcHist__act:hover { background: #e3eefb; }
.pcHist__act--pay {
  background: linear-gradient(180deg, #0466c8, #0353a4);
  color: #fff;
  border-color: transparent;
}
.pcHist__act--pay:hover { background: linear-gradient(180deg, #0466c8, #024a92); }
@media (max-width: 560px) {
  .pcHist__row { flex-wrap: wrap; }
  .pcHist__info { flex-basis: calc(100% - 90px); }
  .pcHist__act { margin-left: auto; }
}
</style>
