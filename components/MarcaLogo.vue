<script setup lang="ts">
// Logo da montadora ao lado do nome do veiculo no relatorio. Os paths vem da
// simple-icons (monocromaticos, viewBox 24x24); marca sem icone na lib cai num
// monograma com a inicial — caso da Mercedes e da Land Rover, que a lib nao
// distribui por licenca. So o relatorio importa este componente, entao os
// paths entram apenas no chunk dele.
import { computed, ref, watch, onMounted } from 'vue'
import { logoProxyDaMarca } from '~/shared/logo-marca-arquivo'
import {
  siVolkswagen, siChevrolet, siFiat, siFord, siHonda, siToyota, siHyundai,
  siRenault, siNissan, siPeugeot, siCitroen, siJeep, siMitsubishi, siBmw,
  siAudi, siKia, siVolvo, siSuzuki, siYamahamotorcorporation, siPorsche,
  siSubaru, siFerrari, siMini, siRam, siScania, siIveco, siDucati,
} from 'simple-icons'

const props = defineProps<{ marca?: string | null; logoUrl?: string | null }>()

// Marcas que a simple-icons nao tem, com path da NOSSA base (mesmo padrao:
// path monocromatico, tinta). viewBox proprio: wordmark e largo.
// JAC: logo oficial mandado pelo Cesar (01/out), 4 paths unidos num so.
const NOSSOS: Record<string, { path: string; viewBox: string }> = {
  JAC: { viewBox: '0 0 118 25', path: 'M117.9,23.2c0.3,0.5-0.1,1-0.6,1l-13.1,0l-8,0c-1.5,0-3-0.7-4-1.9l-0.6-0.8l-7.5-9.3L82,9.5l-5.4-6.7h0 c-0.9-1.1-0.1-2.7,1.3-2.7l6.9,0l20.1,0.1c0.2,0,0.5,0.1,0.6,0.3l0.8,1.4c0.2,0.4-0.1,1-0.6,1l-17.7,0c-0.4,0-0.6,0.4-0.3,0.7 l4.8,6h0l2.1,2.6l4.9,6.1c1.6,2,4.1,3.2,6.7,3.2l9.8,0c0.7,0,1.3,0.4,1.7,1L117.9,23.2z M83.6,24.1l-6.9,0c-0.4,0-0.8-0.2-1.1-0.5l-16.1-20c-0.4-0.5-1-0.8-1.6-0.8l-10.6,0 c-1.2,0-1.8-1.3-1-2.2C46.5,0.2,46.9,0,47.3,0l19.2,0.1c0.4,0,0.8,0.2,1.1,0.5l17.2,21.3C85.4,22.8,84.8,24.1,83.6,24.1z M57.9,12.1l-8.9,0c-0.4,0-0.8,0.2-1,0.5l-7.3,8.8l-1.8,2.2c-0.3,0.3-0.6,0.5-1,0.5l-4.5,0 c-1.1,0-1.7-1.3-1-2.1l0.4-0.5l7.7-9.3l1.8-2.1c0.3-0.3,0.6-0.5,1-0.5l7.3,0l7.4,0c0.5,0,0.9,0.3,1.1,0.7 C59.5,11,58.9,12.1,57.9,12.1z M39,0c1.4,0,2.2,1.6,1.3,2.7l-5.5,6.7L32.6,12l-7.7,9.3l-0.2,0.2c-1.3,1.5-3.2,2.4-5.1,2.4l-6.7,0l-12,0 c-0.5,0-0.8-0.4-0.8-0.8c0-1,0.8-1.8,1.8-1.8l8.9,0c2.7,0,5.3-1.2,7.1-3.3l4.9-5.9l2.2-2.6l5.5-6.7l0.9-1.1c0.8-1,2.1-1.6,3.4-1.6 L39,0z' },
}


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

// Importado vem com prefixo, e ele varia: "I/FORD FOCUS", "IMP/HONDA CIVIC".
// Sem tirar o prefixo, a marca lida era "IMP" e um Civic saia com monograma
// "I" no lugar do simbolo da Honda.
const PREFIXOS_IMPORTADO = /^(?:IMP|IMPORT|I)\s*\//
const tokenMarca = computed(() => {
  const bruto = String(props.marca || '').toUpperCase().trim()
  if (!bruto) return ''
  const semImportado = bruto.replace(PREFIXOS_IMPORTADO, '').trim()
  const token = (semImportado.split('/')[0] || '').trim().split(/\s+/)[0] || ''
  // "IMP" sozinho (a wdapi devolve isso no campo marca de importado) nao e
  // marca nenhuma: sem simbolo e sem monograma, melhor que um "I" errado.
  if (token === 'IMP' || token === 'I' || token === 'IMPORT') return ''
  return token
})

const icone = computed<{ path: string; viewBox: string } | null>(() => {
  const nosso = NOSSOS[tokenMarca.value]
  if (nosso) return nosso
  const si = ICONES[tokenMarca.value]
  return si ? { path: si.path, viewBox: '0 0 24 24' } : null
})
const largo = computed(() => !!icone.value && icone.value.viewBox !== '0 0 24 24')
// Fallback: logo da apiplacas pelo NOSSO proxy (/api/logo-marca/...), so
// quando nao ha path. Falhou o carregamento: some, e entra o monograma.
// So depois de montar: no SSR o @error do <img> pode disparar antes da
// hidratacao e a imagem quebrada ficaria na tela.
const montado = ref(false)
onMounted(() => { montado.value = true })
// Ordem: o logo que a fonte mandou; sem ele (ou se falhar), o arquivo deduzido
// do nome da marca (BYD -> byd.png). Cada falha passa pro proximo; acabou a
// lista, monograma.
const tentativa = ref(0)
const fontes = computed(() => {
  const lista: string[] = []
  const u = String(props.logoUrl || '')
  if (u.startsWith('/api/logo-marca/')) lista.push(u)
  const deduzido = logoProxyDaMarca(tokenMarca.value)
  if (deduzido && !lista.includes(deduzido)) lista.push(deduzido)
  return lista
})
watch(() => [props.logoUrl, props.marca], () => { tentativa.value = 0 })
const imagem = computed(() => {
  if (!montado.value || icone.value) return null
  return fontes.value[tentativa.value] ?? null
})
function falhou() { tentativa.value++ }
const inicial = computed(() => tokenMarca.value.charAt(0) || '?')
</script>

<template>
  <!-- Decorativo: o nome da marca ja esta escrito ao lado. -->
  <span v-if="tokenMarca" class="ml" :class="{ 'ml--larga': largo }" aria-hidden="true">
    <svg v-if="icone" :viewBox="icone.viewBox" class="ml__svg">
      <path :d="icone.path" />
    </svg>
    <img v-else-if="imagem" :src="imagem" alt="" class="ml__img" @error="falhou">
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

.ml--larga { width: 96px; }

.ml--larga .ml__svg { height: auto; }

// PNG colorido da apiplacas: vira tinta pra nao destoar dos paths.
.ml__img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  filter: grayscale(1) brightness(0.35) contrast(1.4);
}

.ml__mono {
  font-size: 32px;
  font-weight: 700;
  color: $c-graphite;
  line-height: 1;
}
</style>
