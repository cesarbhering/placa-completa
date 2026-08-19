<script setup lang="ts">
// Logo da montadora ao lado do nome do veiculo no relatorio. Os paths vem da
// simple-icons (monocromaticos, viewBox 24x24); marca sem icone na lib cai num
// monograma com a inicial — caso da Mercedes e da Land Rover, que a lib nao
// distribui por licenca. So o relatorio importa este componente, entao os
// paths entram apenas no chunk dele.
import {
  siVolkswagen, siChevrolet, siFiat, siFord, siHonda, siToyota, siHyundai,
  siRenault, siNissan, siPeugeot, siCitroen, siJeep, siMitsubishi, siBmw,
  siAudi, siKia, siVolvo, siSuzuki, siYamahamotorcorporation, siPorsche,
  siSubaru, siFerrari, siMini, siRam, siScania, siIveco, siDucati,
} from 'simple-icons'

const props = defineProps<{ marca?: string | null }>()

// A consulta entrega "MARCA/MODELO" ("GM/PRISMA JOY"; importado vem com
// prefixo, "I/FORD FOCUS"). O token da marca e o que sobra antes da barra.
const ICONES: Record<string, { path: string }> = {
  VW: siVolkswagen, VOLKSWAGEN: siVolkswagen,
  GM: siChevrolet, CHEVROLET: siChevrolet, CHEV: siChevrolet,
  FIAT: siFiat, FORD: siFord, HONDA: siHonda, TOYOTA: siToyota,
  HYUNDAI: siHyundai, RENAULT: siRenault, NISSAN: siNissan,
  PEUGEOT: siPeugeot, CITROEN: siCitroen, JEEP: siJeep,
  MMC: siMitsubishi, MITSUBISHI: siMitsubishi,
  BMW: siBmw, AUDI: siAudi, KIA: siKia, VOLVO: siVolvo,
  SUZUKI: siSuzuki, YAMAHA: siYamahamotorcorporation,
  PORSCHE: siPorsche, SUBARU: siSubaru, FERRARI: siFerrari,
  MINI: siMini, RAM: siRam, SCANIA: siScania, IVECO: siIveco,
  DUCATI: siDucati,
}

const tokenMarca = computed(() => {
  const bruto = String(props.marca || '').toUpperCase().trim()
  if (!bruto) return ''
  const semImportado = bruto.replace(/^I\//, '')
  return (semImportado.split('/')[0] || '').trim().split(/\s+/)[0] || ''
})

const icone = computed(() => ICONES[tokenMarca.value] || null)
const inicial = computed(() => tokenMarca.value.charAt(0) || '?')
</script>

<template>
  <!-- Decorativo: o nome da marca ja esta escrito ao lado. -->
  <span v-if="tokenMarca" class="ml" aria-hidden="true">
    <svg v-if="icone" viewBox="0 0 24 24" class="ml__svg">
      <path :d="icone.path" />
    </svg>
    <span v-else class="ml__mono">{{ inicial }}</span>
  </span>
</template>

<style lang="scss" scoped>
// Paleta local, mesma convencao dos outros componentes v2.
$c-ink: #1a1a1a;
$c-graphite: #636363;

// Sem moldura: dentro de uma caixinha o simbolo encolhia pra ~26px e sumia.
// Solto, ele ocupa a altura inteira da linha do veiculo.
.ml {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  flex-shrink: 0;
}

.ml__svg {
  width: 100%;
  height: 100%;
  // Tinta, nao a cor da marca: logos coloridos disputariam com o acento da
  // pagina, e o guia so admite um.
  fill: $c-ink;
  display: block;
}

.ml__mono {
  font-size: 32px;
  font-weight: 700;
  color: $c-graphite;
  line-height: 1;
}
</style>
