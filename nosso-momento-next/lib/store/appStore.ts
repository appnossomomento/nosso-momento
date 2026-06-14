import { create } from 'zustand';
import type {
  Usuario,
  ParceiroData,
  Pareamento,
  Notificacao,
  Tarefa,
  MomentoMestre,
  DesafioSemanal,
  Memoria,
  ClimaItem,
  ConexaoAtiva,
  CarrinhoItem,
  PendingChallenge,
  LegalModalType,
  SystemModalType,
} from '@/lib/types';

// ── Formato do state ──────────────────────────────────────────
interface AppState {
  // Auth / usuário
  usuario: Usuario | null;
  authInitialized: boolean;

  // Pareamento
  pareado: boolean;
  parceiroData: ParceiroData | null;
  idPareamentoAmigavel: string | null;
  pareadoUid: string | null;
  parceiroTelefone: string | null;
  parceiroNome: string | null;
  parceiroApelido: string | null;
  pendingPartnerName: string | null;
  showPartnerInfo: boolean;
  pendingPairingRequest: unknown | null;
  pendingConviteLink: string | null;
  parceirosAtivos: Pareamento[];
  pairingTransition: boolean;
  incomingPairingDismissedId: string | null;

  // Notificações
  notificacoesTarefasNaoLidas: number;
  notificacoesPresentesNaoLidas: number;
  notificacoesConquistasNaoLidas: number;
  notificacoes: Notificacao[];
  notificacoesTab: string;

  // Desafios / Weekly Challenge
  pendingChallenge: PendingChallenge | null;
  pendingChallengeQueue: PendingChallenge[];
  showChallengePopup: boolean;
  desafiosPendentes: number;
  challengeSecondsLeft: number;
  challengeTimerId: ReturnType<typeof setTimeout> | null;
  challengeDeadline: number | null;
  activeWeeklyChallengeId: string | null;
  challengePopupOpenedAt: number;
  desafiosSemanais: DesafioSemanal[];
  weeklyChallengeFromServer: boolean;
  dismissedChallengeIds: string[];
  hasTriggeredFirstPairingChallenge: boolean;
  lastPairKey: string | null;
  desafiosCountdownId: ReturnType<typeof setInterval> | null;
  desafiosTab: string;
  showRealizadoPhotoPrompt: boolean;
  pendingRealizadoAction: unknown | null;
  pendingRealizadoPhotoData: string | null;
  pendingRealizadoPhotoFile: File | null;

  // Loja / Catálogo
  carrinho: CarrinhoItem[];
  momentosMestres: MomentoMestre[];
  showCartSidebar: boolean;

  // Memórias
  memoriasView: 'welcome' | 'feed';
  memoriasItems: Memoria[];
  memoriasLimit: number;
  memoriasHasMore: boolean;
  memoriasLoading: boolean;
  memoriasViewerIndex: number | null;
  showMemoriasViewer: boolean;
  memoriasMonth: string | null;
  memoriasPairId: string | null;
  memoriasPairMenuOpen: boolean;
  memoriasShareModalOpen: boolean;
  memoriasShareLastPhoto: string | null;
  memoriasSharePreviewOpen: boolean;
  memoriasSharePreviewUrl: string | null;
  memoriasSharePreviewFile: File | null;
  memoriasSharePreviewMode: string | null;
  memoriasShareGenerating: boolean;

  // UI Global
  showFoguinhosPopup: boolean;
  showAchievementsPopup: boolean;
  showPairingModal: boolean;
  showVipPopup: boolean;
  showLegalModal: boolean;
  legalModalType: LegalModalType | null;
  showInstagramModal: boolean;
  pendingCelebrationId: string | null;
  showEditNameModal: boolean;
  editNameValue: string;
  showSystemModal: boolean;
  systemModalType: SystemModalType;
  systemModalMessage: string;
  systemModalConfirmText: string;
  systemModalCancelText: string;
  systemModalOnConfirm: (() => void) | null;

  // Tarefas
  abaTarefasAtiva: string;
  tarefasCache: Tarefa[];

  // Conquistas
  conquistas: Record<string, boolean>;
  achievementStats: Record<string, number>;
  conquistasCategoria: string;

  // Clima
  climaSemana: ClimaItem[];
  climaHoje: { humor: string; registradoEm: unknown } | null;
  climaPartnerHoje: { humor: string; registradoEm: unknown } | null;

  // Multi-conexão (VIP)
  conexaoAtiva: ConexaoAtiva | null;
  conexaoAberta: ParceiroData | null;
  emContextoParceiro: boolean;

  // Extrato
  extratoItems: unknown[];
  extratoHasMore: boolean;
  extratoLoading: boolean;

  // FCM
  fcmToken: string | null;
  codigoUsuario: string | null;
  codigoDigitando: boolean;
  parceiroCodigo: string | null;

  // ── Actions ──────────────────────────────────────────────────
  set: (partial: Partial<AppState>) => void;
  reset: () => void;
}

const initialState: Omit<AppState, 'set' | 'reset'> = {
  usuario: null,
  authInitialized: false,
  pareado: false,
  parceiroData: null,
  idPareamentoAmigavel: null,
  pareadoUid: null,
  parceiroTelefone: null,
  parceiroNome: null,
  parceiroApelido: null,
  pendingPartnerName: null,
  showPartnerInfo: false,
  pendingPairingRequest: null,
  pendingConviteLink: null,
  parceirosAtivos: [],
  pairingTransition: false,
  incomingPairingDismissedId: null,
  notificacoesTarefasNaoLidas: 0,
  notificacoesPresentesNaoLidas: 0,
  notificacoesConquistasNaoLidas: 0,
  notificacoes: [],
  notificacoesTab: 'checkin',
  pendingChallenge: null,
  pendingChallengeQueue: [],
  showChallengePopup: false,
  desafiosPendentes: 0,
  challengeSecondsLeft: 0,
  challengeTimerId: null,
  challengeDeadline: null,
  activeWeeklyChallengeId: null,
  challengePopupOpenedAt: 0,
  desafiosSemanais: [],
  weeklyChallengeFromServer: false,
  dismissedChallengeIds: [],
  hasTriggeredFirstPairingChallenge: false,
  lastPairKey: null,
  desafiosCountdownId: null,
  desafiosTab: 'emAberto',
  showRealizadoPhotoPrompt: false,
  pendingRealizadoAction: null,
  pendingRealizadoPhotoData: null,
  pendingRealizadoPhotoFile: null,
  carrinho: [],
  momentosMestres: [],
  showCartSidebar: false,
  memoriasView: 'welcome',
  memoriasItems: [],
  memoriasLimit: 9,
  memoriasHasMore: false,
  memoriasLoading: false,
  memoriasViewerIndex: null,
  showMemoriasViewer: false,
  memoriasMonth: null,
  memoriasPairId: null,
  memoriasPairMenuOpen: false,
  memoriasShareModalOpen: false,
  memoriasShareLastPhoto: null,
  memoriasSharePreviewOpen: false,
  memoriasSharePreviewUrl: null,
  memoriasSharePreviewFile: null,
  memoriasSharePreviewMode: null,
  memoriasShareGenerating: false,
  showFoguinhosPopup: false,
  showAchievementsPopup: false,
  showPairingModal: false,
  showVipPopup: false,
  showLegalModal: false,
  legalModalType: null,
  showInstagramModal: false,
  pendingCelebrationId: null,
  showEditNameModal: false,
  editNameValue: '',
  showSystemModal: false,
  systemModalType: 'alert',
  systemModalMessage: '',
  systemModalConfirmText: 'OK',
  systemModalCancelText: 'Cancelar',
  systemModalOnConfirm: null,
  abaTarefasAtiva: 'recebidos',
  tarefasCache: [],
  conquistas: {},
  achievementStats: {},
  conquistasCategoria: 'engajamento',
  climaSemana: [],
  climaHoje: null,
  climaPartnerHoje: null,
  conexaoAtiva: null,
  conexaoAberta: null,
  emContextoParceiro: false,
  extratoItems: [],
  extratoHasMore: false,
  extratoLoading: false,
  fcmToken: null,
  codigoUsuario: null,
  codigoDigitando: false,
  parceiroCodigo: null,
};

export const useAppStore = create<AppState>((setStore) => ({
  ...initialState,
  set: (partial) => setStore((s) => ({ ...s, ...partial })),
  reset: () => setStore((s) => ({ ...s, ...initialState })),
}));
