# Backlog de Implementação — 22/07/2026

O que planejamos hoje, organizado por prioridade e status.  
Foco: medir uso → converter VIP → ouvir a base.

---

## 1. Analytics de ações e telas (app + LP)

**Status:** código pronto localmente · **falta commit / deploy**

- [x] Registry central + eventos de negócio + screen tracking + CTAs LP
- [ ] Commit + deploy
- [ ] GA4: marcar eventos-chave · Meta: confirmar customs

**Decisão:** manter `AddToCart` / `Purchase` no Meta.

---

## 2. Gancho VIP na personalização

**Status:** implementado localmente · **falta commit / deploy**

- [x] CTA “Crie um momento personalizado”
- [x] Copy de benefício + destaque visual (não-VIP)
- [x] Clique → VipPopup + `seja_vip`

---

## 3. Pesquisas in-app (MVP)

**Status:** implementado localmente · **falta commit / deploy + firestore.rules**

- [x] Perguntas: escolha / texto / foguinhos 0–5
- [x] Segmentos Homens · Mulheres · VIP · Todos
- [x] 1 ativa por vez · popup sessão · push no disparo
- [x] Admin: criar → disparar → resultados

### Deploy checklist
- [ ] Deploy Next.js (admin + app)
- [ ] Publicar `firestore.rules` (`surveys` / `surveyResponses`)
- [ ] Testar com segmento pequeno primeiro

---

## Próximo passo

Commit + deploy dos 3 itens juntos, depois publicar rules e testar no painel **Pesquisas**.
