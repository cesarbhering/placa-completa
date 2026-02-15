# 🔧 GitHub Actions - Pipeline de Testes

## ✅ O que foi configurado

Pipeline automático que roda em **todos os PRs e pushes para main**.

### Testes executados:
1. **Basic E2E** - User flow + PWA (sempre roda)
2. **Lead Capture** - Valida salvamento no Supabase (crítico! 🎯)

---

## 🔐 CONFIGURAÇÃO OBRIGATÓRIA

Você precisa configurar 2 secrets para os testes de lead capture funcionarem.

### Onde encontrar as credenciais:

1. Abra: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em: **Settings** (ícone de engrenagem) > **API**
4. Copie:
   - **Project URL** → será o `PUBLIC_SUPABASE_URL`
   - **service_role** (secret key) → será o `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Use o service_role (não o anon)** - necessário para os testes validarem inserts

---

## 📝 Passo a passo para adicionar no GitHub:

### 1. Vá no seu repositório no GitHub
```
https://github.com/SEU-USUARIO/SEU-REPO
```

### 2. Clique em **Settings** (menu superior do repo)

### 3. No menu lateral esquerdo:
- Procure por **Secrets and variables**
- Clique em **Actions**

### 4. Clique em **New repository secret**

### 5. Adicione o primeiro secret:
```
Name: PUBLIC_SUPABASE_URL
Secret: https://xxxxxxxx.supabase.co
```
Clique em **Add secret**

### 6. Adicione o segundo secret:
```
Name: SUPABASE_SERVICE_ROLE_KEY
Secret: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ...
```
Clique em **Add secret**

### 7. Pronto! ✅

Agora quando você abrir um PR, os testes vão rodar automaticamente.

---

## 🎯 Como funciona

```
Você abre PR → GitHub Actions inicia
                    ↓
            ┌───────┴────────┐
            ↓                ↓
    Basic E2E Tests   Lead Capture Tests
    (user-flow,PWA)   (valida Supabase)
            ↓                ↓
         ✅ PASS          ✅ PASS
                    ↓
            PR fica verde! 🟢
```

---

## 💰 Custos

- ✅ **Grátis** para repos públicos
- ✅ **2.000 min/mês grátis** para repos privados
- ✅ Este workflow usa ~3-5 min por PR

---

## 🐛 Troubleshooting

**Testes de Lead Capture não aparecem?**
- Confira se adicionou os 2 secrets
- Vá em Actions > clique no workflow > veja os logs

**Testes falhando?**
- Verifique se o service_role key está correto
- Verifique se a URL do Supabase está correta

**Onde ver os resultados?**
- Aba **Actions** do repo
- Ou no próprio PR (checks aparecem embaixo)
