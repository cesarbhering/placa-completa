# Staging e homolog sob demanda

Desde 12/nov/2026 os containers `pc-premium-staging` (staging.placacompleta.com.br, 127.0.0.1:8396) e
`pc-premium-homolog` (homolog.placacompleta.com.br, 127.0.0.1:8395) ficam **parados por padrão**. De pé o
tempo todo eles quase não gastavam CPU, mas ocupavam ~215 MB de swap numa VPS sem folga.

## Uso

```bash
pc-ambiente staging up        # sobe (ou renova a janela de 4 h, se já estiver de pé)
pc-ambiente homolog status    # de pé há quanto tempo e quando desliga
pc-ambiente staging down      # desliga na hora
pc-ambiente status            # os dois
```

Com o container parado, o hostname responde 502 pela Cloudflare. É esperado: suba antes de testar.

## Desligamento automático

O timer `pc-ambiente-auto-down` roda a cada 10 min e desliga o ambiente que passou de **4 h** de pé
(contado do último `up` ou do start do container, o que for mais recente). Quem ainda está testando roda
`pc-ambiente <amb> up` de novo para ganhar mais 4 h.

## O que depende deles

Nenhum timer nem sonda: o `pc-checkout-probe`, o `pc-site-check` e os coletores da TV olham só a produção.
O CI ("Lead Capture Tests") usa o **banco** Supabase de staging, não o container. A política
`unless-stopped` não religa um container parado com `docker stop`, nem depois de reboot.

## Instalação

```bash
install -m 755 ops/ambientes/pc-ambiente /usr/local/bin/pc-ambiente
install -m 644 ops/ambientes/pc-ambiente-auto-down.{service,timer} /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now pc-ambiente-auto-down.timer
```

Estado (hora do último `up`) em `/var/lib/pc-ambiente/<amb>.up`. O limite pode ser trocado com
`PC_AMBIENTE_LIMITE_S` (segundos).
