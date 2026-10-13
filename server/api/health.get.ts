import { quantasEmVoo, listaEmVoo, aceitandoTarefas } from '../utils/tarefas-em-voo'

// Saude leve: o processo responde e quantas buscas pos-entrega estao em voo.
// Usado pra conferir antes de deploy (em_voo: 0 = pode trocar o container).
// Sem dado de pedido: so o nome da tarefa e a idade.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { ok: true, em_voo: quantasEmVoo(), tarefas: listaEmVoo(), aceitando: aceitandoTarefas() }
})
