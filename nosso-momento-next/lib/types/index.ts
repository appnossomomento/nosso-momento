// ── Tipos principais ──────────────────────────────────────────

export interface CatalogoCfg {
  preco?: number;
  bloqueado?: boolean;
  excluido?: boolean;
}

export interface MomentoCustom {
  id: string;
  nome: string;
  preco: number;
  emoji?: string;
  img?: string;
  categoria?: string;
  ativo?: boolean;
  criadorUid?: string;
  criadoEm?: unknown;
}

export interface Usuario {
  uid: string;
  email?: string;
  nome?: string;
  telefone?: string;
  sexo?: string;
  foguinhos?: number;
  lastCheckInDate?: string | null;
  pareadoCom?: string | null;
  pareadoUid?: string | null;
  pareadoDesde?: string | null;
  catalogoPersonalizado?: Record<string, unknown>;
  fotoUrl?: string;
  /** Apelido curto do próprio usuário (card Stories). Distinto de pareamentosAtivos[].apelido */
  apelidoReal?: string;
  /** @deprecated raiz — usar pareamentosAtivos[].apelido para apelido ao parceiro */
  apelido?: string;
  /** masculino | feminino — filtro catálogo loja (alias legado: sexo) */
  anatomia?: string;
  sobrenome?: string;
  idade?: number;
  dataNascimento?: string;
  diaNascimento?: number;
  mesNascimento?: number;
  anoNascimento?: number;
  estado?: string;
  cidade?: string;
  genero?: string;
  generoOutro?: string;
  orientacaoSexual?: string;
  orientacaoSexualOutro?: string;
  estadoCivil?: string;
  tempoRelacionamento?: string | null;
  vip?: boolean;
  pareamentosAtivos?: Array<Record<string, unknown>>;
  conquistas?: Record<string, boolean>;
  achievementStats?: Record<string, number>;
  createdAt?: unknown;
  [key: string]: any;
}

export interface ParceiroData {
  uid: string;
  nome: string;
  telefone?: string;
  email?: string;
  foguinhos?: number;
  fotoUrl?: string;
  apelidoReal?: string;
  anatomia?: string;
  sexo?: string;
  pareadoCom?: string | null;
  catalogoPersonalizado?: Record<string, CatalogoCfg>;
  [key: string]: unknown;
}

export interface Pareamento {
  uid: string;
  nome: string;
  fotoUrl?: string;
  foguinhos?: number;
  pareamentoId: string;
}

export interface Notificacao {
  id: string;
  tipo: string;
  mensagem: string;
  lida: boolean;
  criadoEm: unknown;
  [key: string]: unknown;
}

export interface Tarefa {
  id: string;
  tipo: string;
  titulo?: string;
  descricao?: string;
  enviado?: boolean;
  concluido?: boolean;
  criadoEm?: unknown;
  [key: string]: unknown;
}

export interface MomentoMestre {
  id: string;
  nome: string;
  titulo?: string;
  descricao?: string;
  categoria: string;
  targetGender?: string;
  intensidade?: number;
  img?: string;
  foto?: string;
  emoji?: string;
}

export interface DesafioSemanal {
  id: string;
  titulo: string;
  descricao?: string;
  deadline?: string;
  [key: string]: unknown;
}

export interface Memoria {
  id: string;
  url: string;
  thumbnailUrl?: string;
  criadoEm?: unknown;
  tipo?: string;
  [key: string]: unknown;
}

export interface ClimaItem {
  data: string;
  label: string;
  humor?: string | null;
  partnerHumor?: string | null;
  isHoje?: boolean;
}

export interface ConexaoAtiva {
  uid: string;
  nome: string;
  fotoUrl?: string;
  pareamentoId: string;
  idAmigavel: string;
  foguinhos?: number;
}

export interface CarrinhoItem {
  id: string;
  titulo: string;
  preco?: number;
  quantidade: number;
  foto?: string;
}

export interface PendingChallenge {
  id: string;
  titulo: string;
  descricao?: string;
  deadline?: number;
  tipo?: 'pergunta' | 'escolha' | 'roleta';
  opcaoA?: string;
  opcaoB?: string;
  pergunta?: string;
  penalty?: number;
  rouletteOptions?: { valor: number; prob: number }[];
  meuResultado?: number | null;
  aguardandoParceiro?: boolean;
  resultadoFinal?: number | null;
  [key: string]: unknown;
}

export type LegalModalType = 'terms' | 'privacy';
export type SystemModalType = 'alert' | 'confirm';
export type Etapa =
  | 'landing'
  | 'signIn'
  | 'register'
  | 'dashboard'
  | 'parear'
  | 'pareamentos'
  | 'notificacoes'
  | 'meuPerfil'
  | 'perfilParceiro'
  | 'tarefas'
  | 'memorias'
  | 'loja'
  | 'selecionarConexao'
  | string;
