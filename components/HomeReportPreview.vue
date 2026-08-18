<script setup lang="ts">
// "Previa do relatorio" (coluna direita do split web). Ilustrativo/estatico:
// mostra o formato do relatorio completo (resumo do veiculo + badges de status
// + bloco locked borrado). Sem dados reais, sem revelar fonte dos dados.
</script>

<template>
  <div class="hrp">
    <div class="hrp__veh">
      <div class="hrp__ic" aria-hidden="true"><img src="/brand-vw.svg" alt="" class="hrp__brand"></div>
      <div class="hrp__veh-txt">
        <h3>VW Gol 1.0 Flex</h3>
        <p>2018/2018 · Branco · São Paulo/SP</p>
      </div>
      <span class="hrp__plate">ABC1D23</span>
    </div>

    <div class="hrp__badges">
      <div class="hrp__badge hrp__badge--ok"><i class="hrp__s" /> Roubo/Furto <b>NADA CONSTA</b></div>
      <div class="hrp__badge hrp__badge--ok"><i class="hrp__s" /> Leilão <b>NADA CONSTA</b></div>
      <div class="hrp__badge hrp__badge--bad"><i class="hrp__s" /> Gravame <b>ALIENADO</b></div>
      <div class="hrp__badge hrp__badge--bad"><i class="hrp__s" /> RENAJUD <b>CONSTA</b></div>
      <div class="hrp__badge hrp__badge--ok"><i class="hrp__s" /> Recall <b>EM DIA</b></div>
      <div class="hrp__badge hrp__badge--ok"><i class="hrp__s" /> Restrições <b>NADA CONSTA</b></div>
    </div>

    <div class="hrp__locked">
      <div class="hrp__rows" aria-hidden="true">
        <div /><div /><div /><div />
      </div>
      <div class="hrp__lk">
        <span class="hrp__lock" aria-hidden="true">🔒</span>
        <b>Ficha completa, FIPE, seguro e custo 5 anos</b>
        <small>Liberado após o pagamento</small>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.hrp {
  font-family: $font-body;

  &__veh {
    display: flex;
    align-items: center;
    gap: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid $border-mid;
  }

  &__ic {
    width: 46px;
    height: 46px;
    border-radius: 9px;
    background: $powder-blue;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  &__brand {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  &__veh-txt {
    min-width: 0;

    h3 {
      margin: 0;
      font-size: 1rem;
      color: $prussian-blue-3;
    }

    p {
      margin: 1px 0 0;
      color: $blue-slate;
      font-size: 0.8125rem;
    }
  }

  &__plate {
    margin-left: auto;
    background: $prussian-blue;
    color: #fff;
    font-weight: 700;
    border-radius: 5px;
    padding: 4px 9px;
    font-size: 0.8125rem;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  &__badges {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 14px 0;
  }

  &__badge {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid $border-mid;
    border-radius: 8px;
    padding: 9px 11px;
    font-size: 0.8125rem;
    background: $surface-alt;
    color: $twilight-indigo;

    b {
      margin-left: auto;
      font-size: 0.75rem;
      font-weight: 700;
      white-space: nowrap;
    }

    &--ok {
      .hrp__s { background: $success-green; }
      b { color: $success-green; }
    }

    &--bad {
      background: #fdecea;
      border-color: #f3b8b0;

      .hrp__s { background: $error-red; }
      b { color: $error-red; }
    }
  }

  &__s {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  &__locked {
    position: relative;
    margin-top: 6px;
    border: 1px dashed $border-mid;
    border-radius: 9px;
    padding: 16px;
    text-align: center;
    background: repeating-linear-gradient(135deg, #f6f8fc, #f6f8fc 10px, #eef3fa 10px, #eef3fa 20px);
    min-height: 96px;
  }

  &__rows {
    filter: blur(3px);
    opacity: 0.6;
    text-align: left;

    div {
      height: 9px;
      background: $border-mid;
      border-radius: 3px;
      margin: 7px 0;
    }

    div:nth-child(2) { width: 80%; }
    div:nth-child(3) { width: 60%; }
  }

  &__lk {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 12px;

    b {
      font-size: 0.8125rem;
      color: $regal-navy;
    }

    small {
      color: $blue-slate;
      font-size: 0.75rem;
    }
  }

  &__lock {
    font-size: 20px;
  }
}

@media (max-width: 400px) {
  .hrp__badges {
    grid-template-columns: 1fr;
  }
}
</style>
