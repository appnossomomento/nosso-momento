'use client';

import { useAuth } from '@/lib/hooks/useAuth';
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
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import AchievementCelebration from '@/components/AchievementCelebration';
import InstagramModal from '@/components/InstagramModal';
import { usePareamentoListeners } from '@/lib/hooks/usePareamentoListeners';
import { useNotificacoes } from '@/lib/hooks/useNotificacoes';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  useAuth();
  useParceiroData();
  useConquistas();
  useChallenge();
  useMomentosMestres();
  useClimaData();
  usePareamentoListeners();
  useNotificacoes();

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
      <PwaInstallPrompt />
      <AchievementCelebration />
      <InstagramModal />
    </>
  );
}
