'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), senha);
      const idToken = await cred.user.getIdToken();
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === 'forbidden') {
          setErro('Esta conta não tem permissão de administrador.');
        } else if (data.error === 'admin_not_configured') {
          setErro('Painel não configurado (ADMIN_MONITORING_EMAILS).');
        } else {
          setErro('Credenciais inválidas ou sessão recusada.');
        }
        await auth.signOut().catch(() => {});
        return;
      }
      window.location.href = '/paineladmin-monitoring-v0';
    } catch {
      setErro('Email ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm">
      <div>
        <label className="block text-xs text-white/50 mb-1">Email admin</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white"
          required
          autoComplete="username"
        />
      </div>
      <div>
        <label className="block text-xs text-white/50 mb-1">Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-white"
          required
          autoComplete="current-password"
        />
      </div>
      {erro && <p className="text-sm text-red-400">{erro}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full btn-red py-2.5 rounded-xl text-sm font-medium disabled:opacity-60"
      >
        {loading ? 'Entrando...' : 'Entrar no painel'}
      </button>
    </form>
  );
}
