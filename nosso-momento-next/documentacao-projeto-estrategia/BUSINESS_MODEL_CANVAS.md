# Business Model Canvas — Nosso Momento

> **Framework:** Business Model Canvas (Osterwalder / Strategyzer) — 9 blocos.
> **Objetivo:** visão única de como o Nosso Momento (NM) **cria, entrega e captura valor**, para orientar decisões de MVP e monetização.
>
> **Data:** Jul/2026 · **Status:** vivo · **Docs irmãos:** [`CANVAS_PROPOSTA_DE_VALOR.md`](./CANVAS_PROPOSTA_DE_VALOR.md) · [`BENCHMARK_MERCADO_RELACIONAMENTOS.md`](./BENCHMARK_MERCADO_RELACIONAMENTOS.md)

---

## Visão geral (mapa dos 9 blocos)

```
┌───────────────┬───────────────┬───────────────────────┬───────────────┬───────────────┐
│ 8. PARCERIAS  │ 7. ATIVIDADES │ 2. PROPOSTA DE VALOR   │ 4. RELAÇÃO    │ 1. SEGMENTOS  │
│    CHAVE      │    CHAVE      │                       │  C/ CLIENTE   │  DE CLIENTES  │
│               ├───────────────┤  "O jogo do casal:    ├───────────────┤               │
│ Firebase/GCP  │ Prod & conteúdo│  ganhe foguinhos,     │ Self-service  │ Casais BR     │
│ Vercel        │ (momentos)    │  viva momentos reais, │ + gamificação │ 22–40, já     │
│ Stores/Pgto   │ Curadoria IA  │  guarde memórias"     │ + comunidade  │ formados      │
│ Criadores/    ├───────────────┤                       ├───────────────┤ (+ VIP)       │
│ influencers   │ 6. RECURSOS   │                       │ 3. CANAIS     │               │
│               │    CHAVE      │                       │               │               │
│               │ App, marca,   │                       │ App stores,   │               │
│               │ base, dados   │                       │ orgânico/ADS  │               │
├───────────────┴───────────────┴───────────────────────┴───────────────┴───────────────┤
│ 9. ESTRUTURA DE CUSTOS                    │ 5. FONTES DE RECEITA                        │
│ Infra, dev, aquisição (CAC), conteúdo     │ Assinatura VIP (freemium), IAP foguinhos,   │
│                                           │ futuros: parcerias/afiliados                │
└───────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Segmentos de Clientes (Customer Segments)

| Segmento | Descrição | Prioridade |
|---|---|---|
| **Casais formados (core)** | Namorando/casados, 22–40, BR, na rotina | 🔴 Primário |
| **VIP (pagante)** | Quem quer momentos custom, multi-conexão (até 5), extras | 🔴 Monetização |
| Casais à distância | Precisam mais de ritual/conexão remota | 🟠 Secundário (pós-MVP) |
| Casais recém-formados | Início da relação, alta empolgação | 🟠 Secundário |

> **Nota de modelo:** o NM tem característica de **2 lados no mesmo par** (quem resgata × quem recebe/realiza). O valor só "fecha" quando **ambos** engajam — retenção depende do par, não do indivíduo.

---

## 2. Proposta de Valor (Value Propositions)

**Central:** *"O jogo do casal — ganhe foguinhos cuidando um do outro, troque por momentos de verdade e guarde cada memória."*

| Para o casal | Diferencial (moat) |
|---|---|
| Ideias prontas p/ sair da rotina | Loop **foguinho → loja → momento real → foto → memória** |
| Relação com leveza de jogo | Economia interna + loja (ninguém no nicho tem) |
| Recompensa por se cuidar | Gamificação afetiva |
| Memórias com foto/stats | Registro do "quanto viveram" |
| Personalização (VIP) | Momentos custom + até 5 conexões |
| Cultura BR | Tom leve, categorias "Lovezin/Rotina/Quentes" |

> Detalhe completo em [`CANVAS_PROPOSTA_DE_VALOR.md`](./CANVAS_PROPOSTA_DE_VALOR.md).

---

## 3. Canais (Channels)

| Fase | Canal | Papel |
|---|---|---|
| **Descoberta** | Instagram/TikTok orgânico (conteúdo de casal), ASO nas stores | Awareness |
| **Descoberta** | Influenciadores de relacionamento/lifestyle | Alcance + prova social |
| **Descoberta** | Paid ADS (Meta/TikTok) | Escala (após validar CAC) |
| **Avaliação** | Landing page (`nossomomento.app` / acesso antecipado) | Conversão em cadastro |
| **Compra** | App Store / Google Play (PWA/stores) | Instalação |
| **Entrega** | O próprio app (PWA Next.js) | Uso |
| **Pós-venda** | Notificações push, e-mail, `faleconosco@nossomomento.app` | Retenção/suporte |

> **Viralidade embutida:** o pareamento (convite ao par) é canal de aquisição **orgânico** — cada usuário traz +1 por design.

---

## 4. Relacionamento com Clientes (Customer Relationships)

| Tipo | Como se manifesta no NM |
|---|---|
| **Self-service** | App autônomo, onboarding guiado |
| **Automação/gamificação** | Foguinhos, desafios, streak, notificações segmentadas |
| **Assistido (VIP)** | Canal `faleconosco@` para upgrade VIP (billing manual nesta fase) |
| **Comunidade (futuro)** | Conteúdo, dicas, UGC de casais |
| **Retenção emocional** | Memórias + progresso criam custo de troca afetivo ("nosso histórico está aqui") |

---

## 5. Fontes de Receita (Revenue Streams)

| Fonte | Status | Descrição |
|---|---|---|
| **Assinatura VIP (freemium)** | 🟢 Core | Free = 1 conexão; VIP = até 5 + momentos custom + extras. Hoje flag manual + `VipPopup`; **sem Stripe/IAP ainda** |
| **IAP de foguinhos** (compra de moeda) | 🟡 Potencial | Comprar foguinhos p/ resgatar mais momentos |
| **Momentos premium/pacotes** | 🟡 Potencial | Packs temáticos (ex.: "Ventas Dia dos Namorados", "Quentes+") |
| **Parcerias/afiliados** | 🔵 Futuro | Momentos ligados a experiências reais (restaurante, viagem, presente) → comissão |
| **White-label / B2B2C** | 🔵 Futuro | Terapeutas, apps de casamento, planos de saúde |

**Modelo primário do MVP:** **Freemium → Assinatura VIP.**
Métricas a acompanhar: conversão free→VIP, ARPU, churn, LTV.

> ⚠️ Antes do MVP escalar, **implementar billing real** (Stripe/IAP das lojas) — hoje o VIP é manual (ver `PROMPT_IMPLEMENTACAO_VIP_MONETIZACAO.md`).

---

## 6. Recursos-Chave (Key Resources)

| Recurso | Tipo | Nota |
|---|---|---|
| App (Next.js + Firebase + Cloud Functions) | Tecnológico | Ativo principal |
| Catálogo de momentos (mestres + custom) | Conteúdo/IP | Coração do valor |
| Marca "Nosso Momento" | Intangível | Tom afetivo BR |
| Base de casais + dados de engajamento | Dado | Vira curadoria/IA e defensabilidade |
| Motor de IA (desafios/curadoria) | Tecnológico | Gera conteúdo em escala |
| Equipe (produto/dev/conteúdo) | Humano | Enxuta na fase MVP |

---

## 7. Atividades-Chave (Key Activities)

| Atividade | Por quê |
|---|---|
| Desenvolvimento e estabilidade do app | Loop de foguinhos tem que ser impecável (é o moat) |
| Curadoria/criação de momentos e desafios | Conteúdo fresco = retenção |
| Aquisição e ativação (marketing + onboarding) | Vencer inércia do gratuito |
| Análise de dados/retenção (D1/D7/D30) | Iterar product-market fit |
| Gestão de monetização (VIP/billing) | Capturar valor |
| Suporte e comunidade | Confiança/retenção |

---

## 8. Parcerias-Chave (Key Partnerships)

| Parceiro | Papel | Fase |
|---|---|---|
| Google Firebase / GCP | Infra (DB, Auth, Storage, Functions) | 🟢 Atual |
| Vercel | Hospedagem do frontend | 🟢 Atual |
| App Store / Google Play | Distribuição + billing IAP | 🟡 MVP |
| Gateway de pagamento (Stripe) | Assinatura VIP web | 🟡 MVP |
| Influenciadores/criadores | Aquisição + prova social | 🟡 MVP |
| Marcas de experiência (restaurantes, viagens, presentes) | Momentos monetizáveis/afiliados | 🔵 Futuro |
| Terapeutas/profissionais de relacionamento | Credibilidade + conteúdo | 🔵 Futuro |

---

## 9. Estrutura de Custos (Cost Structure)

| Custo | Tipo | Nota |
|---|---|---|
| Infra (Firebase/GCP, Vercel) | Variável | Escala com uso; barato no início |
| Desenvolvimento (dev/produto) | Fixo | Maior custo na fase atual |
| Aquisição de clientes (CAC) | Variável | Vira o gargalo ao escalar — vigiar CAC vs. LTV |
| Conteúdo (momentos, desafios, IA) | Semi-fixo | Custo de IA + curadoria |
| Suporte e operação | Variável | Cresce com base |
| Taxas de loja/pagamento | Variável | 15–30% stores + gateway |

**Perfil de custo:** **value-driven** (produto premium/afetivo), enxuto na infra, com CAC como principal risco de escala.

---

## 10. Síntese & alavancas críticas

| # | Alavanca | Por quê importa |
|---|---|---|
| 1 | **Loop de foguinhos impecável** | É o moat e o motor de retenção |
| 2 | **Conversão free→VIP + billing real** | Sem isso não há captura de valor |
| 3 | **Onboarding + ativação do par** | Valor só fecha com os dois engajados |
| 4 | **CAC < LTV** | Define a viabilidade da escala |
| 5 | **Viralidade do pareamento** | Aquisição orgânica embutida — potencializar |

### Riscos do modelo (resumo)
- **Retenção depende do par** (churn de um derruba o outro).
- **Monetização ainda manual** — billing é pré-requisito de escala.
- **CAC** pode inviabilizar paid se a conversão VIP for baixa.
- **Inércia do gratuito** (WhatsApp) exige proposta de valor muito clara.

---

### Notas
- Documento **vivo**: revisar a cada ciclo e após primeiras métricas (D1/D7/D30, conversão VIP, CAC/LTV).
- Alinhado ao roadmap de monetização em `PROMPT_IMPLEMENTACAO_VIP_MONETIZACAO.md`.
