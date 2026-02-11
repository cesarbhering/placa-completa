export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  modules: ['@nuxtjs/sitemap'],

  site: {
    url: 'https://placacompleta.com.br',
  },

  sitemap: {
    urls: [
      '/',
      '/consulta-placa',
      '/como-consultar-placa',
      '/tabela-fipe-por-placa',
    ],
  },

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
      title: 'Placa Completa - Consulta Veicular Grátis por Placa',
      meta: [
        { name: 'description', content: 'Consulte informações completas de qualquer veículo pela placa. Dados como marca, modelo, ano, cor, FIPE, município e situação enviados direto no seu e-mail. Rápido, grátis e seguro.' },
        { name: 'keywords', content: 'consulta placa, consulta veicular, consultar placa grátis, dados veículo por placa, tabela FIPE por placa, consulta placa grátis, informações veículo, placa completa' },
        { property: 'og:title', content: 'Placa Completa - Consulta Veicular Grátis' },
        { property: 'og:description', content: 'Consulte qualquer placa e receba os dados completos do veículo no seu e-mail. Grátis e instantâneo.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:image', content: '/logo-nobg.png' },
        { property: 'og:locale', content: 'pt_BR' },
        { name: 'robots', content: 'index, follow' },
        { name: 'theme-color', content: '#090c9bff' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', sizes: '48x48', href: '/favicon-48.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'preload', as: 'style', href: 'https://fonts.googleapis.com/css2?family=VT323&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap', onload: "this.onload=null;this.rel='stylesheet'" },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=VT323&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap' },
      ],
      script: [
        {
          async: true,
          src: 'https://www.googletagmanager.com/gtag/js?id=G-24H7QSPX4G',
        },
        {
          innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-24H7QSPX4G');`,
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Placa Completa',
            description: 'Consulta veicular gratuita por placa. Receba dados completos do veículo no seu e-mail.',
            url: 'https://placacompleta.com.br',
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Web',
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'BRL',
            },
          }),
        },
      ],
    },
  },

  css: ['~/assets/scss/main.scss'],

  devServer: {
    host: '0.0.0.0',
  },

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "~/assets/scss/variables" as *;`,
          api: 'modern-compiler',
        },
      },
    },
  },

  runtimeConfig: {
    supabaseUrl: process.env.SUPABASE_URL || 'https://fivalpkfneadngxiflea.supabase.co',
    supabaseKey: process.env.SUPABASE_SERVICE_KEY || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    placaApiToken: process.env.PLACA_API_TOKEN || '',
    public: {
      supabaseUrl: process.env.SUPABASE_URL || 'https://fivalpkfneadngxiflea.supabase.co',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    },
  },

  routeRules: {
    '/': { prerender: true },
    '/consulta-placa': { prerender: true },
    '/como-consultar-placa': { prerender: true },
    '/tabela-fipe-por-placa': { prerender: true },
    '/termos-de-uso': { prerender: true },
    '/politica-de-privacidade': { prerender: true },
  },

  nitro: {
    preset: 'netlify',
  },
})
