'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/lib/store/appStore';
import clsx from 'clsx';
import AppLoadingScreen from '@/components/ui/AppLoadingScreen';

const NAV_ITEMS = [
  { href: '/dashboard', icon: 'fa-home', label: 'Início' },
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
              <Link key="center" href={centerHref} className="flex items-center justify-center flex-grow">
                <div className={clsx('bottom-nav-item-center', centerActive && 'ring-2 ring-white/30')} style={{ position: 'relative' }}>
                  <i className={`fas ${item.icon} text-xl text-white`} />
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
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx('bottom-nav-item', isActive && 'active')}
            >
              <i className={`fas ${item.icon} text-lg`} />
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
