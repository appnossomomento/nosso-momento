'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { sendInput } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import { isValidConviteToken } from '@/lib/utils/validations';
import Link from 'next/link';

export default function ConvitePage() {
  const router = useRouter();
  const params = useParams<{ token: string }>();
  const token = params.token ?? '';
  const [status, setStatus] = useState<'loading' | 'auth' | 'invalid'>('loading');

  useEffect(() => {
    if (!token || !isValidConviteToken(token)) {
      setStatus('invalid');
      return;
    }

    // Salva o token para uso após o cadastro/login
    try { sessionStorage.setItem('pendingConvite', token); } catch (_) {}

    // Verifica se o usuário já está logado
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Usuário logado: aceita o convite imediatamente
        try {
          showToast('Conectando com seu amor...', 'info');
          await sendInput('convite_aceitar', { token });
          try { sessionStorage.removeItem('pendingConvite'); } catch (_) {}
          await new Promise((r) => setTimeout(r, 1800));
          showToast('Pareamento realizado!', 'sucesso');
          router.push('/dashboard');
        } catch (_) {
          showToast('Não foi possível aceitar o convite automaticamente.', 'erro');
          router.push('/parear');
        }
      } else {
        // Usuário não logado: redireciona para cadastro
        setStatus('auth');
      }
    });

    return () => unsub();
  }, [token, router]);

  if (status === 'invalid') {
    return (
      <div className="auth-screen">
        <div className="card p-8 text-white text-center" style={{ width: '92vw', maxWidth: 400 }}>
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold mb-2">Link inválido</h2>
          <p className="text-gray-400 text-sm mb-6">Este link de convite é inválido ou expirou.</p>
          <Link href="/" className="btn-red px-8 py-3 rounded-xl">
            Ir para o início
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'auth') {
    return (
      <div className="auth-screen"
        style={{
          backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url('https://images.unsplash.com/photo-1517511620798-cec17d428bc0?auto=format&fit=crop&w=1470&q=80')",
          backgroundSize: 'cover',
        }}
      >
        <div className="card p-8 text-white text-center" style={{ width: '92vw', maxWidth: 440 }}>
          <div className="text-5xl mb-4">💑</div>
          <h2 className="text-2xl font-bold mb-2">Você foi convidado!</h2>
          <p className="text-gray-300 text-sm mb-6">
            Crie sua conta ou faça login para se conectar com seu parceiro.
          </p>
          <div className="space-y-3">
            <Link href="/cadastro" className="btn-red w-full py-3 rounded-xl flex items-center justify-center gap-2">
              CRIAR CONTA <i className="fas fa-user-plus" />
            </Link>
            <Link href="/login" className="block w-full py-3 rounded-xl text-sm text-white/70 border border-white/20 hover:bg-white/10 transition">
              Já tenho conta — Entrar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Loading
  return (
    <div className="auth-screen">
      <div className="card p-8 text-white text-center" style={{ width: '92vw', maxWidth: 400 }}>
        <div className="text-4xl mb-4 animate-spin">💫</div>
        <p className="text-gray-300">Verificando convite...</p>
      </div>
    </div>
  );
}
