<template>
  <div>
    <NuxtPage />

    <!-- PWA Install Prompt (appears automatically on supported devices) -->
    <ClientOnly>
      <pwa-install
        manifest-url="/manifest.json"
        name="PlacaCompleta"
        description="Consulta Veicular Grátis - Acesso rápido offline"
        icon="/logo-nobg-200.png"
      />
    </ClientOnly>
  </div>
</template>
