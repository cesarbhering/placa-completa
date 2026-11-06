<script setup lang="ts">
// Nota do cliente premium (05/nov/2026). Chega pelo e-mail de acompanhamento:
// cada botao do e-mail traz ?nota=N e a nota e gravada aqui, no navegador (um
// leitor de links do provedor que so busca a pagina nao vota). O token da URL
// e a credencial: pagina noindex e nada de dado do cliente na resposta.
//
// Depois da nota: 4 ou 5 recebem o convite para avaliar no Google; 1 a 3
// recebem "O que podemos melhorar?". Sem cupom e sem brinde.
const LINK_GOOGLE = 'https://g.page/r/CWpx3yMC2irbEBM/review'

const route = useRoute()
const token = String(route.params.token || '')

useHead({ title: 'Sua opinião', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { data, error } = await useFetch<any>(`/api/feedback/${encodeURIComponent(token)}`)

const nota = ref<number | null>(data.value?.nota ?? null)
const comentarioEnviado = ref<boolean>(!!data.value?.comentarioEnviado)
const gravando = ref(false)
const erro = ref('')
const comentario = ref('')
const enviando = ref(false)

async function gravarNota(n: number) {
  if (gravando.value || nota.value) return
  gravando.value = true
  erro.value = ''
  try {
    const r: any = await $fetch('/api/feedback/nota', { method: 'POST', body: { token, nota: n } })
    // Se ja havia nota, vale a gravada (clicar de novo mostra a mesma tela).
    nota.value = r?.nota ?? n
    comentarioEnviado.value = !!r?.comentarioEnviado
  } catch {
    erro.value = 'Não conseguimos registrar agora. Tente de novo em instantes.'
  } finally {
    gravando.value = false
  }
}

onMounted(() => {
  const n = Number(route.query.nota)
  if (!error.value && !nota.value && Number.isInteger(n) && n >= 1 && n <= 5) gravarNota(n)
})

async function enviarComentario() {
  if (!comentario.value.trim() || enviando.value) return
  enviando.value = true
  erro.value = ''
  try {
    await $fetch('/api/feedback/comentario', { method: 'POST', body: { token, comentario: comentario.value } })
    comentarioEnviado.value = true
  } catch {
    erro.value = 'Não conseguimos enviar agora. Tente de novo em instantes.'
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main class="fb">
    <section v-if="error" class="fb__card fb__card--centro">
      <h1 class="fb__titulo">Este link não vale mais</h1>
      <p class="fb__texto">Ele pode ter sido copiado pela metade. Abra de novo pelo e-mail que você recebeu.</p>
      <NuxtLink to="/" class="fb__link">Voltar para a PlacaCompleta</NuxtLink>
    </section>

    <!-- 4 ou 5: convite para o Google -->
    <section v-else-if="nota && nota >= 4" class="fb__card fb__card--centro">
      <p class="fb__eyebrow">Sua nota: {{ nota }} de 5</p>
      <h1 class="fb__titulo">Que bom que ajudou!</h1>
      <p class="fb__texto">Pode contar isso no Google? Leva 30 segundos.</p>
      <a :href="LINK_GOOGLE" class="fb__botao" target="_blank" rel="noopener">Avaliar no Google</a>
    </section>

    <!-- 1 a 3, comentario ja enviado -->
    <section v-else-if="nota && comentarioEnviado" class="fb__card fb__card--centro">
      <h1 class="fb__titulo">Recebemos, obrigado</h1>
      <p class="fb__texto">Vamos ler com atenção. Se quiser falar com a gente, escreva para contato@placacompleta.com.br.</p>
      <NuxtLink to="/" class="fb__link">Voltar para a PlacaCompleta</NuxtLink>
    </section>

    <!-- 1 a 3: o que melhorar -->
    <section v-else-if="nota" class="fb__card">
      <p class="fb__eyebrow">Sua nota: {{ nota }} de 5</p>
      <h1 class="fb__titulo">Obrigado. O que podemos melhorar?</h1>
      <label class="fb__sr" for="fb-comentario">O que podemos melhorar?</label>
      <textarea id="fb-comentario" v-model="comentario" class="fb__textarea" rows="5" maxlength="2000" placeholder="Conte o que faltou ou o que deu errado" />
      <button type="button" class="fb__botao fb__botao--largo" :disabled="!comentario.trim() || enviando" @click="enviarComentario">
        {{ enviando ? 'Enviando...' : 'Enviar' }}
      </button>
      <p v-if="erro" class="fb__erro">{{ erro }}</p>
    </section>

    <!-- Sem nota ainda (abriu o link sem ?nota, ou a gravacao esta em curso) -->
    <section v-else class="fb__card">
      <p v-if="data?.placa" class="fb__eyebrow">Consulta {{ data.placa }}</p>
      <h1 class="fb__titulo">De 1 a 5, como foi a sua experiência?</h1>
      <div class="fb__notas" role="group" aria-label="Nota de 1 a 5">
        <button v-for="n in 5" :key="n" type="button" class="fb__nota" :disabled="gravando" :aria-label="`Nota ${n} de 5`" @click="gravarNota(n)">{{ n }}</button>
      </div>
      <p class="fb__escala"><span>Muito ruim</span><span>Muito bom</span></p>
      <p v-if="erro" class="fb__erro">{{ erro }}</p>
    </section>
  </main>
</template>

<style scoped>
.fb { background: #f7f7f7; display: flex; justify-content: center; padding: 24px 16px 56px; }
.fb__card { width: 100%; max-width: 520px; background: #fff; border: 1px solid #e8e8e8; border-radius: 16px; padding: 28px 24px 24px; }
.fb__card--centro { text-align: center; }
.fb__eyebrow { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #636363; }
.fb__titulo { margin: 0 0 16px; font-size: 26px; line-height: 1.2; font-weight: 600; color: #1a1a1a; text-wrap: balance; }
.fb__texto { margin: 0 0 20px; color: #3d3d3d; line-height: 1.55; }
.fb__link { color: #024ad8; font-weight: 600; text-decoration: none; }
.fb__link:hover { text-decoration: underline; }
.fb__botao { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 28px; border: 0; border-radius: 4px; background: #024ad8; color: #fff; font-size: 16px; font-weight: 600; text-decoration: none; cursor: pointer; }
.fb__botao:hover { background: #0e3191; }
.fb__botao:disabled { background: #c2c2c2; cursor: not-allowed; }
.fb__botao--largo { width: 100%; margin-top: 16px; }
.fb__notas { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.fb__nota { min-height: 56px; border: 1px solid #c2c2c2; border-radius: 4px; background: #fff; font-size: 18px; font-weight: 600; color: #1a1a1a; cursor: pointer; }
.fb__nota:hover { border-color: #024ad8; }
.fb__nota:focus-visible, .fb__botao:focus-visible { outline: 2px solid #024ad8; outline-offset: 2px; }
.fb__escala { display: flex; justify-content: space-between; margin: 8px 0 0; font-size: 12px; color: #636363; }
.fb__textarea { width: 100%; padding: 12px; border: 1px solid #c2c2c2; border-radius: 4px; font: inherit; color: #1a1a1a; resize: vertical; box-sizing: border-box; }
.fb__textarea:focus-visible { outline: 2px solid #024ad8; outline-offset: 1px; border-color: #024ad8; }
.fb__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
.fb__erro { margin: 12px 0 0; color: #b3262b; }
</style>
