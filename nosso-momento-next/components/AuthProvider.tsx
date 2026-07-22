'use client';

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
import FoguinhosPopup from '@/components/dashboard/FoguinhosPopup';
import AchievementsPopup from '@/components/dashboard/AchievementsPopup';
import MemoriaViewer from '@/components/memorias/MemoriaViewer';
import ShareModal from '@/components/memorias/ShareModal';
import ChallengePopup from '@/components/ChallengePopup';
import PairingModal from '@/components/PairingModal';
import VipPopup from '@/components/VipPopup';
import SurveyPopup from '@/components/SurveyPopup';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import AchievementCelebration from '@/components/AchievementCelebration';
import InstagramModal from '@/components/InstagramModal';
import { usePareamentoListeners } from '@/lib/hooks/usePareamentoListeners';
import { useNotificacoes } from '@/lib/hooks/useNotificacoes';
import { useFCM } from '@/lib/hooks/useFCM';
import { usePendingSurvey } from '@/lib/hooks/usePendingSurvey';

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
