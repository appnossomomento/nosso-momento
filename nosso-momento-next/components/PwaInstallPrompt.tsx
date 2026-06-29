'use client';

import { useEffect, useRef, useState } from 'react';
import OverlayModal from '@/components/ui/OverlayModal';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_SESSION_KEY = 'pwa_install_dismissed';
const ADDED_KEY = 'pwa_install_added';

function isRunningAsPWA(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    (window.navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

function shouldShow(): boolean {
  if (isRunningAsPWA()) return false;
  if (localStorage.getItem(ADDED_KEY)) return false;
  if (sessionStorage.getItem(DISMISSED_SESSION_KEY)) return false;
  return true;
}

type Platform = 'native' | 'ios' | 'other';

function getPlatform(hasNativePrompt: boolean): Platform {
  if (hasNativePrompt) return 'native';
  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return 'ios';
  return 'other';
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <span className="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold">
        {n}
      </span>
      <p className="text-sm">{children}</p>
    </div>
  );
}

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>('other');
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Captura prompt nativo (Android Chrome / Edge)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      if (shouldShow()) {
        setPlatform('native');
        setVisible(true);
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Para iOS / outros: mostra instruções manuais após 4s
    const timer = setTimeout(() => {
      if (!deferredPrompt.current && shouldShow()) {
        setPlatform(getPlatform(false));
        setVisible(true);
      }
    }, 4000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearTimeout(timer);
    };
  }, []);

  function dismissSession() {
    sessionStorage.setItem(DISMISSED_SESSION_KEY, '1');
    setVisible(false);
  }

  function dismissPermanent() {
    localStorage.setItem(ADDED_KEY, '1');
    setVisible(false);
  }

  async function handleInstall() {
    if (!deferredPrompt.current) return;
    await deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    if (outcome === 'accepted') {
      dismissPermanent();
    } else {
      dismissSession();
    }
  }

  if (!visible) return null;

  return (
    <OverlayModal
      open={visible}
      onClose={dismissSession}
      zIndex={9998}
      backdropClassName="bg-black/80 backdrop-blur-sm"
      maxWidth="max-w-md"
      panelClassName="text-white border border-white/10 p-6 pb-8 bg-[#1a1025] animate-[pwaModalIn_0.3s_ease-out]"
      ariaLabel="Instalar aplicativo"
    >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/icons/iconprincipal.png"
              className="w-12 h-12 rounded-2xl"
              alt="Nosso Momento"
            />
            <div>
              <h3 className="text-lg font-bold">Instale o App</h3>
              <p className="text-xs text-white/50">Nosso Momento</p>
            </div>
          </div>
          <button
            onClick={dismissSession}
            className="text-white/40 hover:text-white/70 p-1 transition"
            aria-label="Fechar"
          >
            <i className="fas fa-times text-lg" />
          </button>
        </div>

        {/* Android Chrome — prompt nativo */}
        {platform === 'native' && (
          <>
            <p className="text-sm text-white/70 mb-5">
              Instale o app direto no seu celular para a melhor experiência!
            </p>
            <button
              onClick={handleInstall}
              className="w-full py-3 rounded-xl font-semibold text-white mb-3 transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #ff2d3f, #ff5565)' }}
            >
              <i className="fas fa-download mr-2" />Instalar Agora
            </button>
          </>
        )}

        {/* iOS Safari */}
        {platform === 'ios' && (
          <>
            <p className="text-sm text-white/70 mb-3">
              Para a melhor experiência, adicione à sua tela inicial:
            </p>
            <div className="space-y-2 mb-5">
              <Step n={1}>
                Toque em <i className="fas fa-share-from-square text-blue-400 mx-1" />
                <strong>Compartilhar</strong> (barra inferior do Safari)
              </Step>
              <Step n={2}>Toque em <strong>Adicionar à Tela de Início</strong></Step>
              <Step n={3}>Toque em <strong>Adicionar</strong> — pronto!</Step>
            </div>
          </>
        )}

        {/* Outros navegadores */}
        {platform === 'other' && (
          <>
            <p className="text-sm text-white/70 mb-3">
              Para a melhor experiência, adicione à sua tela inicial:
            </p>
            <div className="space-y-2 mb-5">
              <Step n={1}>
                Toque no menu <i className="fas fa-ellipsis-vertical text-white/80 mx-1" /> do navegador
              </Step>
              <Step n={2}>
                Selecione <strong>&ldquo;Instalar aplicativo&rdquo;</strong> ou{' '}
                <strong>&ldquo;Adicionar à tela inicial&rdquo;</strong>
              </Step>
            </div>
          </>
        )}

        {/* Botões de ação */}
        <div className="flex gap-3 mt-1">
          <button
            onClick={dismissPermanent}
            className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #ff2d3f, #ff5565)' }}
          >
            <i className="fas fa-check mr-1.5" />Já Adicionei
          </button>
          <button
            onClick={dismissSession}
            className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/70 text-sm font-semibold hover:bg-white/20 transition"
          >
            Agora não
          </button>
        </div>

      <style>{`
        @keyframes pwaModalIn {
          from { transform: scale(0.96); opacity: 0; }
          to   { transform: scale(1);    opacity: 1; }
        }
      `}</style>
    </OverlayModal>
  );
}
