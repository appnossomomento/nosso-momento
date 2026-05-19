# Plano de Ação — Pré-MVP Nosso Momento

> Atualizado em: 19/05/2026
> Objetivo: Sanear todos os pontos críticos antes do lançamento público

---

## 🔴 Bloqueadores (obrigatório antes de qualquer divulgação)

### 1. Termos de Uso e Política de Privacidade — CONTEÚDO INCOMPLETO

**Status**: ⚠️ Existe tecnicamente, mas o conteúdo é um placeholder de 1 frase (sem validade legal)
**Risco**: LGPD — sem documentos adequados, o app não pode coletar dados pessoais legalmente
**Arquivo**: `index.html` → função `renderLegalModal()` (~linha 4073)

**O que fazer**:
- [ ] Redigir Política de Privacidade completa cobrindo: dados coletados (nome, email, telefone, foto), finalidade, base legal (LGPD Art. 7), retenção, compartilhamento, direitos do titular
- [ ] Redigir Termos de Uso cobrindo: elegibilidade (idade mínima), uso aceitável, propriedade intelectual, limitação de responsabilidade, rescisão
- [ ] Substituir o texto placeholder em `renderLegalModal()` pelo conteúdo completo
- [ ] Adicionar data de vigência e versão em ambos os documentos
- [ ] Opcionalmente: criar páginas dedicadas `/privacidade` e `/termos` em vez de modal

**Referência legal**: LGPD (Lei 13.709/2018), Arts. 9, 18 e 37

---

### 2. Exclusão de conta (LGPD Art. 18, inciso VI)

**Status**: ❌ Não existe
**Risco**: LGPD exige que o titular possa solicitar exclusão completa dos dados a qualquer momento
**Arquivo**: `index.html` → `renderMeuPerfil()` (~linha 5393) + nova Cloud Function

**O que fazer**:
- [ ] Criar Cloud Function `excluirConta` em `functions/handlers/profile.js`:
  - Verificar idToken do usuário
  - Deletar documento `usuarios/{uid}` e subcoleções (extrato, etc.)
  - Deletar foto do Storage se existir
  - Remover uid de `pareamentosAtivos` do parceiro
  - Deletar conta do Firebase Auth (`admin.auth().deleteUser(uid)`)
- [ ] Adicionar botão "Excluir minha conta" em `renderMeuPerfil()` (zona de perigo, visual discreto)
- [ ] Criar modal de confirmação com campo de digitação ("Digite EXCLUIR para confirmar")
- [ ] Exportar função em `functions/index.js`

---

### 3. Recuperação de senha

**Status**: ❌ Não existe
**Risco**: Usuários que esquecem a senha ficam bloqueados sem suporte
**Arquivo**: `index.html` → tela `signIn`

**O que fazer**:
- [ ] Adicionar link "Esqueci minha senha" abaixo do botão de login na tela `signIn`
- [ ] Ao clicar: exibir campo de email e botão "Enviar link de recuperação"
- [ ] Chamar `firebase.auth().sendPasswordResetEmail(email)` (já disponível no SDK Firebase compat)
- [ ] Exibir toast de confirmação: "Link enviado para seu email"
- [ ] Tratar erro se email não encontrado

---

## 🟡 Importantes (afeta retenção na primeira semana)

### 4. Onboarding para usuário novo sem parceiro

**Status**: ⚠️ Modal de pareamento existe, mas sem contexto explicativo
**Arquivo**: `index.html` → `loadUserDataAndNavigate()` + novo componente de onboarding

**O que fazer**:
- [ ] Criar 2–3 slides de onboarding (o que é o app, como parear, o que esperar)
- [ ] Exibir apenas na primeira sessão: verificar flag `onboardingVisto` no Firestore do usuário
- [ ] Mostrar antes do modal de pareamento, não depois
- [ ] Salvar flag `onboardingVisto: true` ao concluir

---

### 5. Permissão de push notification no momento certo

**Status**: ⚠️ `Notification.requestPermission()` existe (~linha 2577), mas precisa verificar o timing
**Arquivo**: `index.html`

**O que fazer**:
- [ ] Confirmar que o pedido NÃO ocorre no primeiro acesso (antes de qualquer ação)
- [ ] Adicionar tela de "pré-permissão" explicativa antes do `requestPermission()`:
  - Ícone de coração/notificação
  - Texto: "Ative para não perder os momentos com seu amor"
  - Botões: "Ativar" e "Agora não"
- [ ] Momento ideal: após o pareamento ser confirmado

---

### 6. Tailwind CDN → Build em produção

**Status**: ⚠️ CDN ativo — aviso no console, bundle desnecessariamente grande
**Arquivo**: `vercel.json`, `scripts/build.js`, `styles/input.css`

**O que fazer**:
- [ ] Verificar se Vercel está servindo `dist/index.html` (output do build) ou `index.html` direto
- [ ] Rodar `npm run build` localmente e conferir se `dist/` é gerado corretamente
- [ ] Confirmar que `buildCommand: "npm run build"` no `vercel.json` está ativo e funcionando
- [ ] Após confirmar build: remover `<script src="https://cdn.tailwindcss.com">` do head

---

## 🟢 Assíncrono (pode lançar sem, mas resolver rápido)

### 7. Migrar Firestore `enableMultiTabIndexedDbPersistence` (deprecated)

**Status**: ⚠️ API deprecated — aviso no console
**Arquivo**: `index.html` — buscar por `enableMultiTabIndexedDbPersistence`

**O que fazer**:
- [ ] Substituir:
  ```js
  // Antes
  firebase.firestore().enableMultiTabIndexedDbPersistence()

  // Depois
  firebase.firestore().settings({
    cache: { kind: 'persistentMultipleTab' }
  });
  ```

---

### 8. FIREBASE_TOKEN no GitHub Secrets

**Status**: ❌ Não confirmado — sem ele o deploy.yml falha silenciosamente
**O que fazer**:
- [ ] Rodar `firebase login:ci` no terminal e copiar o token gerado
- [ ] GitHub → Settings → Secrets and variables → Actions → New repository secret
- [ ] Nome: `FIREBASE_TOKEN`, Valor: token copiado

---

### 9. Branch protection no GitHub

**Status**: ❌ Não configurado — push direto em master ainda é possível
**O que fazer**:
- [ ] GitHub → Settings → Branches → Add branch protection rule
- [ ] Branch name pattern: `master`
- [ ] Marcar: *Require a pull request before merging*
- [ ] Marcar: *Require status checks to pass before merging* → selecionar `PR Checks (lint)`

---

## ✅ Já resolvido

| Item | Detalhe |
|---|---|
| Modal de Termos/Privacidade (estrutura) | Existe via `openLegalModal()` — falta só conteúdo adequado |
| Desvincular parceiro | `pairing_cancel` e `pairing_unpair` implementados |
| Estado de aguardando parceiro | `pending_<telefone>` exibido corretamente |
| Toggle de push notification | Implementado em "Meu Perfil" |
| Backup diário do Firestore | Cloud Scheduler + GCS configurado |
| CI/CD (lint + deploy) | Workflows GitHub Actions configurados |
| Testes automatizados | 72 testes passando em 4 suites |
| Verificação de telefone segura | Endpoint `verificarTelefone` no backend |
| Deep link de convite | `gerarConvite` + `convite_aceitar` deployados |
| Inline error de usuário não encontrado | Implementado abaixo do campo de telefone |
| Lazy load do html2canvas | Removido do head — carrega só quando necessário |
| Scroll ao abrir catálogo | Resetado via `appEl.scrollTop = 0` |

---

## Ordem de execução sugerida

```
Semana 1 — Bloqueadores legais
  1. Termos e Privacidade (conteúdo completo)
  2. Exclusão de conta (backend + frontend)
  3. Recuperação de senha

Semana 2 — Retenção
  4. Onboarding
  5. Timing de push notification

Semana 3 — Infraestrutura
  6. Tailwind build em produção
  7. Firestore deprecated API
  8. FIREBASE_TOKEN secret
  9. Branch protection
```
