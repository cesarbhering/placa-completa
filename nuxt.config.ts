export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",

  modules: ["@nuxtjs/seo", "@nuxtjs/sitemap", "@nuxt/image", "@vite-pwa/nuxt"],

  // GEO: explicit allow for AI crawlers + standard SEO bots.
  // @nuxtjs/robots generates /robots.txt from this config.
  robots: {
    sitemap: 'https://placacompleta.com.br/sitemap.xml',
    // disallow /api/ em CADA grupo: bot casa com o grupo mais especifico e
    // ignora o '*' (os crawlers de IA martelavam /api/csp-report, que e
    // anunciado no header CSP de toda pagina - crawl budget desperdicado)
    groups: [
      {
        userAgent: ['*'],
        allow: ['/', '/llms', '/llms.txt', '/llms/json'],
        disallow: ['/api/'],
        // GEO: presenca ativa em respostas de agentes/IA (casa com /llms).
        // https://contentsignals.org
        contentSignal: { search: 'yes', 'ai-input': 'yes', 'ai-train': 'yes' },
      },
      { userAgent: ['GPTBot'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['ChatGPT-User'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['OAI-SearchBot'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['ClaudeBot'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['anthropic-ai'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['Claude-Web'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['PerplexityBot'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['Perplexity-User'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['Google-Extended'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['CCBot'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['Applebot-Extended'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['Meta-ExternalAgent'], allow: '/', disallow: ['/api/'] },
      { userAgent: ['Bytespider'], allow: '/', disallow: ['/api/'] },
    ],
  },

  image: {
    format: ["webp", "png"],
    quality: 85,
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    filename: 'sw.js',
    manifestFilename: 'manifest.json',
    manifest: {
      name: 'PlacaCompleta',
      short_name: 'PlacaCompleta',
      lang: 'pt-BR',
      display: 'standalone',
      orientation: 'portrait-primary',
      theme_color: '#001233',
      background_color: '#ffffff',
      icons: [
        {
          src: 'pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: 'pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: 'maskable-icon.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable',
        },
      ],
    },
    workbox: {
      // No navigateFallback: site is SSR, so '/' is not precached. Workbox
      // would otherwise throw "non-precached-url" on every navigation.
      navigateFallback: null,
    },
    devOptions: {
      enabled: process.env.NODE_ENV === 'development',
      type: 'module',
    },
  },

  site: {
    url: "https://placacompleta.com.br",
    name: "PlacaCompleta",
    description:
      "Consulta veicular gratuita por placa. Receba dados completos do veículo no seu e-mail.",
    defaultLocale: "pt-BR",
  },

  sitemap: {
    urls: [
      "/",
      "/sobre",
      "/consulta-placa",
      "/consulta-gratis",
      "/como-consultar-placa",
      "/tabela-fipe-por-placa",
      "/carro-de-leilao",
      // pSEO: modelo de leilao (uma pagina por modelo, ver shared/leilao-modelos.ts)
      "/carro-de-leilao/gol",
      "/carro-de-leilao/uno",
      "/carro-de-leilao/palio",
      "/carro-de-leilao/corsa",
      "/carro-de-leilao/celta",
      "/carro-de-leilao/voyage",
      "/carro-de-leilao/strada",
      "/carro-de-leilao/vectra",
      "/carro-de-leilao/saveiro",
      "/carro-de-leilao/onix",
      "/carro-de-leilao/fox",
      "/carro-de-leilao/astra",
      "/carro-de-leilao/sandero",
      "/carro-de-leilao/s10",
      "/carro-de-leilao/corolla",
      "/carro-de-leilao/hb20",
      "/carro-de-leilao/compass",
      "/carro-de-leilao/t-cross",
      "/carro-de-leilao/sw4",
      // pSEO: vehicle types
      "/consultar-placa-de-carro",
      "/consultar-placa-de-moto",
      "/consultar-placa-de-caminhao",
      "/consultar-placa-de-onibus",
      "/consultar-placa-de-van",
      // pSEO: states
      "/consultar-placa",
      "/consultar-placa/acre",
      "/consultar-placa/alagoas",
      "/consultar-placa/amapa",
      "/consultar-placa/amazonas",
      "/consultar-placa/bahia",
      "/consultar-placa/ceara",
      "/consultar-placa/distrito-federal",
      "/consultar-placa/espirito-santo",
      "/consultar-placa/goias",
      "/consultar-placa/maranhao",
      "/consultar-placa/mato-grosso",
      "/consultar-placa/mato-grosso-do-sul",
      "/consultar-placa/minas-gerais",
      "/consultar-placa/para",
      "/consultar-placa/paraiba",
      "/consultar-placa/parana",
      "/consultar-placa/pernambuco",
      "/consultar-placa/piaui",
      "/consultar-placa/rio-de-janeiro",
      "/consultar-placa/rio-grande-do-norte",
      "/consultar-placa/rio-grande-do-sul",
      "/consultar-placa/rondonia",
      "/consultar-placa/roraima",
      "/consultar-placa/santa-catarina",
      "/consultar-placa/sao-paulo",
      "/consultar-placa/sergipe",
      "/consultar-placa/tocantins",
      // pSEO: capital cities
      "/consultar-placa/capital/sao-paulo",
      "/consultar-placa/capital/rio-de-janeiro",
      "/consultar-placa/capital/brasilia",
      "/consultar-placa/capital/fortaleza",
      "/consultar-placa/capital/salvador",
      "/consultar-placa/capital/belo-horizonte",
      "/consultar-placa/capital/manaus",
      "/consultar-placa/capital/curitiba",
      "/consultar-placa/capital/recife",
      "/consultar-placa/capital/porto-alegre",
      "/consultar-placa/capital/goiania",
      "/consultar-placa/capital/belem",
      "/consultar-placa/capital/sao-luis",
      "/consultar-placa/capital/maceio",
      "/consultar-placa/capital/natal",
      "/consultar-placa/capital/campo-grande",
      "/consultar-placa/capital/teresina",
      "/consultar-placa/capital/joao-pessoa",
      "/consultar-placa/capital/florianopolis",
      "/consultar-placa/capital/aracaju",
      "/consultar-placa/capital/cuiaba",
      "/consultar-placa/capital/porto-velho",
      "/consultar-placa/capital/macapa",
      "/consultar-placa/capital/rio-branco",
      "/consultar-placa/capital/boa-vista",
      "/consultar-placa/capital/palmas",
      "/consultar-placa/capital/vitoria",
      // pSEO: FIPE brands and models
      "/tabela-fipe",
      "/tabela-fipe/volkswagen",
      "/tabela-fipe/volkswagen-gol",
      "/tabela-fipe/volkswagen-polo",
      "/tabela-fipe/volkswagen-saveiro",
      "/tabela-fipe/volkswagen-t-cross",
      "/tabela-fipe/volkswagen-virtus",
      "/tabela-fipe/volkswagen-nivus",
      "/tabela-fipe/volkswagen-amarok",
      "/tabela-fipe/volkswagen-taos",
      "/tabela-fipe/volkswagen-voyage",
      "/tabela-fipe/volkswagen-fox",
      "/tabela-fipe/volkswagen-up",
      "/tabela-fipe/volkswagen-jetta",
      "/tabela-fipe/volkswagen-golf",
      "/tabela-fipe/volkswagen-fusca",
      "/tabela-fipe/fiat",
      "/tabela-fipe/fiat-argo",
      "/tabela-fipe/fiat-mobi",
      "/tabela-fipe/fiat-strada",
      "/tabela-fipe/fiat-toro",
      "/tabela-fipe/fiat-pulse",
      "/tabela-fipe/fiat-fastback",
      "/tabela-fipe/fiat-cronos",
      "/tabela-fipe/fiat-uno",
      "/tabela-fipe/fiat-palio",
      "/tabela-fipe/fiat-siena",
      "/tabela-fipe/fiat-fiorino",
      "/tabela-fipe/fiat-ducato",
      "/tabela-fipe/fiat-doblo",
      "/tabela-fipe/fiat-500",
      "/tabela-fipe/chevrolet",
      "/tabela-fipe/chevrolet-onix",
      "/tabela-fipe/chevrolet-onix-plus",
      "/tabela-fipe/chevrolet-tracker",
      "/tabela-fipe/chevrolet-s10",
      "/tabela-fipe/chevrolet-spin",
      "/tabela-fipe/chevrolet-montana",
      "/tabela-fipe/chevrolet-equinox",
      "/tabela-fipe/chevrolet-cruze",
      "/tabela-fipe/chevrolet-prisma",
      "/tabela-fipe/chevrolet-cobalt",
      "/tabela-fipe/chevrolet-celta",
      "/tabela-fipe/chevrolet-corsa",
      "/tabela-fipe/chevrolet-trailblazer",
      "/tabela-fipe/hyundai",
      "/tabela-fipe/hyundai-hb20",
      "/tabela-fipe/hyundai-hb20s",
      "/tabela-fipe/hyundai-creta",
      "/tabela-fipe/hyundai-tucson",
      "/tabela-fipe/hyundai-ix35",
      "/tabela-fipe/hyundai-santa-fe",
      "/tabela-fipe/hyundai-hb20x",
      "/tabela-fipe/hyundai-azera",
      "/tabela-fipe/hyundai-i30",
      "/tabela-fipe/hyundai-veloster",
      "/tabela-fipe/toyota",
      "/tabela-fipe/toyota-corolla",
      "/tabela-fipe/toyota-corolla-cross",
      "/tabela-fipe/toyota-hilux",
      "/tabela-fipe/toyota-hilux-sw4",
      "/tabela-fipe/toyota-yaris",
      "/tabela-fipe/toyota-rav4",
      "/tabela-fipe/toyota-etios",
      "/tabela-fipe/toyota-camry",
      "/tabela-fipe/toyota-prius",
      "/tabela-fipe/toyota-bandeirante",
      "/tabela-fipe/honda",
      "/tabela-fipe/honda-civic",
      "/tabela-fipe/honda-hr-v",
      "/tabela-fipe/honda-city",
      "/tabela-fipe/honda-fit",
      "/tabela-fipe/honda-wr-v",
      "/tabela-fipe/honda-cr-v",
      "/tabela-fipe/honda-accord",
      "/tabela-fipe/honda-zr-v",
      "/tabela-fipe/renault",
      "/tabela-fipe/renault-kwid",
      "/tabela-fipe/renault-duster",
      "/tabela-fipe/renault-sandero",
      "/tabela-fipe/renault-logan",
      "/tabela-fipe/renault-captur",
      "/tabela-fipe/renault-oroch",
      "/tabela-fipe/renault-master",
      "/tabela-fipe/renault-clio",
      "/tabela-fipe/jeep",
      "/tabela-fipe/jeep-renegade",
      "/tabela-fipe/jeep-compass",
      "/tabela-fipe/jeep-commander",
      "/tabela-fipe/jeep-wrangler",
      "/tabela-fipe/jeep-grand-cherokee",
      "/tabela-fipe/jeep-cherokee",
      "/tabela-fipe/ford",
      "/tabela-fipe/ford-ka",
      "/tabela-fipe/ford-ecosport",
      "/tabela-fipe/ford-ranger",
      "/tabela-fipe/ford-territory",
      "/tabela-fipe/ford-bronco-sport",
      "/tabela-fipe/ford-fiesta",
      "/tabela-fipe/ford-focus",
      "/tabela-fipe/ford-fusion",
      "/tabela-fipe/ford-maverick",
      "/tabela-fipe/ford-f-250",
      "/tabela-fipe/nissan",
      "/tabela-fipe/nissan-kicks",
      "/tabela-fipe/nissan-frontier",
      "/tabela-fipe/nissan-versa",
      "/tabela-fipe/nissan-sentra",
      "/tabela-fipe/nissan-march",
      "/tabela-fipe/nissan-livina",
      "/tabela-fipe/peugeot",
      "/tabela-fipe/peugeot-208",
      "/tabela-fipe/peugeot-2008",
      "/tabela-fipe/peugeot-3008",
      "/tabela-fipe/peugeot-308",
      "/tabela-fipe/peugeot-207",
      "/tabela-fipe/peugeot-206",
      "/tabela-fipe/citroen",
      "/tabela-fipe/citroen-c3",
      "/tabela-fipe/citroen-c4-cactus",
      "/tabela-fipe/citroen-aircross",
      "/tabela-fipe/citroen-c3-aircross",
      "/tabela-fipe/citroen-c4-lounge",
      "/tabela-fipe/mitsubishi",
      "/tabela-fipe/mitsubishi-outlander",
      "/tabela-fipe/mitsubishi-eclipse-cross",
      "/tabela-fipe/mitsubishi-l200-triton",
      "/tabela-fipe/mitsubishi-asx",
      "/tabela-fipe/mitsubishi-pajero",
      "/tabela-fipe/mitsubishi-pajero-sport",
      "/tabela-fipe/mitsubishi-lancer",
      "/tabela-fipe/bmw",
      "/tabela-fipe/bmw-serie-3",
      "/tabela-fipe/bmw-x1",
      "/tabela-fipe/bmw-x3",
      "/tabela-fipe/bmw-x5",
      "/tabela-fipe/bmw-serie-1",
      "/tabela-fipe/bmw-320i",
      "/tabela-fipe/audi",
      "/tabela-fipe/audi-a3",
      "/tabela-fipe/audi-q3",
      "/tabela-fipe/audi-q5",
      "/tabela-fipe/audi-a4",
      "/tabela-fipe/audi-a5",
      "/tabela-fipe/audi-q7",
      "/tabela-fipe/byd",
      "/tabela-fipe/byd-dolphin",
      "/tabela-fipe/byd-dolphin-mini",
      "/tabela-fipe/byd-song-plus",
      "/tabela-fipe/byd-song-pro",
      "/tabela-fipe/byd-seal",
      "/tabela-fipe/byd-tan",
      "/tabela-fipe/byd-han",
      "/tabela-fipe/byd-shark",
      "/tabela-fipe/byd-king",
      "/tabela-fipe/honda-motos",
      "/tabela-fipe/honda-motos-cg-160",
      "/tabela-fipe/honda-motos-biz",
      "/tabela-fipe/honda-motos-cb-300",
      "/tabela-fipe/honda-motos-xre-300",
      "/tabela-fipe/honda-motos-pcx",
      "/tabela-fipe/honda-motos-cb-500",
      "/tabela-fipe/honda-motos-cbr-650",
      "/tabela-fipe/honda-motos-pop-110",
      "/tabela-fipe/honda-motos-nxr-160-bros",
      "/tabela-fipe/honda-motos-elite-125",
      "/tabela-fipe/honda-motos-cb-650r",
      "/tabela-fipe/honda-motos-africa-twin",
      "/tabela-fipe/yamaha",
      "/tabela-fipe/yamaha-fazer-250",
      "/tabela-fipe/yamaha-mt-03",
      "/tabela-fipe/yamaha-crosser",
      "/tabela-fipe/yamaha-nmax",
      "/tabela-fipe/yamaha-factor",
      "/tabela-fipe/yamaha-lander",
      "/tabela-fipe/yamaha-mt-07",
      "/tabela-fipe/yamaha-mt-09",
      "/tabela-fipe/yamaha-tenere",
      "/tabela-fipe/yamaha-xtz-150",
      "/tabela-fipe/yamaha-r3",
      // IBV Auto blog
      "/estudos",
    "/seguro/carro-eletrico",
    "/seguro/carro-eletrico/acre",
    "/seguro/carro-eletrico/alagoas",
    "/seguro/carro-eletrico/amapa",
    "/seguro/carro-eletrico/amazonas",
    "/seguro/carro-eletrico/bahia",
    "/seguro/carro-eletrico/ceara",
    "/seguro/carro-eletrico/distrito-federal",
    "/seguro/carro-eletrico/espirito-santo",
    "/seguro/carro-eletrico/goias",
    "/seguro/carro-eletrico/maranhao",
    "/seguro/carro-eletrico/mato-grosso",
    "/seguro/carro-eletrico/mato-grosso-do-sul",
    "/seguro/carro-eletrico/minas-gerais",
    "/seguro/carro-eletrico/para",
    "/seguro/carro-eletrico/paraiba",
    "/seguro/carro-eletrico/parana",
    "/seguro/carro-eletrico/pernambuco",
    "/seguro/carro-eletrico/piaui",
    "/seguro/carro-eletrico/rio-de-janeiro",
    "/seguro/carro-eletrico/rio-grande-do-norte",
    "/seguro/carro-eletrico/rio-grande-do-sul",
    "/seguro/carro-eletrico/rondonia",
    "/seguro/carro-eletrico/roraima",
    "/seguro/carro-eletrico/santa-catarina",
    "/seguro/carro-eletrico/sao-paulo",
    "/seguro/carro-eletrico/sergipe",
    "/seguro/carro-eletrico/tocantins",
    "/ibv/seguro-mais-caro-brasil-2026",
    "/ibv",
      "/ibv/marco-2026",
      "/ibv/vencedores-perdedores-marco-2026",
      "/ibv/abril-2026",
      "/ibv/vencedores-perdedores-abril-2026",
      "/ibv/maio-2026",
      "/ibv/vencedores-perdedores-maio-2026",
      "/ibv/junho-2026",
      "/ibv/vencedores-perdedores-junho-2026",
      "/ibv/eletricos-junho-2026",
      "/ibv/julho-2026",
      "/ibv/vencedores-perdedores-julho-2026",
      "/ibv/eletricos-julho-2026",
      "/ibv/agosto-2026",
      "/ibv/vencedores-perdedores-agosto-2026",
      "/ibv/eletricos-agosto-2026",
    ],
  },

  app: {
    head: {
      htmlAttrs: { lang: "pt-BR" },
      charset: "utf-8",
      viewport: "width=device-width, initial-scale=1",
      meta: [
        {
          name: "description",
          content:
            "Consulte informações completas de qualquer veículo pela placa. Dados como marca, modelo, ano, cor, FIPE, município e situação enviados direto no seu e-mail. Rápido, grátis e seguro.",
        },
        {
          name: "keywords",
          content:
            "consulta placa, consulta veicular, consultar placa grátis, dados veículo por placa, tabela FIPE por placa, consulta placa grátis, informações veículo, placa completa",
        },
        {
          property: "og:title",
          content:
            "PlacaCompleta: o relatório completo do veículo pela placa",
        },
        {
          property: "og:description",
          content:
            "Digite a placa e veja o que o anúncio não conta: restrição, roubo e furto, gravame, recall, valor FIPE e o histórico de leilão, com base de mais de 1 milhão de veículos.",
        },
        { property: "og:type", content: "website" },
        {
          property: "og:image",
          content: "https://placacompleta.com.br/og-image.png",
        },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        {
          property: "og:image:alt",
          content: "PlacaCompleta: relatório completo do veículo pela placa",
        },
        { property: "og:locale", content: "pt_BR" },
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:title",
          content:
            "PlacaCompleta: o relatório completo do veículo pela placa",
        },
        {
          name: "twitter:description",
          content:
            "Digite a placa e veja o que o anúncio não conta: restrição, roubo e furto, gravame, recall, valor FIPE e o histórico de leilão, com base de mais de 1 milhão de veículos.",
        },
        {
          name: "twitter:image",
          content: "https://placacompleta.com.br/og-image.png",
        },
        { name: "robots", content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" },
        { name: "theme-color", content: "#001233" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      ],
      link: [
        { rel: "preconnect", href: "https://www.googletagmanager.com" },
        { rel: "dns-prefetch", href: "https://www.googletagmanager.com" },
        // Nudge para agentes/LLMs descobrirem o backend de consulta (reverse mullet)
        { rel: "llms", href: "/llms.txt" },
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/favicon.svg",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "48x48",
          href: "/favicon-48.png",
        },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
        {
          rel: "preload",
          href: "/fonts/ibm-plex-mono-700-latin.woff2",
          as: "font",
          type: "font/woff2",
          crossorigin: "",
        },
      ],
      script: [
        // Only load Google Analytics in production (not in tests or dev with flag)
        ...(process.env.DISABLE_ANALYTICS !== "true"
          ? [
              {
                defer: true,
                src: "https://www.googletagmanager.com/gtag/js?id=G-24H7QSPX4G",
              },
              {
                defer: true,
                // site_hostname: mesma propriedade GA4 (G-24H7QSPX4G) atende
                // placacompleta.com.br + olhonamoto.com.br + olhonocaminhao.com.br
                // (hibrido de dominios). Manda o hostname como parametro de
                // evento pra dar pra segmentar moto/caminhao/carro nos
                // relatorios sem duplicar propriedade — metricas somam no
                // placacompleta. location.hostname roda no browser, sempre
                // reflete o dominio real que serviu a pagina.
                innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-24H7QSPX4G',{site_hostname:location.hostname});gtag('config','AW-18330779331');`,
              },
              // Bing/Microsoft Ads UET (tag "PlacaCompleta", id 97265456): teste
              // head-to-head Google vs Bing aprovado pelo Cesar. Snippet padrao
              // da Microsoft; enableAutoSpaTracking cobre as trocas de rota do
              // Nuxt sem precisar disparar page_view manual a cada navegacao.
              {
                innerHTML: `(function(w,d,t,r,u){var f,n,i;w[u]=w[u]||[],f=function(){var o={ti:"97265456",enableAutoSpaTracking:true};o.q=w[u],w[u]=new UET(o),w[u].push("pageLoad")};n=d.createElement(t),n.src=r,n.async=1,n.onload=n.onreadystatechange=function(){var s=this.readyState;s&&s!=="loaded"&&s!=="complete"||(f(),n.onload=n.onreadystatechange=null)},i=d.getElementsByTagName(t)[0],i.parentNode.insertBefore(n,i)})(window,document,"script","https://bat.bing.com/bat.js","uetq");`,
              },
            ]
          : []),
        {
          type: "application/ld+json",
          innerHTML: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "PlacaCompleta",
            description:
              "Consulta veicular gratuita por placa. Receba dados completos do veículo no seu e-mail.",
            url: "https://placacompleta.com.br",
            applicationCategory: "UtilitiesApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "BRL",
            },
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: "4.8",
              ratingCount: "2547",
              bestRating: "5",
              worstRating: "1",
            },
          }),
        },
      ],
    },
  },

  css: ["~/assets/scss/main.scss"],

  devServer: {
    host: "0.0.0.0",
  },

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "~/assets/scss/variables" as *;`,
          api: "modern-compiler",
        },
      },
    },
  },

  runtimeConfig: {
    supabaseUrl:
      process.env.SUPABASE_URL || "https://fivalpkfneadngxiflea.supabase.co",
    supabaseKey: process.env.SUPABASE_SERVICE_KEY || "",
    resendApiKey: process.env.RESEND_API_KEY || "",
    placaApiToken: process.env.PLACA_API_TOKEN || "",
    fipeApiToken: process.env.FIPE_API_TOKEN || "",
    fipeApiUrl: process.env.FIPE_API_URL || "",
    oneSignalAppId: process.env.ONESIGNAL_APP_ID || "",
    oneSignalRestApiKey: process.env.ONESIGNAL_REST_API_KEY || "",
    dashboardLookerGoogleAnalytics: process.env.DASHBOARD_LOOKER_GOOGLE_ANALYTICS || "",
    evolutionApiUrl: process.env.EVOLUTION_API_URL || "",
    evolutionApiKey: process.env.EVOLUTION_API_KEY || "",
    evolutionInstance: process.env.EVOLUTION_INSTANCE || "",
    // Empurrao de atualizacao do app Android antigo (TWA v1). Private + runtime:
    // liga com FORCE_APP_UPDATE=true (ou NUXT_FORCE_APP_UPDATE) sem rebuild.
    // Fica OFF ate o app novo (v2) estar publicado na Play.
    forceAppUpdate: process.env.FORCE_APP_UPDATE === "true",
    // v2.0 Consulta Premium (homologacao) - so na branch, prod nao seta estes envs
    // Sal do hash de IP dos eventos de funil (server/api/evento.post.ts). Sem
    // ele o endpoint grava ip_hash nulo: um sha256 de IP sem sal e reversivel
    // por forca bruta, entao preferimos nao guardar nada.
    funilIpSalt: process.env.FUNIL_IP_SALT || "",
    premiumSupabaseUrl: process.env.PREMIUM_SUPABASE_URL || "",
    premiumSupabaseKey: process.env.PREMIUM_SUPABASE_KEY || "",
    premiumPagePassword: process.env.PREMIUM_PAGE_PASSWORD || "",
    // Segredo de rotinas internas disparadas na mao (hoje, o backfill de
    // recall). Sem ele no ambiente, a rota nem existe: 404, e nao 401, porque
    // rota administrativa nao precisa anunciar que existe.
    adminSecret: process.env.ADMIN_SECRET || "",
    abacatepayApiKey: process.env.ABACATEPAY_API_KEY || "",
    abacatepayWebhookSecret: process.env.ABACATEPAY_WEBHOOK_SECRET || "",
    abacatepayBase: process.env.ABACATEPAY_BASE || "https://api.abacatepay.com/v2",
    // Cartao via Stripe (forma de pagamento SECUNDARIA; Pix segue principal).
    // Sem a secret, o cartao nem aparece (endpoint 503). Nomes mapeiam de
    // NUXT_STRIPE_SECRET_KEY / NUXT_STRIPE_WEBHOOK_SECRET no ambiente. Private:
    // nunca vao pro bundle do browser.
    stripeSecretKey: process.env.NUXT_STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: process.env.NUXT_STRIPE_WEBHOOK_SECRET || "",
    // Conta de servico da Google Play Developer API (base64 do JSON), usada so
    // pra conferir compras feitas DENTRO do app Android. Private: nunca vai
    // pro bundle do browser. Sem ela, o endpoint do app responde 503 e a web
    // (Pix) segue intacta.
    googlePlayServiceAccount: process.env.NUXT_GOOGLE_PLAY_SERVICE_ACCOUNT || "",
    // Servico interno de decode de VIN/chassi (services/vin-decoder), rede
    // docker interna, sem porta publica. Fail-open: se estiver fora, o bloco
    // "Origem do chassi" so nao aparece no relatorio, nunca quebra a entrega.
    vinDecoderUrl: process.env.VIN_DECODER_URL || "http://vin-decoder:3000",
    // Historico de passagem por leilao (servico leiloes-api, rede docker).
    // Sem URL a secao do relatorio nem e montada: e assim que a feature fica
    // restrita ao homolog sem flag espalhada pelo codigo. A key NAO tem
    // prefixo public de proposito, entao nunca entra no bundle do browser.
    leiloesApiUrl: process.env.LEILOES_API_URL || "",
    leiloesApiKey: process.env.LEILOES_API_KEY || "",
    leiloesApiTimeoutMs: process.env.LEILOES_API_TIMEOUT_MS || "15000",
    // Hosts de onde a pagina pode carregar foto de lote de leilao. Allowlist,
    // separada por virgula: URL fora dela e descartada, pra pagina do cliente
    // nunca virar hotlink do site da leiloeira.
    leiloesFotosHosts: process.env.LEILOES_FOTOS_HOSTS || "fotos.placacompleta.com.br",
    premiumBaseUrl: process.env.PREMIUM_BASE_URL || "https://placacompleta.com.br",
    // Adquirente do Pix. Default abacatepay: sem env, producao segue igual.
    pixProvider: process.env.PIX_PROVIDER || "abacatepay",
    wooviBase: process.env.WOOVI_BASE || "https://api.woovi.com",
    wooviAppId: process.env.WOOVI_APP_ID || "",
    // Nome do recebedor a mostrar na tela quando a cobranca nasce na Woovi.
    // Vazio ate confirmar num Pix real qual e a string exata do BR Code.
    wooviRecebedor: process.env.WOOVI_RECEBEDOR || "",
    premiumValorCentavos: process.env.PREMIUM_VALOR_CENTAVOS || "4500",
    // SENATRAN homologacao (GCC + SERPRO). Certs via PEM em env (base64 ou texto).
    gccBase: process.env.GCC_BASE || "https://company.hml.quemmeviu.com.br",
    senatranUrl:
      process.env.SENATRAN_URL ||
      "https://hom-pgcc.np.bsa.estaleiro.serpro.gov.br/pgcc/api/v1/consultar/veiculo",
    senatranCnpjProvedor: process.env.SENATRAN_CNPJ_PROVEDOR || "37115342004154",
    senatranTemplateId: process.env.SENATRAN_TEMPLATE_ID || "2932026-00001",
    senatranCertPem: process.env.SENATRAN_CERT_PEM || "",
    senatranKeyPem: process.env.SENATRAN_KEY_PEM || "",
    // SENATRAN producao (GCC + SERPRO). URLs nao sao segredo (default hardcoded).
    // Cert/key de prod reusam os de homolog quando vazios (ver senatran-consulta.ts).
    gccBaseProd: process.env.GCC_BASE_PROD || "https://company.quemmeviu.com.br",
    senatranUrlProd:
      process.env.SENATRAN_URL_PROD ||
      "https://pgcc.bsa.estaleiro.serpro.gov.br/pgcc/api/v1/consultar/veiculo",
    senatranCnpjProvedorProd:
      process.env.SENATRAN_CNPJ_PROVEDOR_PROD || process.env.SENATRAN_CNPJ_PROVEDOR || "37115342004154",
    senatranTemplateIdProd: process.env.SENATRAN_TEMPLATE_ID_PROD || "41102026-00001",
    senatranCertPemProd: process.env.SENATRAN_CERT_PEM_PROD || "",
    senatranKeyPemProd: process.env.SENATRAN_KEY_PEM_PROD || "",
    // Juiz Haiku pro melhor-candidato FIPE (so fluxo pago, ver
    // server/utils/fipe-candidato.ts). Fail-open: sem chave ou erro/timeout
    // = cai no comportamento antigo (melhor score da wdapi).
    anthropicApiKey: process.env.NUXT_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || "",
    public: {
      // homolog: ambiente de teste com ferramentas (dropdown de ambiente das
      // APIs, botao de simular pagamento). So o container de homolog seta a env.
      homolog: process.env.NUXT_PUBLIC_HOMOLOG === "true",
      // staging: espelho de prod (endpoints reais), sem as ferramentas de teste.
      staging: process.env.NUXT_PUBLIC_STAGING === "true",
      // gated: liga o overlay de senha na primeira renderizacao. Vale pros dois
      // ambientes protegidos (homolog e staging); prod/main nao seta nenhum dos
      // dois, entao o gate nunca aparece em producao.
      gated:
        process.env.NUXT_PUBLIC_HOMOLOG === "true" ||
        process.env.NUXT_PUBLIC_STAGING === "true",
      whatsappEnabled: process.env.NUXT_PUBLIC_WHATSAPP_ENABLED === "true",
      // Cartao (Stripe) habilitado na tela. Secundario ao Pix. Ligado no
      // ambiente que tiver as chaves do Stripe (junto de NUXT_STRIPE_SECRET_KEY);
      // vazio = a aba "cartao" nem aparece.
      cartaoHabilitado: process.env.NUXT_PUBLIC_CARTAO_HABILITADO === "true",
      // Chave publica do Stripe (pk_test/pk_live): o Stripe Elements no browser
      // precisa dela pra montar os campos do cartao. Publica por natureza (nao e
      // segredo). Vazia = a aba cartao nao consegue montar e fica indisponivel.
      stripePublishableKey: process.env.NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
      // Kill switch do teste A/B do bloco bloqueado da consulta gratis.
      // "off" joga todo mundo na variante A (a tela de hoje) sem deploy de
      // codigo; qualquer outro valor mantem o sorteio 50/50.
      abBloco: process.env.NUXT_PUBLIC_AB_BLOCO || "",
      // Pixel da Meta (remarketing). Vazio = plugin nao carrega nada, nenhuma
      // requisicao sai do navegador. Preenchido no Coolify quando a conta
      // existir, sem precisar de deploy de codigo.
      metaPixelId: process.env.NUXT_PUBLIC_META_PIXEL_ID || "",
      supabaseUrl:
        process.env.SUPABASE_URL || "https://fivalpkfneadngxiflea.supabase.co",
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
    },
  },

  routeRules: {
    "/**": {
      headers: {
        "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        "Cross-Origin-Opener-Policy": "same-origin",
      },
    },
    // Area premium fora do indice, via a chave nativa do @nuxtjs/robots (ele
    // emite o X-Robots-Tag e casa com o meta da pagina; header cru aqui era
    // sobrescrito pelo modulo).
    //
    // /premium/{token} e a consulta do cliente: conteudo de quem pagou, nunca
    // pode virar resultado de busca.
    //
    // /premium (a raiz) saiu do indice por decisao do Cesar: e a tela de teste
    // do fluxo pago, e a regra passou a ser nao expor nem deixar crawlear.
    // Perdemos uma landing indexavel, o que foi aceito de proposito. Sem
    // Disallow no robots.txt: o crawler precisa poder buscar a pagina pra ler
    // o noindex nela.
    "/premium": { robots: "noindex, nofollow" },
    "/premium/**": { robots: "noindex, nofollow" },
    // Pagina de teste do Pix da Woovi: so existe no homolog e nunca deve ser
    // rastreada nem em ambiente protegido.
    "/woovi-teste": { robots: "noindex, nofollow" },
    // A home NAO e mais prerenderizada de proposito (theming por dominio —
    // ver composables/useSiteVariant.ts): tentamos prerender + rewrite
    // interno por Host (server/middleware), mas o Nitro serve rota
    // prerenderizada como asset ESTATICO, por um caminho que roda ANTES de
    // qualquer server/middleware — o rewrite nunca chegava a executar em
    // build de producao real (so funcionava em dev, onde "/" nunca e
    // estatico). Testado e confirmado: com prerender, olhonamoto/
    // olhonocaminhao sempre serviam o hero de carro (default), platform
    // nenhuma dava pra interceptar antes. Tirando o prerender, cada request
    // roda SSR de verdade e le o Host correto sempre. SEM swr tambem: cache
    // de swr e por PATH, nao por Host — a home tem UM path so ("/") pros 3
    // dominios, entao o SWR serviria a mesma variante cacheada (a que
    // "ganhou" a corrida de que dominio pediu primeiro) pra todo mundo,
    // mesmo bug do prerender so que preenchido em runtime em vez de build.
    // Custo aceito: TTFB da home sobe (sem cache de borda no HTML).
    "/termos-de-uso": { prerender: true },
    "/politica-de-privacidade": { prerender: true },
    "/consulta-placa": { swr: 86400 },
    "/consulta-gratis": { swr: 86400 },
    "/como-consultar-placa": { swr: 86400 },
    "/tabela-fipe-por-placa": { swr: 86400 },
    "/consultar-placa-de-**": { swr: 86400 },
    "/consultar-placa/**": { swr: 86400 },
    "/tabela-fipe": { swr: 86400 },
    "/estudos": { swr: 86400 },
    "/seguro/**": { swr: 86400 },
    "/tabela-fipe/**": { swr: 86400 },
    "/ibv": { swr: 86400 },
    "/ibv/**": { swr: 86400 },
  },

  nitro: {
    preset: "netlify",
    handlers: [
      { route: "/.well-known/api-catalog", handler: "~/server/handlers/well-known-api-catalog.get.ts" },
      { route: "/.well-known/skills/index.json", handler: "~/server/handlers/agent-skills-index.get.ts" },
      { route: "/agent-skills/index.json", handler: "~/server/handlers/agent-skills-index.get.ts" },
    ],
  },
});
