'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { openSystemAlert } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) {
      openSystemAlert('Por favor, informe seu email.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      showToast('Email de recuperação enviado!', 'sucesso');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const messages: Record<string, string> = {
        'auth/user-not-found': 'Nenhuma conta encontrada com este email.',
        'auth/invalid-email': 'Email inválido.',
      };
      openSystemAlert(messages[code ?? ''] ?? 'Erro ao enviar email. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="auth-screen"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url('https://images.unsplash.com/photo-1517511620798-cec17d428bc0?auto=format&fit=crop&w=1470&q=80')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="card relative p-8 text-white" style={{ width: '92vw', maxWidth: 480, borderRadius: 24 }}>
        <Link href="/login" className="absolute top-5 left-5 text-gray-400 hover:text-white transition" aria-label="Voltar">
          <i className="fas fa-arrow-left" />
        </Link>

        <div className="text-center mb-6">
          <h2
            className="text-3xl font-bold text-transparent bg-clip-text mb-2"
            style={{ backgroundImage: 'linear-gradient(to right, #f9a8d4, #ef4444)', WebkitBackgroundClip: 'text' }}
          >
            RECUPERAR SENHA
          </h2>
          <p className="text-gray-300 text-sm">
            Informe seu email e enviaremos um link para redefinir sua senha.
          </p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-5xl mb-2">📧</div>
            <p className="text-sm text-gray-300">
              Verifique sua caixa de entrada (e spam) para o email enviado para <strong>{email}</strong>.
            </p>
            <Link href="/login" className="btn-red inline-block px-8 py-3 rounded-xl text-sm">
              Voltar ao Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="email"
              placeholder="Seu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-red w-full py-4 rounded-xl flex items-center justify-center gap-3 disabled:opacity-60"
            >
              {loading ? 'Enviando...' : 'ENVIAR LINK'} <i className="fas fa-paper-plane" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
