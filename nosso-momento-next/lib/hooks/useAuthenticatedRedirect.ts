'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store/appStore';
import { isUsuarioPareado } from '@/lib/auth/postLogin';

const PUBLIC_ENTRY = ['/', '/login', '/cadastro', '/recuperar-senha'];

/**
 * Redireciona usuários autenticados que caem em rotas públicas (landing, login, etc.)
 * para o app — essencial no cold start do PWA (start_url = /).
 */
export function useAuthenticatedRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const authInitialized = useAppStore((s) => s.authInitialized);
  const usuario = useAppStore((s) => s.usuario);

  useEffect(() => {
    if (!authInitialized || !usuario) return;
    if (!PUBLIC_ENTRY.includes(pathname)) return;

    const dest = isUsuarioPareado(usuario.pareadoCom) ? '/dashboard' : '/parear';
    router.replace(dest);
  }, [authInitialized, usuario, pathname, router]);
}
