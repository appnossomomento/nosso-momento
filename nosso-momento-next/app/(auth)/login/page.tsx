'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { openSystemAlert } from '@/components/ui/Modal';
import { trackGA, trackMeta } from '@/lib/analytics';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      openSystemAlert('Por favor, preencha todos os campos.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Cria sessão server-side via API Route (cookie HttpOnly+Secure, não forgeable).
      const idToken = await userCredential.user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      trackGA('login', { method: 'Email' });
      trackMeta('Login');

      // Roteamento inteligente: usuário não pareado vai para /parear
      const userSnap = await getDoc(doc(db, 'usuarios', userCredential.user.uid));
      const pareadoCom = userSnap.data()?.pareadoCom as string | null | undefined;
      const isPareado = !!pareadoCom && !pareadoCom.startsWith('pending_') && pareadoCom !== 'none';

      router.push(isPareado ? '/dashboard' : '/parear');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const messages: Record<string, string> = {
        'auth/user-not-found': 'Nenhum usuário encontrado com este email.',
        'auth/wrong-password': 'Senha incorreta.',
        'auth/invalid-email': 'Email inválido.',
        'auth/invalid-credential': 'Credenciais inválidas. Verifique seu email e senha.',
      };
      openSystemAlert(messages[code ?? ''] ?? 'Erro ao fazer login. Verifique seu email e senha.');
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
      <div className="card relative p-8 text-white" style={{ width: '92vw', maxWidth: 560, borderRadius: 24 }}>
        <Link
          href="/"
          className="absolute top-5 left-5 text-gray-400 hover:text-white transition"
          aria-label="Voltar"
        >
          <i className="fas fa-arrow-left" />
        </Link>

        <div className="text-center mb-6">
          <h2
            className="text-5xl font-bold text-transparent bg-clip-text mb-4"
            style={{ backgroundImage: 'linear-gradient(to right, #f9a8d4, #ef4444)', WebkitBackgroundClip: 'text' }}
          >
            ENTRAR
          </h2>
          <p className="text-gray-300 tracking-wider">Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <div className="text-right">
            <Link href="/recuperar-senha" className="text-xs text-pink-400 hover:text-pink-300 transition">
              Esqueci minha senha
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-red w-full mt-2 py-4 rounded-xl flex items-center justify-center gap-3 text-lg disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'LOGIN'} <i className="fas fa-sign-in-alt" />
          </button>
        </form>
      </div>
    </div>
  );
}
