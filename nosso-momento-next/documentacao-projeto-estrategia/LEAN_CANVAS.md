# Lean Canvas — Nosso Momento

> **Framework:** Lean Canvas (Ash Maurya — adaptação do BMC para startups/MVP).
> **Objetivo:** focar no que mata a startup — **problema, solução, métricas e vantagem injusta** — para o lançamento do MVP e pitch.
>
> **Data:** Jul/2026 · **Status:** vivo · **Docs irmãos:** [`BUSINESS_MODEL_CANVAS.md`](./BUSINESS_MODEL_CANVAS.md) · [`CANVAS_PROPOSTA_DE_VALOR.md`](./CANVAS_PROPOSTA_DE_VALOR.md) · [`BENCHMARK_MERCADO_RELACIONAMENTOS.md`](./BENCHMARK_MERCADO_RELACIONAMENTOS.md)

---

## Visão geral (os 9 blocos)

```
┌────────────────┬────────────────┬────────────────┬────────────────┬────────────────┐
│ 1. PROBLEMA    │ 4. SOLUÇÃO     │ 3. PROPOSTA DE │ 9. VANTAGEM    │ 2. SEGMENTOS   │
│                │                │    VALOR ÚNICA │    INJUSTA     │    DE CLIENTES │
│ • rotina       │ • momentos     │                │                │                │
│ • falta ideia  │ • foguinhos    │ "O jogo do     │ Loop economia+ │ Casais BR      │
│ • cada um na   │ • loja/memórias│  casal"        │ loja+memória   │ 22–40, já      │
│   tela         ├────────────────┤                ├────────────────┤ formados       │
│                │ 8. MÉTRICAS-   │ + conceito de  │ 5. CANAIS      │                │
│ Alternativas:  │    CHAVE       │  alto nível    │                │ Early adopters:│
│ WhatsApp, nada │ ativação par,  │                │ orgânico social│ casal "nerd de │
│                │ D7, free→VIP   │                │ + pareamento   │ relação"       │
├────────────────┴────────────────┴────────────────┴────────────────┴────────────────┤
│ 7. ESTRUTURA DE CUSTOS                        │ 6. FONTES DE RECEITA                 │
│ infra, dev, CAC, conteúdo/IA                  │ assinatura VIP (freemium), IAP, packs│
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Problema

**Top 3 problemas do casal formado:**
1. **Caiu na rotina** — "a gente não faz mais nada diferente junto".
2. **Falta de ideia/energia** — planejar algo a dois dá trabalho.
3. **Distância na convivência** — cada um no próprio celular; a relação esfria sem ninguém perceber.

### Alternativas existentes (o que usam hoje)
| Alternativa | Por que não resolve |
|---|---|
| **WhatsApp / redes** | Comunicam, mas não geram ideias nem ação — e viciam na tela |
| **"Não usar nada"** | A inércia; rotina segue sem intervenção |
| Listas de "date ideas" no Google/Pinterest | Passivo, esquecível, sem engajamento do par |
| Apps de casal gringos (Paired) | Em inglês, frios, sem recompensa/ação real |

> **Concorrente nº1 = a inércia do gratuito.** A comunicação precisa vencer o "a gente já se vira".

---

## 2. Segmentos de Clientes

**Alvo:** casais formados (namorando/casados), 22–40, Brasil, smartphone.

### Early adopters (quem testa primeiro)
> O casal **"antenado em relacionamento"**: consome conteúdo de casal, gosta de gamificação/apps, quer "cuidar da relação" de forma leve. Geralmente **1 dos dois** puxa (o "organizador afetivo") e arrasta o par.

---

## 3. Proposta de Valor Única (UVP)

> ### "O jogo do casal: ganhe foguinhos cuidando um do outro, troque por momentos de verdade e guarde cada memória."

**Conceito de alto nível (X para Y):** *"O Duolingo do relacionamento"* — gamificação que cria hábito diário de cuidar do amor.

---

## 4. Solução

Para cada problema, a feature que resolve:

| Problema | Solução (feature NM) |
|---|---|
| Rotina | **Momentos** + **desafios** semanais: sempre há algo novo pra fazer |
| Falta de ideia/energia | **Catálogo pronto** — resgatar é 1 toque, zero planejamento |
| Cada um na tela | Momentos = **ação no mundo real**, fora do app |
| Relação esfria sem perceber | **Clima** (check-in de humor) + **foguinhos** que recompensam se cuidar |
| Falta de registro/orgulho | **Memórias** com foto e stats mensais |
| Personalização/intimidade | **Momentos custom (VIP)** + categoria **"Quentes"** |

**Escopo do MVP (mínimo viável):** loop `foguinho → loja → momento → foto → memória` **impecável** + onboarding do par + categoria Quentes decente.

---

## 5. Canais

| Fase | Canal |
|---|---|
| Aquisição orgânica | Instagram/TikTok (conteúdo de casal), ASO |
| Prova social | Influenciadores de relacionamento/lifestyle |
| **Viralidade embutida** | **Pareamento** — cada usuário convida o par (+1 por design) |
| Conversão | Landing page (acesso antecipado / `nossomomento.app`) |
| Escala (pós-validação) | Paid ADS (Meta/TikTok) quando CAC < LTV |
| Retenção | Push segmentado, e-mail |

---

## 6. Fontes de Receita

| Fonte | Status |
|---|---|
| **Assinatura VIP (freemium)** — free = 1 conexão; VIP = até 5 + momentos custom | 🟢 Core do MVP |
| IAP de foguinhos (comprar moeda) | 🟡 Potencial |
| Packs de momentos premium (temáticos) | 🟡 Potencial |
| Afiliados/experiências (restaurante, viagem, presente) | 🔵 Futuro |

> ⚠️ Billing hoje é **manual** (flag + `VipPopup`). **Implementar Stripe/IAP é pré-requisito de escala.**

---

## 7. Estrutura de Custos

| Custo | Nota |
|---|---|
| Infra (Firebase/GCP, Vercel) | Baixo no início, escala com uso |
| Desenvolvimento (produto/dev) | Maior custo atual |
| **CAC (aquisição)** | Principal risco de escala — vigiar vs. LTV |
| Conteúdo/IA (momentos, desafios) | Semi-fixo |
| Taxas de loja/pagamento | 15–30% |

---

## 8. Métricas-Chave

**A "1 métrica que importa" (OMTM) no MVP:** _% de casais que completam ≥1 momento na 1ª semana_ (ativação real do par).

| Etapa (funil AARRR) | Métrica | Alvo inicial (hipótese) |
|---|---|---|
| **Ativação** | Par pareado + 1º momento resgatado | > 40% dos cadastros |
| **Ativação** | Ambos do par engajam (não só quem convidou) | monitorar de perto |
| **Retenção** | D7 (voltou em 7 dias) | > 25% |
| **Retenção** | D30 | > 12% |
| **Receita** | Conversão free → VIP | 3–5% |
| **Receita** | ARPU / LTV | acompanhar vs. CAC |
| **Indicação** | Convites de pareamento por usuário | > 1 (viral) |

> Números são **hipóteses de partida** — ajustar com dados reais do MVP.

---

## 9. Vantagem Injusta (Unfair Advantage)

O que é **difícil de copiar ou comprar**:

| Vantagem | Por que é defensável |
|---|---|
| **Loop economia + loja + ação real + memória** | Nenhum concorrente combina os quatro; replicar exige refazer o produto inteiro |
| **Custo de troca afetivo** | Histórico/memórias do casal ficam no NM → sair dói |
| **Cultura BR + tom** | Difícil de um gringo (Paired) replicar autenticamente |
| **Dados de engajamento do casal** | Alimentam curadoria/IA — melhora com escala (efeito de dados) |
| **Viralidade do par** | Aquisição orgânica embutida no produto |

> **Honestidade:** "gamificação" e "momentos" **isolados** são copiáveis. A vantagem real é o **loop completo + histórico do casal + cultura** juntos.

---

## 10. Síntese — os 3 riscos que decidem o jogo

| # | Risco | Como testar/mitigar no MVP |
|---|---|---|
| 1 | **Ativação do par** (o segundo não engaja) | Medir OMTM; onboarding pensado para os DOIS |
| 2 | **Retenção** (loop vicia ou não?) | D7/D30; ritual diário (streak) se cair |
| 3 | **Monetização** (free→VIP + billing real) | Implementar billing; testar conversão cedo |

---

### Notas
- Lean Canvas prioriza **problema e tração**; use-o para o pitch e para decidir o que **não** fazer no MVP.
- Documento **vivo** — revisar a cada validação/pivot e após primeiras métricas.
