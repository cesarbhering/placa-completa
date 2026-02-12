<template>
  <div>
    <NuxtPage />

    <!-- PWA Install Prompt (appears automatically on supported devices) -->
    <ClientOnly>
      <pwa-install
        name="PlacaCompleta"
        icon="/logo-nobg-200.png"
      />
    </ClientOnly>
  </div>
</template>
