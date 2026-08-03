'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAuthenticatedRedirect } from '@/lib/hooks/useAuthenticatedRedirect';
import { useParceiroData } from '@/lib/hooks/useParceiroData';
import { useConquistas } from '@/lib/hooks/useConquistas';
import { useChallenge } from '@/lib/hooks/useChallenge';
import { useMomentosMestres } from '@/lib/hooks/useMomentosMestres';
import { useClimaData } from '@/lib/hooks/useClimaData';
import Toast from '@/components/ui/Toast';
import Modal from '@/components/ui/Modal';
import LegalModal from '@/components/ui/LegalModal';
import PairingModal from '@/components/PairingModal';
import VipPopup from '@/components/VipPopup';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import AchievementCelebration from '@/components/AchievementCelebration';
import InstagramModal from '@/components/InstagramModal';
import { usePareamentoListeners } from '@/lib/hooks/usePareamentoListeners';
import { useNotificacoes } from '@/lib/hooks/useNotificacoes';
import { useFCM } from '@/lib/hooks/useFCM';
import { usePendingSurvey } from '@/lib/hooks/usePendingSurvey';

/** Modais pesados: code-split — mesma UX, menos JS no boot do app. */
const FoguinhosPopup = dynamic(() => import('@/components/dashboard/FoguinhosPopup'), {
  ssr: false,
});
const AchievementsPopup = dynamic(() => import('@/components/dashboard/AchievementsPopup'), {
  ssr: false,
});
const MemoriaViewer = dynamic(() => import('@/components/memorias/MemoriaViewer'), {
  ssr: false,
});
const ShareModal = dynamic(() => import('@/components/memorias/ShareModal'), {
  ssr: false,
});
const ChallengePopup = dynamic(() => import('@/components/ChallengePopup'), {
  ssr: false,
});
const SurveyPopup = dynamic(() => import('@/components/SurveyPopup'), {
  ssr: false,
});

const ADMIN_PREFIX = '/paineladmin-monitoring-v0';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isAdmin = pathname.startsWith(ADMIN_PREFIX);

  useAuth();
  useAuthenticatedRedirect();
  useParceiroData();
  useConquistas();
  useChallenge();
  useMomentosMestres();
  useClimaData();
  usePareamentoListeners();
  useNotificacoes();
  useFCM();
  usePendingSurvey();

  // Painel admin: sem overlays/popups do app (pesquisa, VIP, etc.).
  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <Toast />
      <Modal />
      <LegalModal />
      <FoguinhosPopup />
      <AchievementsPopup />
      <MemoriaViewer />
      <ShareModal />
      <ChallengePopup />
      <PairingModal />
      <VipPopup />
      <SurveyPopup />
      <PwaInstallPrompt />
      <AchievementCelebration />
      <InstagramModal />
    </>
  );
}
