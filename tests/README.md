# 🧪 Testes - PlacaCompleta

Testes E2E focados em **funcionalidade** e **experiência do usuário**.

## 📋 O que é testado

### ✅ Fluxo Principal do Usuário
- Carregamento da homepage
- Visualização de elementos principais (formulário, inputs, botões)
- Indicadores de confiança (100% grátis, sem cadastro)
- Preview de dados de exemplo

### ✅ Validação de Formulário
- ❌ Placa inválida mostra erro
- ❌ Email inválido mostra erro
- ✅ Placa formato antigo (ABC1234) aceita
- ✅ Placa formato Mercosul (ABC1D23) aceita
- 🔠 Conversão automática para maiúsculas
- 7️⃣ Limite de 7 caracteres na placa

### ✅ Navegação
- Links do footer funcionam
- Páginas internas carregam corretamente
- Rotas principais acessíveis

### ✅ Design Responsivo
- 📱 Mobile (375x667)
- 📱 Tablet (768x1024)
- 🖥️ Desktop (1920x1080)

### ✅ Acessibilidade
- Labels associados aos inputs
- Autocomplete configurado
- Atributos HTML corretos

### ✅ Experiência do Usuário
- Focus automático no input de placa
- Email salvo no localStorage
- Contador de consultas (se disponível)

### ✅ PWA (Progressive Web App)
- 📱 Modo standalone detectado corretamente
- 🔢 Versão exibida na barra de título (PWA)
- 📧 Email input oculto em modo PWA
- 📋 Sample preview oculto em modo PWA
- 🔘 Texto do botão adaptado ("Consultar Placa")
- 📋 Modal de dados exibido em modo PWA
- 📋 Copy to clipboard funcional
- 🔔 Snackbar de notificação aparece
- 🎯 Window centralizado em mobile/PWA

---

## 🚀 Como Rodar os Testes

### Pré-requisitos

```bash
# Instalar dependências (se ainda não instalou)
npm install

# Iniciar servidor de desenvolvimento
npm run dev
```

### Rodar os Testes

```bash
# Rodar todos os testes (headless)
npm test

# Rodar testes de PWA
npm run test:pwa

# Rodar TODOS os testes (user flow + PWA)
npm run test:all

# Rodar com interface visual (headed)
npm run test:dev

# Rodar com interface interativa
npm run test:ui

# Ver relatório do último teste
npm run test:report
```

---
pwa.test.ts          # Testes de PWA (standalone mode)
├── 
## 📊 Estrutura dos Testes

```
tests/
├── user-flow.test.ts    # Testes de fluxo do usuário
├── seo.test.ts          # Testes de SEO (opcional)
└── README.md            # Esta documentação
```

---

## 🔧 Configuração

A configuração do Playwright está em `playwright.config.ts`.

### Executar em CI/CD

Os testes estão prontos para rodar em CI:

```yaml
# .github/workflows/test.yml (exemplo)
- name: Install dependencies
  run: npm ci

- name: Install Playwright
  run: npx playwright install --with-deps

- name: Run dev server
  run: npm run dev &

- name: Wait for server
  run: npx wait-on http://localhost:3000

- name: Run tests
  run: npm test
```

---

## 🐛 Troubleshooting

**Testes falhando?**

1. ✅ Certifique-se que `npm run dev` está rodando
2. ✅ Verifique se `http://localhost:3000` está acessível
3. ✅ Rode `npx playwright install` para instalar browsers

**Erro de timeout?**

```bash
# Aumentar timeout no playwright.config.ts
timeout: 30000  // 30 segundos
```

---

## 📝 Adicionar Novos Testes

```typescript
test('should do something', async ({ page }) => {
  // 1. Navegar
  await page.goto('http://localhost:3000')

  // 2. Interagir
  await page.locator('#meu-input').fill('valor')
  await page.click('button')

  /🔐 Pre-Commit Hook

Os testes rodam automaticamente antes de cada commit!

### Como funciona
- Instalado automaticamente após `npm install`
- Executa `npm run test:all` antes de cada commit
- Bloqueia o commit se os testes falharem

### Pular testes (quando necessário)
```bash
git commit --no-verify -m "Mensagem do commit"
```

### Reinstalar o hook
```bash
npm run prepare-hooks
```

---

## 📱 Testando PWA

### Simular PWA no Playwright
Os testes de PWA simulam o `display-mode: standalone` usando `matchMedia`:

```typescript
await context.addInitScript(() => {
  window.matchMedia = (query: string) => {
    if (query === '(display-mode: standalone)') {
      return { matches: true, ... }
    }
    return originalMatchMedia(query)
  }
})
```

### Testar PWA localmente

1. **Build e preview:**
   ```bash
   npm run build
   npm run preview
   ```

2. **No navegador:**
   - Abra DevTools (F12)
   - Vá para aba Application
   - Verifique Service Worker
   - Teste "Add to Home Screen"

3. **No mobile:**
   - Faça deploy
   - Visite no celular
   - Adicione à tela inicial
   - Abra como PWA

---

## / 3. Verificar
  await expect(page.locator('.resultado')).toBeVisible()
})
```

---

## 🎯 Próximos Passos

- [ ] Adicionar testes de API (quando integrada)
- [ ] Testes de performance (Lighthouse)
- [ ] Testes de acessibilidade (axe)
- [ ] Testes de diferentes estados de loading
- [ ] Testes de mensagens de sucesso/erro completas

---

**Nota:** Os testes focam na **experiência do usuário** e não em aspectos técnicos de SEO.
