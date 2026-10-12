<script setup lang="ts">
import { marcaExibicao } from '~/shared/marca-exibicao'
const props = defineProps<{
  show: boolean
  vehicleData: any
}>()

useWhatsappOculto(() => props.show)

const emit = defineEmits<{
  close: []
  newConsulta: []
}>()

const showSnackbar = ref(false)
const snackbarMessage = ref('')

const allVehicleData = computed(() => {
  if (!props.vehicleData) return null
  const data = props.vehicleData
  const extra = data.extra || {}
  // Find FIPE entry with highest score (best match)
  const fipeData = data.fipe?.dados?.reduce((max: any, item: any) =>
    (item.score > (max?.score || 0)) ? item : max
  , null)

  return {
    Placa: data.placa || '-',
    Marca: marcaExibicao(data) || '-',
    Modelo: data.MODELO || data.modelo || '-',
    'Ano/Modelo': `${data.ano || '-'}/${data.anoModelo || '-'}`,
    Chassi: data.chassi || '-',
    Cor: data.cor || '-',
    Combustível: extra.combustivel || '-',
    Tipo: extra.tipo_veiculo || '-',
    Espécie: extra.especie || '-',
    Passageiros: extra.quantidade_passageiro || '-',
    Município: `${data.municipio || '-'} - ${data.uf || '-'}`,
    Origem: data.origem || '-',
    Situação: data.situacao || '-',
    'Valor FIPE': fipeData?.texto_valor || '-',
    'Modelo FIPE': fipeData?.texto_modelo || '-',
    'Ref. FIPE': fipeData?.mes_referencia || '-',
  }
})

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(() => {
    snackbarMessage.value = `${label} copiado!`
    showSnackbar.value = true
    setTimeout(() => {
      showSnackbar.value = false
    }, 2000)
  })
}

function handleClose() {
  emit('close')
}

function handleNewConsulta() {
  emit('newConsulta')
}
</script>

<template>
  <div v-if="show" class="modal-overlay" @click="handleClose">
    <div class="win-window modal-window" @click.stop>
      <div class="win-window__titlebar">
        <span>📋 Dados do Veículo</span>
        <div class="win-window__titlebar-buttons">
          <button class="win-window__titlebar-btn" @click="handleClose">×</button>
        </div>
      </div>
      <div class="win-window__body modal-body">
        <div v-if="allVehicleData" class="vehicle-data">
          <div
            v-for="(value, key) in allVehicleData"
            :key="key"
            class="data-row"
          >
            <span class="data-label">{{ key }}:</span>
            <span class="data-value">
              {{ value }}
              <button
                v-if="value !== '-'"
                class="copy-btn"
                @click="copyToClipboard(value.toString(), key.toString())"
                title="Copiar"
              >
                📋
              </button>
            </span>
          </div>
        </div>

        <button class="win-btn win-btn--primary win-btn--block" @click="handleNewConsulta">
          Nova Consulta
        </button>
      </div>
    </div>

    <Transition name="snackbar">
      <div v-if="showSnackbar" class="snackbar">
        {{ snackbarMessage }}
      </div>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: $space-md;
}

.modal-window {
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
}

.modal-body {
  max-height: calc(90vh - 60px);
  overflow-y: auto;
}

.vehicle-data {
  margin-bottom: $space-lg;
}

.data-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $space-xs 0;
  border-bottom: 1px solid $powder-blue;

  &:last-child {
    border-bottom: none;
  }
}

.data-label {
  font-family: $font-display;
  font-size: 0.875rem;
  color: $graphite;
  font-weight: 600;
}

.data-value {
  font-family: $font-body;
  font-size: 0.875rem;
  color: $navy-electric;
  display: flex;
  align-items: center;
  gap: $space-xs;
}

.copy-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 2px;
  opacity: 0.6;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
}

.snackbar {
  position: fixed;
  bottom: $space-lg;
  left: 50%;
  transform: translateX(-50%);
  background: $navy-electric;
  color: white;
  padding: $space-sm $space-md;
  border-radius: 4px;
  font-family: $font-body;
  font-size: 0.875rem;
  z-index: 1001;
  @include win-border;
}

.snackbar-enter-active,
.snackbar-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.snackbar-enter-from,
.snackbar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
