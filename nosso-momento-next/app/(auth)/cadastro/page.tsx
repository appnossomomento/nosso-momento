'use client';

import { useState, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { sendInput } from '@/lib/firebase/functions';
import { openSystemAlert } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import { validateTelefone, validateSenha, isValidConviteToken } from '@/lib/utils/validations';
import { trackGA, trackMeta } from '@/lib/analytics';

const INITIAL_FOGUINHOS = 10;

export default function CadastroPage() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [sexo, setSexo] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [loading, setLoading] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);

  // Verifica se veio via convite
  let hasPendingConvite = false;
  try {
    hasPendingConvite = !!sessionStorage.getItem('pendingConvite');
  } catch (_) {}

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!nome || !email || !telefone || !senha || !sexo) {
      openSystemAlert('Por favor, preencha todos os campos.');
      return;
    }

    if (!aceitouTermos) {
      if (checkboxRef.current) {
        checkboxRef.current.style.outline = '2px solid #f87171';
        checkboxRef.current.style.outlineOffset = '2px';
        checkboxRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const telError = validateTelefone(telefone);
    if (telError) { openSystemAlert(telError); return; }

    const senhaError = validateSenha(senha);
    if (senhaError) { openSystemAlert(senhaError); return; }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      // Cria sessão server-side via API Route (cookie HttpOnly+Secure, não forgeable).
      const idToken = await user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      trackGA('sign_up', { method: 'Email' });
      trackMeta('CompleteRegistration');

      await setDoc(doc(db, 'usuarios', user.uid), {
        nome,
        telefone,
        email,
        sexo,
        foguinhos: INITIAL_FOGUINHOS,
        lastCheckInDate: null,
        pareadoCom: null,
        catalogoPersonalizado: {},
        createdAt: serverTimestamp(),
      });

      // Auto-pareamento via convite
      let pendingConviteToken: string | null = null;
      try { pendingConviteToken = sessionStorage.getItem('pendingConvite'); } catch (_) {}

      if (pendingConviteToken && isValidConviteToken(pendingConviteToken)) {
        showToast('Cadastro realizado! Conectando com seu amor...', 'sucesso');
        try {
          await sendInput('convite_aceitar', { token: pendingConviteToken });
          try { sessionStorage.removeItem('pendingConvite'); } catch (_) {}
          await new Promise((r) => setTimeout(r, 1800));
          router.push('/dashboard');
        } catch (_) {
          showToast('Cadastro criado! Faça o pareamento manualmente.', 'aviso');
          router.push('/parear');
        }
        return;
      }

      showToast('Cadastro realizado! Faça o pareamento para continuar.', 'sucesso');
      router.push('/parear');
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      const messages: Record<string, string> = {
        'auth/email-already-in-use': 'Este email já está em uso. Tente fazer login ou use outro email.',
        'auth/invalid-email': 'O formato do email é inválido.',
        'auth/weak-password': 'A senha é muito fraca (mínimo de 6 caracteres).',
      };
      openSystemAlert(messages[code ?? ''] ?? 'Erro ao cadastrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen overflow-y-auto flex items-start justify-center py-8 px-4"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url('https://images.unsplash.com/photo-1517511620798-cec17d428bc0?auto=format&fit=crop&w=1470&q=80')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="card relative text-white" style={{ width: '92vw', maxWidth: 480, padding: '24px 24px 32px' }}>
        {!hasPendingConvite && (
          <Link href="/" className="absolute top-5 left-5 text-gray-400 hover:text-white transition" aria-label="Voltar">
            <i className="fas fa-arrow-left" />
          </Link>
        )}

        {hasPendingConvite && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm text-center font-medium"
            style={{ background: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.3)', color: '#f9a8d4' }}>
            <i className="fas fa-heart mr-2" />
            Você foi convidado! Crie sua conta e conecte-se.
          </div>
        )}

        <div className="text-center mb-5">
          <h2
            className="text-4xl font-bold text-transparent bg-clip-text mb-2"
            style={{ backgroundImage: 'linear-gradient(to right, #f9a8d4, #ef4444)', WebkitBackgroundClip: 'text' }}
          >
            CADASTRO
          </h2>
          <p className="text-gray-400 text-sm">Crie sua conta para começar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="text" placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input
            type="tel"
            placeholder="Telefone (11 dígitos com DDD)"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value.replace(/\D/g, '').slice(0, 11))}
            inputMode="numeric"
            autoComplete="tel"
          />
          <input type="password" placeholder="Senha (mín. 6 caracteres)" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />

          <select
            value={sexo}
            onChange={(e) => setSexo(e.target.value)}
            style={{ borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: sexo ? 'white' : 'rgba(255,255,255,0.5)', width: '100%' }}
          >
            <option value="" disabled>Selecione seu gênero</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
            <option value="outro">Outro</option>
          </select>

          <div className="flex items-start gap-3 pt-1">
            <input
              ref={checkboxRef}
              id="aceitarTermos"
              type="checkbox"
              checked={aceitouTermos}
              onChange={(e) => {
                setAceitouTermos(e.target.checked);
                if (checkboxRef.current) {
                  checkboxRef.current.style.outline = '';
                  checkboxRef.current.style.outlineOffset = '';
                }
              }}
              style={{ width: 18, height: 18, minWidth: 18, marginTop: 2, cursor: 'pointer', accentColor: '#ff5565' }}
            />
            <label htmlFor="aceitarTermos" className="text-xs text-gray-300 leading-relaxed cursor-pointer">
              Li e concordo com os{' '}
              <button type="button" onClick={() => {}} className="text-pink-400 underline hover:text-pink-300">Termos de Uso</button>
              {' '}e a{' '}
              <button type="button" onClick={() => {}} className="text-pink-400 underline hover:text-pink-300">Política de Privacidade</button>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-red w-full mt-2 py-4 rounded-xl flex items-center justify-center gap-3 text-base disabled:opacity-60"
          >
            {loading ? 'Criando conta...' : 'CRIAR CONTA'} <i className="fas fa-user-plus" />
          </button>

          <p className="text-center text-xs text-gray-400 pt-1">
            Já tem conta?{' '}
            <Link href="/login" className="text-pink-400 hover:text-pink-300 underline">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
