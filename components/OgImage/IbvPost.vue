<script setup lang="ts">
defineProps<{
  title?: string
  referenceMonth?: string
  highlight?: string
}>()
</script>

<template>
  <div
    class="h-full w-full flex flex-col justify-between"
    :style="{
      background: 'linear-gradient(135deg, #090C9B 0%, #1E2BAF 60%, #2E3CC8 100%)',
      color: '#FFFFFF',
      padding: '64px 80px',
      fontFamily: 'Inter, system-ui, sans-serif',
    }"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div
          class="rounded-lg flex items-center justify-center"
          :style="{
            width: '64px',
            height: '64px',
            background: '#FFFFFF',
            color: '#090C9B',
            fontWeight: 900,
            fontSize: '32px',
            letterSpacing: '-0.02em',
          }"
        >
          PC
        </div>
        <div
          :style="{
            fontSize: '32px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
          }"
        >
          PlacaCompleta
        </div>
      </div>
      <div
        v-if="referenceMonth"
        :style="{
          fontSize: '28px',
          fontWeight: 600,
          opacity: 0.85,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }"
      >
        IBV Auto · {{ referenceMonth }}
      </div>
    </div>

    <div class="flex flex-col gap-6">
      <div
        v-if="highlight"
        :style="{
          fontSize: '120px',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          lineHeight: 1,
          color: '#FFD166',
        }"
      >
        {{ highlight }}
      </div>
      <div
        :style="{
          fontSize: '52px',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
          maxWidth: '1000px',
        }"
      >
        {{ title }}
      </div>
    </div>

    <div
      class="flex items-center justify-between"
      :style="{
        borderTop: '2px solid rgba(255,255,255,0.18)',
        paddingTop: '24px',
      }"
    >
      <div
        :style="{
          fontSize: '24px',
          fontWeight: 500,
          opacity: 0.85,
        }"
      >
        Fonte: Banco BV · Análise PlacaCompleta
      </div>
      <div
        :style="{
          fontSize: '24px',
          fontWeight: 600,
          opacity: 0.95,
        }"
      >
        placacompleta.com.br
      </div>
    </div>
  </div>
</template>
