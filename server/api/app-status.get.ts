// Status leve pro app decidir se mostra o empurrao de atualizacao. A flag e
// server-side (runtime), entao liga/desliga por env sem rebuild. Publico e
// barato: so um booleano, sem dado sensivel.
export default defineEventHandler(() => {
  return { forceUpdate: !!useRuntimeConfig().forceAppUpdate }
})
