<script setup lang="ts">
// Pesquisa de satisfacao pos-compra. Superficie privada: o token da URL e a
// credencial, entao nao indexa e nao existe versao publica desta pagina.
//
// Uma pergunta obrigatoria (a nota) e uma opcional (o texto). Quem so quer dar
// 5 estrelas termina em um toque; quem tem algo a dizer tem onde dizer. O
// mobile manda no layout: quase todo mundo abre isso do celular, no e-mail.
const route = useRoute()
const token = String(route.params.token || '')

useHead({ title: 'Sua opinião', meta: [{ name: 'robots', content: 'noindex,nofollow' }] })

const { data, error } = await useFetch<any>(`/api/feedback/${encodeURIComponent(token)}`)

const nota = ref<number | null>(null)
const comentario = ref('')
const enviando = ref(false)
const erroEnvio = ref('')
// Tres desfechos: acabou de responder, ja tinha respondido antes, ou ainda esta
// no formulario.
const enviado = ref(false)
const jaRespondido = ref(false)

onMounted(() => {
  if (data.value?.respondido) jaRespondido.value = true
})

const ROTULOS: Record<number, string> = {
  1: 'Muito ruim',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Muito bom',
}

async function enviar() {
  if (!nota.value || enviando.value) return
  erroEnvio.value = ''
  enviando.value = true
  try {
    const r: any = await $fetch('/api/feedback/responder', {
      method: 'POST',
      body: { token, nota: nota.value, comentario: comentario.value },
    })
    if (r?.jaRespondido) jaRespondido.value = true
    else enviado.value = true
  } catch (e: any) {
    erroEnvio.value = e?.data?.message === 'Link nao encontrado'
      ? 'Este link não vale mais.'
      : 'Não conseguimos enviar agora. Tente de novo em instantes.'
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main class="fb">
    <!-- Link invalido: sem drama e sem beco sem saida. A pessoa erra o link, ou
         ele foi truncado pelo cliente de e-mail; ela precisa de uma saida. -->
    <section v-if="error" class="fb__card fb__card--centro">
      <h1 class="fb__titulo">Este link não vale mais</h1>
      <p class="fb__texto">
        Ele pode ter sido copiado pela metade. Abra de novo pelo e-mail que você recebeu.
      </p>
      <NuxtLink to="/" class="fb__link">Voltar para a PlacaCompleta</NuxtLink>
    </section>

    <section v-else-if="jaRespondido" class="fb__card fb__card--centro">
      <h1 class="fb__titulo">Já recebemos</h1>
      <p class="fb__texto">Sua resposta está com a gente. Obrigado pelo tempo.</p>
      <NuxtLink to="/" class="fb__link">Voltar para a PlacaCompleta</NuxtLink>
    </section>

    <section v-else-if="enviado" class="fb__card fb__card--centro">
      <h1 class="fb__titulo">Obrigado</h1>
      <p class="fb__texto">
        Sua resposta ajuda a melhorar o relatório para quem vem depois.
      </p>
      <p class="fb__cupom">Seu cupom de 50% chega por e-mail em instantes.</p>
      <NuxtLink to="/" class="fb__link">Voltar para a PlacaCompleta</NuxtLink>
    </section>

    <section v-else class="fb__card">
      <p v-if="data?.placa" class="fb__eyebrow">Consulta {{ data.placa }}</p>
      <h1 class="fb__titulo">O que você achou do relatório?</h1>

      <div class="fb__notas" role="radiogroup" aria-label="Nota de 1 a 5">
        <button
          v-for="n in 5"
          :key="n"
          type="button"
          role="radio"
          :aria-checked="nota === n"
          :aria-label="`${n} de 5, ${ROTULOS[n]}`"
          class="fb__nota"
          :class="{ 'fb__nota--ativa': nota === n }"
          @click="nota = n"
        >
          {{ n }}
        </button>
      </div>
      <p class="fb__escala">
        <span>Muito ruim</span>
        <span>Muito bom</span>
      </p>
      <p v-if="nota" class="fb__rotulo">{{ ROTULOS[nota] }}</p>

      <label class="fb__label" for="fb-comentario">O que podemos melhorar?</label>
      <textarea
        id="fb-comentario"
        v-model="comentario"
        class="fb__textarea"
        rows="4"
        maxlength="2000"
        placeholder="Opcional"
      />

      <button type="button" class="fb__enviar" :disabled="!nota || enviando" @click="enviar">
        {{ enviando ? 'Enviando...' : 'Enviar' }}
      </button>
      <p v-if="erroEnvio" class="fb__erro">{{ erroEnvio }}</p>
    </section>
  </main>
</template>

<style scoped>
/* Linguagem da home: canvas branco, tinta near-black, um unico acento azul,
   hairline no lugar de sombra. */
.fb {
  /* Encostado no topo, nao centralizado na viewport: a pagina ja vive dentro
     do layout com cabecalho e rodape, e centralizar empurrava o card pro meio
     de uma tela quase vazia, com rolagem antes de ver a pergunta. */
  background: #f7f7f7;
  display: flex;
  justify-content: center;
  padding: 24px 16px 56px;
}
.fb__card {
  width: 100%;
  max-width: 520px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 16px;
  padding: 28px 24px 24px;
}
.fb__card--centro { text-align: center; }
.fb__eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #636363;
}
.fb__titulo {
  margin: 0 0 20px;
  font-size: 26px;
  line-height: 1.2;
  font-weight: 600;
  color: #1a1a1a;
  text-wrap: balance;
}
.fb__texto { margin: 0 0 20px; color: #3d3d3d; line-height: 1.55; }
.fb__cupom {
  margin: 0 0 20px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #c9e0fc;
  color: #0e3191;
  font-weight: 600;
}
.fb__link { color: #024ad8; font-weight: 600; text-decoration: none; }
.fb__link:hover { text-decoration: underline; }

/* Botoes grandes e lado a lado: no celular a mao precisa acertar de primeira. */
.fb__notas { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.fb__nota {
  min-height: 56px;
  border: 1px solid #c2c2c2;
  border-radius: 4px;
  background: #fff;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.fb__nota:hover { border-color: #024ad8; }
.fb__nota--ativa { background: #024ad8; border-color: #024ad8; color: #fff; }
.fb__nota:focus-visible { outline: 2px solid #024ad8; outline-offset: 2px; }
.fb__escala {
  display: flex;
  justify-content: space-between;
  margin: 8px 0 0;
  font-size: 12px;
  color: #636363;
}
.fb__rotulo { margin: 10px 0 0; font-weight: 600; color: #1a1a1a; }

.fb__label { display: block; margin: 24px 0 8px; font-weight: 600; color: #1a1a1a; }
.fb__textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #c2c2c2;
  border-radius: 4px;
  font: inherit;
  color: #1a1a1a;
  resize: vertical;
}
.fb__textarea:focus-visible { outline: 2px solid #024ad8; outline-offset: 1px; border-color: #024ad8; }

.fb__enviar {
  width: 100%;
  margin-top: 20px;
  min-height: 52px;
  border: 0;
  border-radius: 4px;
  background: #024ad8;
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}
.fb__enviar:disabled { background: #c2c2c2; cursor: not-allowed; }
.fb__enviar:not(:disabled):hover { background: #0e3191; }
.fb__erro { margin: 12px 0 0; color: #b3262b; }

@media (prefers-reduced-motion: reduce) {
  .fb__nota { transition: none; }
}
</style>
