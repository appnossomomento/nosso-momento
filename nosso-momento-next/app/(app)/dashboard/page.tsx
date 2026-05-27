'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store/appStore';

export default function DashboardPage() {
  const router = useRouter();
  const { usuario, notificacoesTarefasNaoLidas, notificacoesPresentesNaoLidas, notificacoesConquistasNaoLidas, parceirosAtivos } = useAppStore();

  // Redireciona para /parear se o usuário não tiver parceiro ativo
  useEffect(() => {
    if (!usuario) return; // ainda carregando
    const pareadoCom = usuario.pareadoCom;
    const isPareado = !!pareadoCom && !pareadoCom.startsWith('pending_') && pareadoCom !== 'none';
    if (!isPareado) {
      router.replace('/parear');
    }
  }, [usuario, router]);

  const pendingCount =
    (notificacoesTarefasNaoLidas ?? 0) +
    (notificacoesPresentesNaoLidas ?? 0) +
    (notificacoesConquistasNaoLidas ?? 0);
  const hasPending = pendingCount > 0;
  const userName = usuario?.nome || 'Amor';
  const fotoPerfil = usuario?.fotoUrl || '/assets/icons/iconprincipal.png';
  const pareamentosCount = parceirosAtivos?.length ?? 0;

  return (
    <div className="screen screen-pad bg-black text-white">
      {/* Header */}
      <section className="px-0 pt-11 pb-14" style={{ background: 'linear-gradient(180deg, #ff2d3f 0%, #ff5565 100%)' }}>
        <div className="flex flex-col items-center text-center -mt-3">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-3 -mt-1">
            <Image
              src={fotoPerfil}
              alt="Foto de perfil"
              width={64}
              height={64}
              className="w-16 h-16 rounded-full object-cover"
            />
          </div>
          <div className="-mt-2">
            <h2 className="text-xl font-semibold leading-tight">Olá, {userName}</h2>
            <p className="text-sm text-white/80 leading-snug">Apimente suas relações</p>
          </div>
        </div>
      </section>

      {/* Grid de acesso rápido */}
      <section className="px-5 pb-8 -mt-10">
        <div className="rounded-[32px] bg-[#0f0b14] p-6 shadow-lg">
          <div className="grid grid-cols-2 gap-4">
            <Link href="/perfil" className="rounded-2xl bg-white/10 p-5 text-left transition hover:bg-white/20">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                <i className="fas fa-user text-xl icon-gradient" />
              </div>
              <h3 className="text-sm font-semibold">Meu Perfil</h3>
              <p className="text-xs text-white/70">Ver e Editar</p>
            </Link>

            <Link
              href="/notificacoes"
              className={`rounded-2xl p-5 text-left transition hover:bg-white/20 ${hasPending ? 'bg-white text-gray-900 shadow-lg shadow-white/20' : 'bg-white/10'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${hasPending ? 'bg-pink-100' : 'bg-white/10'}`}>
                <i className={`fas fa-bell text-xl ${hasPending ? 'text-pink-500' : 'icon-gradient'}`} />
              </div>
              <h3 className={`text-sm font-semibold ${hasPending ? 'text-gray-900' : ''}`}>Notificações</h3>
              <p className={`text-xs ${hasPending ? 'text-gray-600' : 'text-white/70'}`}>
                {hasPending ? `${pendingCount} pendentes` : 'Tudo em dia'}
              </p>
            </Link>

            <Link href="/parear" className="rounded-2xl bg-white/10 p-5 text-left transition hover:bg-white/20">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                <i className="fas fa-heart text-xl icon-gradient" />
              </div>
              <h3 className="text-sm font-semibold">Pareamentos</h3>
              <p className="text-xs text-white/70">{pareamentosCount} {pareamentosCount === 1 ? 'conexão' : 'conexões'}</p>
            </Link>

            <Link href="/memorias" className="rounded-2xl bg-white/10 p-5 text-left transition hover:bg-white/20">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                <i className="fas fa-book-open text-xl icon-gradient" />
              </div>
              <h3 className="text-sm font-semibold">Memórias</h3>
              <p className="text-xs text-white/70">Relembre</p>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
