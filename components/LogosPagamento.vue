<script setup lang="ts">
// Logos das formas de pagamento (pedido do Cesar, 06/out: opcoes 1 e 3).
// Pix: logo oficial do Banco Central (dominio publico), arquivo em
// public/images/pagamento/pix.svg, proporcao preservada. Visa: wordmark
// oficial no azul Visa (path do Simple Icons, CC0). Mastercard: o simbolo de
// dois circulos nas cores oficiais (vermelho, amarelo e a intersecao laranja).
// Cada logo vai num selo
// branco, entao as cores ficam legiveis no modo escuro sem trocar a marca.
// Bandeiras: so Visa e Mastercard. A conta Stripe recusa Amex no teste
// ("Please use a Visa or MasterCard card") e Elo nao foi confirmada.
withDefaults(defineProps<{ cartao?: boolean }>(), { cartao: true })
</script>

<template>
  <span class="lp" role="list" aria-label="Formas de pagamento">
    <span class="lp__selo" role="listitem">
      <img src="/images/pagamento/pix.svg" alt="Pix" class="lp__pix" width="45" height="16">
    </span>
    <template v-if="cartao">
      <span class="lp__selo" role="listitem" aria-label="Visa">
        <svg viewBox="0 0 24 24" class="lp__visa" aria-hidden="true"><path fill="#1434CB" d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z" /></svg>
      </span>
      <span class="lp__selo" role="listitem" aria-label="Mastercard">
        <svg viewBox="0 0 32 20" class="lp__mc" aria-hidden="true">
          <defs><clipPath id="lp-mc-esq"><circle cx="11" cy="10" r="8" /></clipPath></defs>
          <circle cx="11" cy="10" r="8" fill="#EB001B" />
          <circle cx="21" cy="10" r="8" fill="#F79E1B" />
          <circle cx="21" cy="10" r="8" fill="#FF5F00" clip-path="url(#lp-mc-esq)" />
        </svg>
      </span>
    </template>
  </span>
</template>

<style scoped lang="scss">
.lp {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.lp__selo {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 24px;
  padding: 0 7px;
  background: #fff;
  border: 1px solid #dfe3ea;
  border-radius: 4px;

  svg { height: 14px; width: auto; display: block; }
  .lp__visa { height: 22px; }
  .lp__mc { height: 16px; }
}
.lp__pix { height: 16px; width: auto; display: block; }
</style>
