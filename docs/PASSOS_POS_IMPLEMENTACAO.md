# Passos pós-implementação — Segurança MVP

Todos os arquivos já foram alterados no código. O que falta é configurar credenciais e publicar.

---

## 1. Credenciais Firebase Admin SDK (sessão server-side)

**Custo: $0** — parte do Firebase Auth gratuito.

1. Acesse [Firebase Console](https://console.firebase.google.com) → projeto **nosso-momento-app**
2. Ícone de engrenagem → **Configurações do projeto** → aba **Contas de serviço**
3. Clique em **Gerar nova chave privada** → baixa um arquivo `.json`
4. Abra o arquivo e copie:
   - `client_email` → cole em `FIREBASE_CLIENT_EMAIL`
   - `private_key` → cole em `FIREBASE_PRIVATE_KEY` (inclua as quebras `\n`, cole a chave inteira entre aspas)
5. Preencha no `.env.local` (desenvolvimento local) e **no painel Vercel** (produção):
   - Vercel → Settings → Environment Variables → adicione as 3 vars:
     - `FIREBASE_PROJECT_ID` = `nosso-momento-app`
     - `FIREBASE_CLIENT_EMAIL` = (valor do JSON)
     - `FIREBASE_PRIVATE_KEY` = (valor do JSON, com `\n` literais)

> ⚠️ Nunca commite o arquivo `.json` da conta de serviço no Git.

---

## 2. reCAPTCHA v3 + Firebase App Check

**Custo: $0** — reCAPTCHA v3 é gratuito até 1 milhão de avaliações/mês.

### 2a. Criar site key no Google reCAPTCHA

1. Acesse [admin.google.com/recaptcha](https://www.google.com/recaptcha/admin)
2. Clique em **+** (criar novo site)
3. Tipo: **reCAPTCHA v3**
4. Domínios: adicione `nossomomento.app` e `localhost`
5. Copie a **Site Key** (chave do site)
6. Cole em `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` no `.env.local` e no Vercel

### 2b. Registrar no Firebase App Check

1. Firebase Console → **App Check** (menu lateral)
2. Clique no app web → **Registrar**
3. Selecione **reCAPTCHA v3** → cole a **Site Key**
4. Clique em **Salvar**

### 2c. Token de debug para desenvolvimento local

1. Gere um UUID no terminal:
   ```bash
   node -e "console.log(require('crypto').randomUUID())"
   ```
2. Cole o resultado em `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN` no `.env.local`
3. Firebase Console → App Check → app web → **Debug tokens** → **Adicionar token de depuração** → cole o UUID

### 2d. Ativar enforcement (quando estiver pronto)

> Faça isso **depois** de rodar em produção por pelo menos 48h em modo monitor para garantir que nenhuma requisição legítima seja bloqueada.

1. Firebase Console → App Check → **Firestore** → clique em **Aplicar**
2. Firebase Console → App Check → **Functions** → clique em **Aplicar**

---

## 3. Publicar regras Firestore

**Custo: $0**

```bash
firebase deploy --only firestore:rules
```

O que muda:
- Leitura de `/usuarios/{id}` agora restrita ao próprio dono ou parceiro ativo
- Coleção `/rateLimits` bloqueada para clientes

---

## 4. Publicar Cloud Functions

**Custo: possível** — depende do plano atual.

```bash
cd functions
npm install   # garante que nenhuma dep foi esquecida
firebase deploy --only functions
```

O que muda:
- `verificarTelefone` passa a responder sempre `202 { ok: true }` (sem vazar se número existe)
- Rate limit de `verificarTelefone` cai de 10 para 3 req/min
- Rate limiting passa a usar Firestore em vez de memória (persiste entre cold starts)

> **Observação sobre custo:** o rate limit via Firestore gera 1 leitura + 1 escrita por requisição nos endpoints limitados. No plano Spark (gratuito) o Firestore tem 50k leituras/dia e 20k escritas/dia grátis. Para o volume atual do MVP isso não representa custo. Se o tráfego escalar, considere migrar para Cloud Armor (tem custo fixo ~$5/mês por política).

---

## 5. Publicar o Next.js (Vercel)

**Custo: $0** — Vercel hobby plan cobre o MVP.

Após configurar as variáveis de ambiente no painel Vercel (passos 1 e 2), faça um push para o branch `master`. O Vercel faz o deploy automático.

Ou manualmente:
```bash
cd nosso-momento-next
npx vercel --prod
```

---

## 6. Verificar CI (GitHub Actions)

**Custo: $0** — GitHub Actions é gratuito para repositórios públicos/privados dentro do limite de 2.000 min/mês.

O próximo PR aberto vai rodar automaticamente:
- ESLint nas functions
- `npm audit --audit-level=high` nas functions e no Next.js

Se o audit encontrar vulnerabilidade alta/crítica, o PR é bloqueado.

---

## Resumo de custos

| Item | Custo |
|---|---|
| Firebase Admin SDK (sessão) | **$0** |
| reCAPTCHA v3 | **$0** até 1M req/mês |
| Firebase App Check | **$0** |
| Firestore rate limits (writes) | **$0** no plano Spark (até ~20k escritas/dia) |
| Vercel deploy | **$0** no plano Hobby |
| GitHub Actions CI | **$0** até 2.000 min/mês |
| Cloud Armor (alternativa futura) | ~$5/mês por política se necessário |

**Total imediato: $0** para o volume atual do MVP.
