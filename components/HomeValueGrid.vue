<script setup lang="ts">
// Grid de valor abaixo do split (web): O que você recebe / Preço / Por que
// confiar. O CTA de "Preço" emite 'consult' pra home acionar o checkout premium
// com a placa do herói. Sem revelar fonte dos dados.
import { PLANOS, precoBRL } from '~/shared/planos'

defineEmits<{ consult: [] }>()

// Preco sai da fonte unica (shared/planos.ts): escrito a mao, ele defasa na
// primeira mudanca de tabela e ninguem lembra deste componente.
const precoCompleta = precoBRL(PLANOS.completa.valorCentavos)
</script>

<template>
  <div class="hvg">
    <!-- O que você recebe -->
    <section class="win-window hvg__card">
      <div class="win-window__titlebar"><span>O que você recebe</span></div>
      <div class="win-window__body">
        <ul class="hvg__list">
          <li><i class="hvg__ck" aria-hidden="true">✓</i> Situação e restrições (nacional e estadual)</li>
          <li><i class="hvg__ck" aria-hidden="true">✓</i> Roubo/furto e registro de leilão</li>
          <li><i class="hvg__ck" aria-hidden="true">✓</i> Gravame (financiamento/alienação)</li>
          <li><i class="hvg__ck" aria-hidden="true">✓</i> RENAJUD, recall e multa (indicador)</li>
          <li><i class="hvg__ck" aria-hidden="true">✓</i> Ficha cadastral e técnica completa</li>
          <li><i class="hvg__ck" aria-hidden="true">✓</i> Valor FIPE, seguro estimado e custo em 5 anos</li>
        </ul>
      </div>
    </section>

    <!-- Preço -->
    <section class="win-window hvg__card">
      <div class="win-window__titlebar"><span>Preço</span></div>
      <div class="win-window__body hvg__price-body">
        <p class="hvg__price"><span class="hvg__price-val">{{ precoCompleta }}</span> <small>/ consulta</small></p>
        <p class="hvg__price-txt">
          Pagamento único, no Pix ou no cartão. Sem assinatura, sem pegadinha.
          Sem o relatório, o valor volta automático, no Pix ou no cartão.
        </p>
        <button type="button" class="win-btn win-btn--primary win-btn--block" @click="$emit('consult')">
          Consultar agora
        </button>
      </div>
    </section>

    <!-- Por que confiar -->
    <section class="win-window hvg__card">
      <div class="win-window__titlebar"><span>Por que confiar</span></div>
      <div class="win-window__body">
        <ul class="hvg__trust">
          <li><i class="hvg__dot" aria-hidden="true">◆</i> Informação confiável e sempre atualizada.</li>
          <li><i class="hvg__dot" aria-hidden="true">◆</i> Não achou o veículo? Estorno automático, no Pix ou no cartão.</li>
          <li><i class="hvg__dot" aria-hidden="true">◆</i> Pix ou cartão de crédito. No cartão, quem processa é a Stripe: não guardamos os dados do cartão.</li>
          <li><i class="hvg__dot" aria-hidden="true">◆</i> Relatório com link privado, só seu.</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.hvg {
  display: grid;
  grid-template-columns: 1fr;
  gap: $space-md;
  margin-top: $space-md;

  @media (min-width: 860px) {
    grid-template-columns: repeat(3, 1fr);
    align-items: stretch;
  }

  &__card {
    margin: 0;
    max-width: none;
    width: 100%;
    display: flex;
    flex-direction: column;

    .win-window__body { flex: 1; }
  }

  &__list,
  &__trust {
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: flex;
      align-items: flex-start;
      gap: 9px;
      font-size: 0.875rem;
      color: $twilight-indigo;
      margin: 0 0 9px;

      &:last-child { margin-bottom: 0; }
    }
  }

  &__ck {
    color: $success-green;
    font-weight: 800;
    font-style: normal;
    flex-shrink: 0;
    margin-top: 1px;
  }

  &__dot {
    color: $smart-blue;
    font-style: normal;
    font-size: 0.75rem;
    flex-shrink: 0;
    margin-top: 2px;
  }

  &__price-body {
    display: flex;
    flex-direction: column;
    gap: $space-sm;
  }

  &__price {
    margin: 0;
    color: $blue-slate;
    font-size: 0.875rem;
  }

  &__price-val {
    font-family: $font-display;
    font-size: 2.125rem;
    font-weight: 800;
    color: $prussian-blue;
  }

  &__price-txt {
    margin: 0;
    color: $blue-slate;
    font-size: 0.8125rem;
    line-height: 1.5;
  }
}
</style>
