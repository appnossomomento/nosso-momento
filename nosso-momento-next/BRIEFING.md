# BRIEFING — Nosso Momento Next.js

> **Para o novo agente de IA:** leia este arquivo completo antes de qualquer ação. Ele descreve o estado real do projeto, o que já foi feito, o que está pendente e como o deploy funciona.

---

## 1. O que é o App

**Nosso Momento** é um aplicativo para casais que gamifica o relacionamento. As funcionalidades principais são:

- **Parceiro:** conecta dois usuários via pareamento por telefone ou link de convite
- **Momentos:** catálogo de atividades/missões que um usuário "resgata" (compra com foguinhos) para o casal realizar. O resgante envia o momento ao parceiro; quem recebeu o momento o marca como "Feito" após realizar fora do app, podendo subir uma foto.
- **Desafios:** desafios semanais gerados por IA para o casal
- **Foguinhos:** moeda interna do app (ganha ao completar momentos, check-ins diários, conquistas)
- **Memórias:** galeria de fotos dos momentos realizados com estatísticas mensais
- **Notificações:** feed segmentado (Momentos / Diário / Conquistas)
- **Loja:** catálogo de momentos para resgatar usando foguinhos
- **Clima:** registro diário de humor do casal

---

## 2. Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4 |
| Estado | Zustand (`lib/store/appStore.ts`) |
| Backend/DB | Firebase (Firestore, Auth, Storage, FCM) |
| Cloud Functions | Node.js 22, 2ª geração, região `southamerica-east1` |
| Deploy Frontend | Vercel (projeto `nosso-momento`, domínio `nossomomento.app`) |
| Repositório | GitHub: `appnossomomento/nosso-momento` (branch `master`) |

---

## 3. Arquitetura Crítica — LEIA COM ATENÇÃO

### Regra de escrita no Firestore
**O frontend NUNCA escreve diretamente em documentos de usuário (`/usuarios/{uid}`) ou documentos de negócio.** Toda ação do usuário é enviada como um "input" via `sendInput()` (que chama o CF `createInput`), e o CF Admin (`processInput`) processa assincronamente com permissões de Admin SDK.

Exceções permitidas ao cliente:
- `notificacoes/{nid}` → apenas o campo `lida: boolean`
- `inputs/{id}` → criação (via `createInput` CF, não direto)

### Fonte de verdade: Foguinhos
`usuario.foguinhos` (documento `/usuarios/{uid}`) é a **única fonte de verdade** para o saldo de foguinhos. O campo `pareamentos/{id}/foguinhos_pessoaX` existe mas **não é mais usado para validação** (foi corrigido nesta sessão).

### Arquivos principais
```
nosso-momento-next/
├── app/(app)/          ← Rotas protegidas (usuário logado)
│   ├── dashboard/      ← Tela inicial
│   ├── parceiro/       ← Perfil do parceiro + despareamento
│   ├── parear/         ← Tela de pareamento
│   ├── loja/           ← Catálogo de momentos (foguinhos)
│   ├── momentos/       ← Momentos resgatados (enviados/recebidos)
│   ├── memorias/       ← Galeria + stats mensais
│   ├── notificacoes/   ← Feed de notificações
│   ├── desafios/       ← Desafios semanais
│   └── perfil/         ← Perfil do usuário
├── lib/
│   ├── store/appStore.ts     ← Zustand store global
│   ├── hooks/
│   │   ├── useAuth.ts             ← Auth + snapshot do usuário
│   │   ├── useParceiroData.ts     ← Listener do doc do parceiro
│   │   ├── usePareamentoListeners.ts ← Listener de pareamentos
│   │   ├── useNotificacoes.ts     ← Listener de notificações
│   │   └── useClimaData.ts        ← Listener de clima
│   ├── firebase/
│   │   ├── client.ts   ← Firebase client SDK
│   │   ├── admin.ts    ← Firebase Admin SDK (API Routes)
│   │   └── functions.ts ← sendInput() e callFunction()
│   └── types/index.ts  ← Tipos TypeScript
├── components/
│   ├── AuthProvider.tsx    ← Provider raiz (inicializa todos os hooks)
│   └── parceiro/ParceiroHeader.tsx
└── functions/ (FORA desta pasta, em ../functions/)
    └── handlers/
        ├── processInput.js   ← CF principal (pairing, moments, etc.)
        ├── memories.js       ← CF createMemoriaPhoto
        └── achievements.js   ← CF de conquistas
```

---

## 4. Estado Atual (após sessão de bugfixes)

### O que foi corrigido e está em produção (`nossomomento.app`)

| Bug | Arquivo | Correção |
|---|---|---|
| Pareamento por telefone falhava sempre | `app/(app)/parear/page.tsx` | `check.existe` → `check.ok` (CF retorna `{ ok: true }` neutro) |
| 2 telas intermediárias ao desparear | `app/(app)/parceiro/page.tsx` | `router.replace('/parear')` antes do `set()` |
| `useParceiroData` permission-denied após despareamento | `app/(app)/parceiro/page.tsx` | `set()` agora zera `usuario.pareadoUid` e `usuario.pareadoCom` |
| Foguinhos não creditados ao completar momento com foto | `functions/handlers/processInput.js` | Corrigida ordem de reads na transação do CF |
| Resgate de momento falhava silenciosamente | `functions/handlers/processInput.js` | `usuario.foguinhos` como única fonte de verdade para validação |
| Stats de Memórias mostravam totais vitalícios | `app/(app)/memorias/page.tsx` | Filtro mensal com `resgatadoPorUid` |
| Notificações não funcionavam | `lib/hooks/useNotificacoes.ts` (NOVO) | Hook com listener Firestore + store integration |
| Foguinhos divergiam entre header e loja | `components/parceiro/ParceiroHeader.tsx`, `parceiro/page.tsx` | Fonte unificada em `usuario.foguinhos` |
| Botão "Feito" resetava ao recarregar `/momentos` | `app/(app)/momentos/page.tsx` | Validação `resgatadoPorUid === fromUid` no CF |
| Desafios sobrepostos | `app/(app)/desafios/page.tsx` | `useEffect` remove desafios expirados |
| Imagem do catálogo não aparecia em momentos resgatados | `functions/handlers/processInput.js` | Adicionado `momentoImg` no handler `moment_redeem` |

---

## 5. Itens Pendentes — Normalizar o Web App

### CRÍTICO (precisa corrigir)

#### 5.1 `useParceiroData` não limpa o estado em erro de permissão

**Arquivo:** `lib/hooks/useParceiroData.ts`

**Problema:** O callback de erro (`err`) do `onSnapshot` apenas loga o erro. Se o Firestore retornar `permission-denied` (o que acontece quando o usuário desfaz o pareamento e o `pareadoUid` ainda está no documento), o hook não limpa o estado — `pareado` permanece `true` na tela.

**Correção necessária:**
```typescript
// Em lib/hooks/useParceiroData.ts, linha 57-59
(err) => {
  console.error('[useParceiroData] erro ao escutar parceiro:', err);
  // ADICIONAR:
  if (err.code === 'permission-denied') {
    set({ parceiroData: null, parceiroNome: null, pareado: false, idPareamentoAmigavel: null, pareadoUid: null });
  }
}
```

#### 5.2 Projeto Vercel `nosso-momento-next` redundante

**Problema:** Existe um projeto Vercel chamado `nosso-momento-next` (URL: `nosso-momento-next.vercel.app`) que:
- Não tem variáveis de ambiente configuradas (Firebase não funciona nele)
- Não está conectado ao GitHub (sem auto-deploy)
- Foi deployado manualmente via CLI anteriormente

**Ação:** Acessar Vercel dashboard → projeto `nosso-momento-next` → Settings → Advanced → Delete Project. O domínio principal `nossomomento.app` está no projeto `nosso-momento` que é o correto.

#### 5.3 Git status: arquivos pendentes não commitados

**Problema:** 7 arquivos em `../planejamento-projeto/` foram deletados localmente mas não estão commitados. E existe um diretório `documentacao-projeto-estrategia/` não rastreado.

**Verificar rodando:** `git status` na raiz do repo.

**Ação:** Decidir se quer commitar as deleções do `planejamento-projeto/` e se quer commitar ou ignorar `documentacao-projeto-estrategia/`.

---

### IMPORTANTE (testar em produção)

#### 5.4 Testar pareamento por telefone em produção

O bug foi corrigido (código `check.existe` → `check.ok`) mas ainda precisa ser validado no app real. Fluxo a testar:
1. Usuário A na tela `/parear`, digita telefone do Usuário B (11 dígitos)
2. Clica "SOLICITAR PAREAMENTO"
3. Deve aparecer toast "Solicitação enviada! Aguarde seu parceiro aceitar."
4. Usuário B deve ver a solicitação e poder aceitar

#### 5.5 Testar despareamento e re-pareamento em produção

Fluxo a testar:
1. `/parceiro` → "Desfazer Pareamento" → confirmar
2. Deve ir direto para `/parear` sem telas intermediárias
3. Na tela `/parear`, tentar parear novamente com outro número
4. Não deve dar erro `sender_already_paired`

#### 5.6 Testar notificações em produção

As notificações foram implementadas (hook `useNotificacoes`). Verificar:
- Se as 3 abas (Momentos / Diário / Conquistas) aparecem com notificações corretas
- Se o contador de não lidas no ícone do menu aparece
- Se marcar como lido funciona (campo `lida: true` é atualizado no Firestore)

---

### VERIFICAR (infraestrutura)

#### 5.7 Auto-deploy do GitHub no projeto `nosso-momento`

O projeto `nosso-momento` no Vercel deve estar conectado ao GitHub (`appnossomomento/nosso-momento`, branch `master`) com Root Directory = `nosso-momento-next`. Cada push para `master` deve disparar um build automático.

Verificar em: Vercel → projeto `nosso-momento` → Deployments → confirmar que o último build foi do commit correto.

#### 5.8 App Check em produção

O `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` está configurado no projeto `nosso-momento`. O App Check usa reCAPTCHA v3 em produção. Verificar se não há erros de App Check bloqueando requisições ao Firebase no console do browser em `nossomomento.app`.

---

## 6. Fluxo de Deploy Correto

### Deploy automático (recomendado)
```bash
git add .
git commit -m "mensagem"
git push origin master
# → Vercel detecta o push e builda automaticamente para nossomomento.app
```

### Deploy manual via CLI (quando necessário)
```bash
# SEMPRE da raiz do repositório (C:\Users\WL\Desktop\nosso-momento)
cd "C:\Users\WL\Desktop\nosso-momento"
node "C:\Users\WL\AppData\Roaming\npm\node_modules\vercel\dist\index.js" --prod
# Isso deploya o código de nosso-momento-next/ usando as env vars do projeto nosso-momento
```

### Deploy das Cloud Functions
```bash
cd "C:\Users\WL\Desktop\nosso-momento\functions"
node "C:\Users\WL\AppData\Roaming\npm\node_modules\firebase-tools\lib\bin\firebase.js" deploy --only "functions:processInput" --project nosso-momento-app
# Para múltiplas funções:
# --only "functions:processInput,functions:createMemoriaPhoto"
```

---

## 7. Variáveis de Ambiente

As variáveis de ambiente estão configuradas no projeto **`nosso-momento`** no Vercel (não no `nosso-momento-next`). Nunca estão em `.env.local` (o arquivo local só tem o `VERCEL_OIDC_TOKEN`).

Variáveis usadas pelo código:

| Variável | Onde usada | Tipo |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `lib/firebase/client.ts` | Client |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `lib/firebase/client.ts` | Client |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `lib/firebase/client.ts` | Client |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `lib/firebase/client.ts` | Client |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `lib/firebase/client.ts` | Client |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `lib/firebase/client.ts` | Client |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | `lib/firebase/client.ts` (App Check) | Client |
| `NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN` | `lib/firebase/client.ts` (dev only) | Client |
| `FIREBASE_PROJECT_ID` | `lib/firebase/admin.ts` | Server |
| `FIREBASE_CLIENT_EMAIL` | `lib/firebase/admin.ts` | Server |
| `FIREBASE_PRIVATE_KEY` | `lib/firebase/admin.ts` | Server |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | `lib/utils/fcmClient.ts` | Client |
| `ADMIN_MONITORING_EMAILS` | `lib/auth/adminMonitoring.ts` (painel admin) | Server |

Painel interno: `/paineladmin-monitoring-v0` — código em `admin-panel/`, métricas via `/api/admin/*`. Configure `ADMIN_MONITORING_EMAILS` no Vercel (emails separados por vírgula, minúsculas).

**Especificação UX/UI do dashboard moderno:** [`admin-panel/DASHBOARD_MODERNO.md`](admin-panel/DASHBOARD_MODERNO.md) — menu lateral, gráficos, filtros de período e identidade visual.

---

## 8. Regras do Firestore Relevantes

```
/usuarios/{uid}         → read: autenticado e (dono OU pareado com); write: false (só Admin CF)
/pareamentos/{id}       → read/write: apenas usuários do par
/tarefasMomentos/{id}   → read: autenticado; write: false (só Admin CF)
/notificacoes/{nid}     → read: dono; update: apenas campo `lida` (bool); create: dono; delete: false
/inputs/{id}            → create: autenticado; read/update/delete: controlado
```

---

## 9. Commits Recentes

```
f40cd8e chore: remove entradas duplicadas do .vercel no .gitignore
e4ded28 fix: corrige pareamento por telefone e bugs de navegacao pos-despareamento
6f4589f fix(ts): cast self via unknown para FIREBASE_APPCHECK_DEBUG_TOKEN
1c3b7b2 feat(security): sprint seguranca MVP completo
```

---

## 10. Pontos de Atenção para o Novo Agente

1. **Antes de qualquer código:** leia `node_modules/next/dist/docs/` (regra do `AGENTS.md`) — esta versão do Next.js tem breaking changes
2. **Nunca escreva direto no Firestore pelo cliente** para docs de usuário — use `sendInput()` para criar um input no Cloud Function
3. **Source of truth:** `usuario.foguinhos` para saldo; `usuario.pareadoUid` para parceiro ativo
4. **Deploy de CF:** sempre verificar lint antes (`npm run lint` na pasta `functions/`) — o Firebase rejeita deploy com erros de ESLint
5. **PowerShell:** use `;` para separar comandos (não `&&`) — o ambiente Windows não suporta `&&` no PowerShell
6. **Vercel CLI:** sempre rodar da raiz `nosso-momento/` (não de `nosso-momento-next/`) para deploy manual
