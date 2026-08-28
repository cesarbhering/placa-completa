declare global {
  interface Window {
    gtag: (...args: any[]) => void
    dataLayer: any[]
    // Bing/Microsoft Ads UET: fila de eventos que o bat.js processa quando
    // carrega. Existe mesmo antes do script carregar (o snippet cria o array).
    uetq: any[] & { push: (...args: any[]) => number }
  }
}

export {}
