# Scorecard de Maturidade MVP — Nosso Momento

> Documento vivo para acompanhar o nível de prontidão do app.  
> **Última revisão:** 14/06/2026  
> Complementa o [BRIEFING.md](./BRIEFING.md) (estado técnico). O [docs/mvp-action-plan.md](../docs/mvp-action-plan.md) é legado e pode estar desatualizado.

---

## Como usar

1. **Escala 0–10** por dimensão — use as âncoras (0 / 5 / 10) para calibrar notas sem subjetividade.
2. **Atualize** ao fim de cada sprint ou antes de deploy relevante (Vercel / Cloud Functions).
3. **Registre** mudanças na seção [Histórico de revisões](#histórico-de-revisões).
4. **Dimensões críticas** (não podem ficar abaixo do mínimo da meta): Core Product, Auth, Backend, Segurança, Legal/LGPD.

### Escala

| Faixa | Significado |
|-------|-------------|
| 0–2 | Inexistente ou quebrado |
| 3–4 | Protótipo / só dev local |
| 5–6 | Funciona com ressalvas conhecidas |
| 7–8 | Pronto para uso real com monitoramento |
| 9–10 | Produção madura, automatizado e auditável |

### Metas MVP

| Meta | Público | Média mínima* | Dimensões críticas |
|------|---------|---------------|-------------------|
| **Beta fechado** | 10–50 casais, sem divulgação ampla | ≥ 6,0 | Nenhuma crítica abaixo de **5** |
| **Soft launch** | Público limitado, divulgação com ressalvas | ≥ 7,0 | Nenhuma crítica abaixo de **6** |
| **Lançamento público** | Marketing amplo, escala esperada | ≥ 8,0 | Nenhuma dimensão abaixo de **7** |

\*Média das 11 dimensões principais (exclui Monetização, opcional se MVP não cobrar).

---

## Dashboard

**Média atual (11 dims): 6,3**

| Status meta | Resultado |
|-------------|-----------|
| Beta fechado (≥ 6,0) | **Apto** — P0 rules/storage corrigidos (deploy rules) |
| Soft launch (≥ 7,0) | **Não apto** |
| Lançamento público (≥ 8,0) | **Não apto** |

### Resumo por dimensão

| # | Dimensão | Nota | Crítica | Beta (≥5) | Soft (≥6) | Público (≥7) |
|---|----------|------|---------|-----------|-----------|--------------|
| 1 | Core Product | **8** | Sim | OK | OK | OK |
| 2 | Auth e sessão | **8** | Sim | OK | OK | OK |
| 3 | Backend e dados | **7** | Sim | OK | OK | OK |
| 4 | Segurança | **7** | Sim | OK | OK | OK |
| 5 | Legal e LGPD | **6** | Sim | OK | OK | Gap |
| 6 | Push e PWA | **7** | Não | OK | OK | OK |
| 7 | Testes e QA | **4** | Não | Gap | Gap | Gap |
| 8 | CI/CD e deploy | **6** | Não | OK | OK | Gap |
| 9 | Observabilidade | **5** | Não | OK | Gap | Gap |
| 10 | Resiliência e erros | **5** | Não | OK | Gap | Gap |
| 11 | Performance e escala | **6** | Não | OK | OK | Gap |
| 12 | Monetização* | **3** | Não | N/A | N/A | N/A |

\*Opcional se o MVP não exigir receita.

**Veredicto:** apto para **beta fechado** com casais reais; **não** para soft launch ou lançamento público sem tratar os bloqueadores P0.

---

## Detalhamento por dimensão

### 1. Core Product — jornada do casal

| Âncora | Critério |
|--------|----------|
| **0** | Fluxos principais incompletos ou sem backend |
| **5** | Parear, loja, momentos, clima e memórias funcionam manualmente |
| **10** | Jornada completa, edge cases tratados, UX consistente |

| Campo | Valor |
|-------|-------|
| **Nota** | 8 |
| **Evidências** | `app/(app)/`, `functions/handlers/processInput.js` |
| **Gaps** | Onboarding inexistente; VIP gate só UI; validação pareamento por telefone em prod |
| **Próximo passo** | Rodar jornada completa com 2–3 casais reais e registrar bugs |

---

### 2. Auth e sessão

| Âncora | Critério |
|--------|----------|
| **0** | Sem login persistente ou guard de rotas |
| **5** | Login/cadastro + cookie server-side em prod |
| **10** | Sessão robusta, refresh, logout limpo, recuperar senha |

| Campo | Valor |
|-------|-------|
| **Nota** | 8 |
| **Evidências** | `lib/hooks/useAuth.ts`, `app/api/auth/session/route.ts`, `app/(auth)/recuperar-senha/page.tsx`, `proxy.ts` |
| **Gaps** | Dev bypass de cookie em `proxy.ts`; sem OAuth |
| **Próximo passo** | Nenhum bloqueador para beta |

---

### 3. Backend e integridade de dados

| Âncora | Critério |
|--------|----------|
| **0** | Escritas client-side sem regras |
| **5** | `createInput` + `processInput` centralizados, foguinhos consistentes |
| **10** | Idempotência, testes CF, backups, sem drift rules/código |

| Campo | Valor |
|-------|-------|
| **Nota** | 7 |
| **Evidências** | `functions/index.js`, `BRIEFING.md` §3 |
| **Gaps** | Possível drift cadastro/perfil vs `firestore.rules`; CF `excluirConta` ausente |
| **Próximo passo** | Auditar rules vs campos escritos no cadastro e perfil |

---

### 4. Segurança

| Âncora | Critério |
|--------|----------|
| **0** | Regras abertas, sem App Check |
| **5** | App Check + rules restritivas + rate limit CF |
| **10** | Rules alinhadas ao código, audit log, secrets rotacionados, CI security |

| Campo | Valor |
|-------|-------|
| **Nota** | 7 |
| **Evidências** | `firestore.rules`, `storage.rules`, `app/(app)/perfil/page.tsx` |
| **Gaps** | App Check depende de config Console; SW com Firebase config hardcoded |
| **Próximo passo** | Validar cadastro + foto em prod |

---

### 5. Legal e LGPD

| Âncora | Critério |
|--------|----------|
| **0** | Sem termos/privacidade |
| **5** | Modal com conteúdo real + checkbox no cadastro |
| **10** | Exclusão completa via CF, rotas `/termos` e `/privacidade`, registro de consentimento |

| Campo | Valor |
|-------|-------|
| **Nota** | 6 |
| **Evidências** | `components/ui/LegalModal.tsx`, `app/(auth)/cadastro/page.tsx`, `app/(app)/perfil/page.tsx` |
| **Gaps** | Exclusão de conta só client-side (doc + Auth); sem limpeza Storage/pareamento/memórias |
| **Próximo passo** | Implementar CF `excluirConta` com cleanup completo |

---

### 6. Push e PWA

| Âncora | Critério |
|--------|----------|
| **0** | Sem notificações |
| **5** | FCM + SW + toggle no perfil |
| **10** | Deep links, re-sync token, iOS documentado, VAPID em todos ambientes |

| Campo | Valor |
|-------|-------|
| **Nota** | 7 |
| **Evidências** | `lib/hooks/useFCM.ts`, `lib/utils/fcmClient.ts`, `public/firebase-messaging-sw.js`, `functions/handlers/notifications.js` |
| **Gaps** | Preview Vercel sem `NEXT_PUBLIC_FIREBASE_VAPID_KEY`; SW com config Firebase hardcoded |
| **Próximo passo** | Replicar VAPID em Preview se usar deploys de preview |

---

### 7. Testes e QA

| Âncora | Critério |
|--------|----------|
| **0** | Sem testes |
| **5** | E2E Playwright local (3 specs) |
| **10** | E2E no CI, unit front + CF, smoke pós-deploy |

| Campo | Valor |
|-------|-------|
| **Nota** | 4 |
| **Evidências** | `e2e/`, `.github/workflows/pr-checks.yml`, `functions/*.test.js` |
| **Gaps** | CI não roda Next build nem e2e; sem unit tests no frontend |
| **Próximo passo** | Adicionar `next build` + lint no PR check |

---

### 8. CI/CD e deploy

| Âncora | Critério |
|--------|----------|
| **0** | Deploy manual sem checklist |
| **5** | Vercel + Firebase deploy documentados |
| **10** | PR gates (lint, build, test), rollback, envs separados |

| Campo | Valor |
|-------|-------|
| **Nota** | 6 |
| **Evidências** | `vercel.json`, `.github/workflows/deploy.yml`, `BRIEFING.md` §6 |
| **Gaps** | Next sem gate automático no CI; hosting legado no `firebase.json` raiz |
| **Próximo passo** | Workflow PR com build Next |

---

### 9. Observabilidade

| Âncora | Critério |
|--------|----------|
| **0** | Sem analytics nem logs |
| **5** | GA4 + Meta Pixel + logs CF |
| **10** | Sentry/APM, alertas, health check, backup monitorado |

| Campo | Valor |
|-------|-------|
| **Nota** | 5 |
| **Evidências** | `app/layout.tsx`, `admin-panel/`, `/api/admin/metrics` |
| **Gaps** | Sem Sentry/alertas; painel requer `ADMIN_MONITORING_EMAILS` na Vercel |
| **Próximo passo** | Configurar allowlist admin e acompanhar beta pelo painel |

---

### 10. Resiliência e erros (UX)

| Âncora | Critério |
|--------|----------|
| **0** | Crashes silenciosos |
| **5** | Toasts, modais, try/catch nos fluxos críticos |
| **10** | `error.tsx`, Error Boundaries, mensagens consistentes |

| Campo | Valor |
|-------|-------|
| **Nota** | 5 |
| **Evidências** | `components/ui/Toast.tsx`, `components/ui/Modal.tsx` |
| **Gaps** | Sem `error.tsx` / `global-error.tsx`; alguns `catch (_) {}` |
| **Próximo passo** | Adicionar `app/error.tsx` antes de soft launch |

---

### 11. Performance e escala

| Âncora | Critério |
|--------|----------|
| **0** | App lento ou sem limites |
| **5** | Next prod, listeners scoped, rate limits CF |
| **10** | Budgets, cache, índices Firestore revisados, load test |

| Campo | Valor |
|-------|-------|
| **Nota** | 6 |
| **Evidências** | Rate limits em `functions/lib/http.js`, listeners com `limit()` |
| **Gaps** | Sem load test; índices Firestore não auditados formalmente |
| **Próximo passo** | Smoke de performance com 20+ usuários simultâneos (opcional no beta) |

---

### 12. Monetização e ops de produto

| Âncora | Critério |
|--------|----------|
| **0** | N/A ou promessas sem implementação |
| **5** | VIP gate UI (múltiplos pareamentos) |
| **10** | Pagamento, planos, suporte operacional |

| Campo | Valor |
|-------|-------|
| **Nota** | 3 |
| **Evidências** | `components/VipPopup.tsx` |
| **Gaps** | Sem pagamento; popup only |
| **Próximo passo** | Ignorar até pós-MVP se não houver cobrança |

---

## Bloqueadores P0

Itens que impedem **soft launch** ou representam risco legal/segurança no **beta**:

| # | Bloqueador | Dimensão | Impacto |
|---|------------|----------|---------|
| P0-1 | Exclusão de conta incompleta (LGPD Art. 18) | Legal/LGPD | Titular não consegue apagar todos os dados |
| P0-2 | ~~Drift Firestore rules vs cadastro/perfil~~ | Segurança, Backend | **Corrigido** — deploy `firestore:rules` |
| P0-3 | ~~Storage path foto~~ | Segurança | **Corrigido** — `profile_pics/{uid}/foto.jpg` |
| P0-4 | CI sem build/lint Next no PR | Testes, CI/CD | Regressões chegam em prod sem gate |
| P0-5 | Sem observabilidade de erros (Sentry etc.) | Observabilidade | Falhas em prod invisíveis até usuário reportar |

**Para beta fechado:** P0-1 pode ser mitigado com exclusão manual via suporte. P0-2/P0-3 corrigidos.

**Para soft launch:** todos os P0 acima + elevar Testes e Resiliência para ≥ 6.

---

## Histórico de revisões

| Data | Média | Meta atingida | O que mudou |
|------|-------|---------------|-------------|
| 14/06/2026 | 6,0 | Beta fechado (limiar) | Scorecard inicial; push Fases 1–2 deployadas; cadastro 2 etapas |
| 14/06/2026 | 6,3 | Beta fechado | Painel `/paineladmin-monitoring-v0`; P0 rules + foto perfil |

---

## Referências

- [BRIEFING.md](./BRIEFING.md) — stack, arquitetura, deploy, env vars
- [docs/mvp-action-plan.md](../docs/mvp-action-plan.md) — checklist legado (pode citar `index.html`)
- [docs/PASSOS_POS_IMPLEMENTACAO.md](../docs/PASSOS_POS_IMPLEMENTACAO.md) — App Check pós-deploy
- [admin-panel/](./admin-panel/) — painel monitoring MVP (`/paineladmin-monitoring-v0`)
