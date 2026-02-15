# 🔐 Como configurar secrets no GitHub (2 minutos)

## 📍 Passo 1: Pegar as credenciais do Supabase

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto "PlacaCompleta"
3. Clique em **Settings** (ícone ⚙️ no menu lateral)
4. Clique em **API**
5. Copie e salve temporariamente:

```
✅ Project URL: https://xxxxxxxxx.supabase.co

✅ service_role key (secret): eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   (clique em "Reveal" para ver, depois "Copy")
```

⚠️ **IMPORTANTE:** Use o `service_role` (não o `anon` key)

---

## 📍 Passo 2: Adicionar no GitHub

1. Vá no seu repositório:
   ```
   https://github.com/SEU-USUARIO/PlacaCompleta
   ```

2. Clique em **Settings** (menu superior)

3. No menu lateral esquerdo, procure:
   ```
   Secrets and variables → Actions
   ```

4. Clique no botão verde **"New repository secret"**

5. Adicione o PRIMEIRO secret:
   ```
   Name:   PUBLIC_SUPABASE_URL
   Secret: https://xxxxxxxxx.supabase.co
   ```
   → Clique em **"Add secret"**

6. Clique novamente em **"New repository secret"**

7. Adicione o SEGUNDO secret:
   ```
   Name:   SUPABASE_SERVICE_ROLE_KEY
   Secret: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   → Clique em **"Add secret"**

---

## ✅ Pronto!

Agora você deve ver:

```
Repository secrets

○ PUBLIC_SUPABASE_URL                    Updated now
○ SUPABASE_SERVICE_ROLE_KEY              Updated now
```

---

## 🧪 Testar

1. Faça commit e push dos arquivos do GitHub Actions:
   ```bash
   git add .github/
   git commit -m "ci: add E2E tests pipeline"
   git push
   ```

2. Abra um Pull Request (ou faça push direto na main)

3. Vá na aba **Actions** do repo

4. Você verá os testes rodando! 🎉

---

## 🎯 Resultado esperado

No seu PR, você verá:

```
✅ Basic E2E Tests          Passed in 2m 34s
✅ Lead Capture Tests       Passed in 3m 12s
```

Se os testes de Lead Capture não aparecerem, revise se os secrets foram adicionados corretamente.

---

## 🆘 Problemas?

- **Secrets não aparecem?** → Verifique se está em "Actions" (não "Codespaces" ou "Dependabot")
- **Não vê a aba Settings?** → Você precisa ser admin/owner do repo
- **Key inválida?** → Certifique-se que copiou o `service_role` (não `anon`)

---

**Dica:** Guarde este arquivo! Você pode deletá-lo depois que configurar.
