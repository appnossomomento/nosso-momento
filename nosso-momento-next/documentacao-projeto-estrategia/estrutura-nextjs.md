# Estrutura Next.js — Nosso Momento

```
nosso-momento/
├── app/                          # App Router (Next.js 14+)
│   ├── layout.tsx                # Layout raiz (fontes, providers)
│   ├── page.tsx                  # Landing page (/)
│   ├── (auth)/                   # Grupo de rotas sem layout próprio
│   │   ├── login/page.tsx
│   │   ├── cadastro/page.tsx
│   │   └── recuperar-senha/page.tsx
│   ├── (app)/                    # Área autenticada
│   │   ├── layout.tsx            # Middleware de auth + shell do app
│   │   ├── dashboard/page.tsx
│   │   ├── desafios/page.tsx
│   │   ├── memorias/page.tsx
│   │   ├── perfil/page.tsx
│   │   └── parear/page.tsx
│   ├── convite/[token]/page.tsx  # Rota do link de convite
│   └── api/                      # API Routes (ou usar Firebase Functions)
│       └── webhook/route.ts
│
├── components/
│   ├── ui/                       # Componentes genéricos (Button, Input, Modal...)
│   ├── auth/                     # LoginForm, RegisterForm, TermosModal
│   ├── dashboard/                # Cards, timeline, conquistas
│   ├── desafios/                 # ChallengeCard, WeeklyList
│   └── layout/                  # Navbar, BottomNav, Toast
│
├── lib/
│   ├── firebase/
│   │   ├── client.ts             # Firebase client SDK (v9 modular)
│   │   └── admin.ts              # Firebase Admin SDK (server-side)
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useParceiroData.ts
│   │   └── useConquistas.ts
│   ├── store/                    # Zustand ou Context
│   │   └── appStore.ts
│   └── utils/
│       ├── formatDate.ts
│       └── validations.ts
│
├── styles/
│   └── globals.css               # Tailwind @layer base/components
│
├── public/
│   ├── icons/
│   └── firebase-messaging-sw.js
│
├── middleware.ts                 # Proteção de rotas autenticadas
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── .env.local                    # Variáveis Firebase (NEXT_PUBLIC_*)
└── package.json
```

## Correspondência com o HTML atual

| HTML atual (função) | Next.js |
|---|---|
| `renderLanding()` | `app/page.tsx` |
| `renderSignIn()` | `app/(auth)/login/page.tsx` |
| `renderRegister()` | `app/(auth)/cadastro/page.tsx` |
| `renderDashboard()` | `app/(app)/dashboard/page.tsx` |
| `renderDesafios()` | `app/(app)/desafios/page.tsx` |
| `renderMeuPerfil()` | `app/(app)/perfil/page.tsx` |
| `renderParear()` | `app/(app)/parear/page.tsx` |
| `aceitarConviteLink()` | `app/convite/[token]/page.tsx` |
| `state` global | `lib/store/appStore.ts` (Zustand) |
| `openSystemAlert()` | `components/ui/Modal.tsx` |
| `showToast()` | `components/ui/Toast.tsx` |
| `handleRegister()` | lógica dentro de `RegisterForm` + hook `useAuth` |
| Firebase Functions | mantidas em `functions/` (sem mudança) |

## Stack recomendada para a migração

- **Framework**: Next.js 15 (App Router)
- **Linguagem**: TypeScript
- **Estilo**: Tailwind CSS v4 (com purge — sem CDN)
- **Estado global**: Zustand
- **Firebase**: SDK v9 modular (tree-shakeable)
- **Deploy frontend**: Vercel (igual ao atual)
- **Deploy backend**: Firebase Functions (sem mudança)
