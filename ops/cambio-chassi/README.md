# Camada 2 do câmbio: regras por prefixo do chassi

`shared/cambio-chassi.json` guarda os prefixos de chassi (posições 1 a 8) com câmbio
unânime (mínimo 5 chassis, 0 conflito). Ele é regenerado 1x por mês, de madrugada,
a partir de:

- lotes de leilão com câmbio no texto do modelo (`extrair.sh`, só SELECT no
  leiloes-poc-db, faixas de id, timeout curto, janela 01h-05h45, retoma do cursor);
- escolhas dos clientes na tela (`valorCusto.fipeEscolhaCliente`, só SELECT em prod).

`gerar.ts` mede a validação cruzada (5-fold) e não gera se o acerto cair abaixo de 99%.
`rodar.sh` só abre um PR (`chore/cambio-chassi-AAAAMM`) quando as regras mudam.
Nada troca em prod sozinho: o PR passa pelo Cesar.

## Instalar (na VPS, como root)

```
install -d /usr/local/lib/cambio-chassi /var/lib/cambio-chassi
install -m 755 ops/cambio-chassi/rodar.sh ops/cambio-chassi/extrair.sh /usr/local/lib/cambio-chassi/
cp ops/systemd/pc-cambio-chassi.service ops/systemd/pc-cambio-chassi.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pc-cambio-chassi.timer
systemctl list-timers pc-cambio-chassi
```

Precisa de: `/root/.leiloes-db.env` (DB_PASS), `/root/.supabase/access-token`, `gh`
autenticado e um `node_modules` do site (variável `NODE_MODULES`; padrão
`/root/pc-wt-go/node_modules`). Log em `/var/lib/cambio-chassi/rodar.log`.
