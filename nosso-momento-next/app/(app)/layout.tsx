'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAppStore } from '@/lib/store/appStore';
import clsx from 'clsx';
import AppLoadingScreen from '@/components/ui/AppLoadingScreen';

const CENTER_LOGO = '/assets/icons/logo-icon-white-bottom.png';

const NAV_ITEMS = [
  { href: '/dashboard', icon: 'fa-house', label: 'Início' },
  { href: '/notificacoes', icon: 'fa-bell', label: 'Notificações' },
  { href: '/parceiro', icon: 'fa-heart', label: '', center: true },
  { href: '/memorias', icon: 'fa-book-open', label: 'Memórias' },
  { href: '/perfil', icon: 'fa-user', label: 'Perfil' },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const usuario = useAppStore((s) => s.usuario);
  const authInitialized = useAppStore((s) => s.authInitialized);
  const desafiosPendentes = useAppStore((s) => s.desafiosPendentes);
  const notificacoesTarefasNaoLidas = useAppStore((s) => s.notificacoesTarefasNaoLidas);
  const notificacoesPresentesNaoLidas = useAppStore((s) => s.notificacoesPresentesNaoLidas);
  const notificacoesConquistasNaoLidas = useAppStore((s) => s.notificacoesConquistasNaoLidas);
  const notifPendentes =
    (notificacoesTarefasNaoLidas ?? 0) +
    (notificacoesPresentesNaoLidas ?? 0) +
    (notificacoesConquistasNaoLidas ?? 0);

  // Redireciona para /login apenas depois que o Firebase confirmou o estado de auth.
  // Usar authInitialized evita redirect prematuro durante inicialização (hard navigation).
  useEffect(() => {
    if (authInitialized && !usuario) {
      router.replace('/login');
    }
  }, [authInitialized, usuario, router]);

  if (!authInitialized || !usuario) {
    return (
      <AppLoadingScreen
        message={!authInitialized ? 'Carregando...' : 'Redirecionando...'}
      />
    );
  }

  return (
    <div className="bg-black min-h-screen">
      {children}

      {/* Bottom Navigation */}
      <nav className="bottom-nav-bar">
        {NAV_ITEMS.map((item) => {
          if (item.center) {
            const centerHref = '/parceiro';
            const centerActive = pathname === '/parceiro';
            return (
              <Link
                key="center"
                href={centerHref}
                className="flex items-center justify-center flex-grow"
                aria-label="Parceiro"
              >
                <div
                  className={clsx('bottom-nav-item-center', centerActive && 'ring-2 ring-white/30')}
                  style={{ position: 'relative' }}
                >
                  <Image
                    src={CENTER_LOGO}
                    alt=""
                    width={36}
                    height={36}
                    className="object-contain"
                    style={{ width: 36, height: 36 }}
                    priority
                  />
                  {desafiosPendentes > 0 && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500"
                      style={{ boxShadow: '0 0 0 2px #000' }}
                    />
                  )}
                </div>
              </Link>
            );
          }
          const isActive = pathname === item.href;
          const showNotifDot = item.href === '/notificacoes' && notifPendentes > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx('bottom-nav-item', isActive && 'active')}
            >
              <span className="relative inline-flex">
                <i className={`fas ${item.icon} text-lg`} />
                {showNotifDot && (
                  <span
                    className="absolute -top-0.5 -right-1.5 w-2.5 h-2.5 rounded-full bg-[#FF2D3F]"
                    style={{ boxShadow: '0 0 0 2px #000' }}
                    aria-label={`${notifPendentes} notificações não lidas`}
                  />
                )}
              </span>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
