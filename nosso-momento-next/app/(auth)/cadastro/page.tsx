'use client';

import { useState, FormEvent, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { sendInput } from '@/lib/firebase/functions';
import { openSystemAlert } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import DarkSelect from '@/components/ui/DarkSelect';
import {
  validateTelefone,
  validateSenha,
  validateEmail,
  validateApelidoReal,
  validateDataNascimento,
  validateCidade,
  validateEstado,
  validateGeneroOutro,
  validateOrientacaoOutro,
  isValidConviteToken,
  APELIDO_REAL_MAX_LENGTH,
} from '@/lib/utils/validations';
import {
  GENERO_OPTIONS,
  ORIENTACAO_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  TEMPO_RELACIONAMENTO_OPTIONS,
  CATALOGO_LOJA_OPTIONS,
} from '@/lib/types/profileEnums';
import { ESTADOS_BR } from '@/lib/data/estados';
import { MESES_NASCIMENTO, buildAnoNascimentoOptions, buildDiaOptions } from '@/lib/data/meses';
import {
  generoNeedsCatalogoChoice,
  resolveAnatomiaFromCadastro,
  suggestCatalogoFromGenero,
} from '@/lib/utils/profile';
import { trackGA, trackMeta } from '@/lib/analytics';
import { useAppStore } from '@/lib/store/appStore';
import type { LegalModalType } from '@/lib/types';

const INITIAL_FOGUINHOS = 10;

export default function CadastroPage() {
  const router = useRouter();
  const { set } = useAppStore();
  const [step, setStep] = useState<1 | 2>(1);

  // Etapa 1
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [apelidoReal, setApelidoReal] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);

  // Etapa 2
  const [diaNascimento, setDiaNascimento] = useState('');
  const [mesNascimento, setMesNascimento] = useState('');
  const [anoNascimento, setAnoNascimento] = useState('');
  const [estado, setEstado] = useState('');
  const [cidade, setCidade] = useState('');
  const [genero, setGenero] = useState('');
  const [generoOutro, setGeneroOutro] = useState('');
  const [catalogoLoja, setCatalogoLoja] = useState('');
  const [orientacaoSexual, setOrientacaoSexual] = useState('');
  const [orientacaoSexualOutro, setOrientacaoSexualOutro] = useState('');
  const [estadoCivil, setEstadoCivil] = useState('');
  const [tempoRelacionamento, setTempoRelacionamento] = useState('');

  const [loading, setLoading] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);

  let hasPendingConvite = false;
  try {
    hasPendingConvite = !!sessionStorage.getItem('pendingConvite');
  } catch (_) {}

  const precisaCatalogo = genero ? generoNeedsCatalogoChoice(genero) : false;
  const precisaTempoRel = estadoCivil === 'namorando' || estadoCivil === 'casado';

  const diaOptions = useMemo(
    () => buildDiaOptions(mesNascimento, anoNascimento),
    [mesNascimento, anoNascimento],
  );
  const anoOptions = useMemo(() => buildAnoNascimentoOptions(), []);

  function clampDiaIfNeeded(nextMes: string, nextAno: string, currentDia: string) {
    if (!currentDia || !nextMes || !nextAno) return currentDia;
    const max = buildDiaOptions(nextMes, nextAno).length;
    const d = parseInt(currentDia, 10);
    if (d > max) return String(max);
    return currentDia;
  }

  function openLegalModal(type: LegalModalType) {
    set({ showLegalModal: true, legalModalType: type });
  }

  function validateStep1(): boolean {
    if (!nome.trim() || !sobrenome.trim() || !email.trim() || !telefone || !senha) {
      openSystemAlert('Por favor, preencha todos os campos obrigatórios.');
      return false;
    }
    const apelidoErr = validateApelidoReal(apelidoReal);
    if (apelidoErr) { openSystemAlert(apelidoErr); return false; }
    const emailErr = validateEmail(email.trim());
    if (emailErr) { openSystemAlert(emailErr); return false; }
    const telError = validateTelefone(telefone);
    if (telError) { openSystemAlert(telError); return false; }
    const senhaError = validateSenha(senha);
    if (senhaError) { openSystemAlert(senhaError); return false; }
    if (!aceitouTermos) {
      if (checkboxRef.current) {
        checkboxRef.current.style.outline = '2px solid #f87171';
        checkboxRef.current.style.outlineOffset = '2px';
        checkboxRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return false;
    }
    return true;
  }

  function validateStep2(): boolean {
    const nasc = validateDataNascimento(diaNascimento, mesNascimento, anoNascimento);
    if (!nasc.ok) { openSystemAlert(nasc.error); return false; }
    const ufErr = validateEstado(estado);
    if (ufErr) { openSystemAlert(ufErr); return false; }
    const cidadeErr = validateCidade(cidade);
    if (cidadeErr) { openSystemAlert(cidadeErr); return false; }
    if (!genero) { openSystemAlert('Selecione seu gênero.'); return false; }
    const genOutroErr = validateGeneroOutro(genero, generoOutro);
    if (genOutroErr) { openSystemAlert(genOutroErr); return false; }
    if (precisaCatalogo && !catalogoLoja) {
      openSystemAlert('Selecione a personalização da loja.');
      return false;
    }
    if (!orientacaoSexual) { openSystemAlert('Selecione sua orientação sexual.'); return false; }
    const oriOutroErr = validateOrientacaoOutro(orientacaoSexual, orientacaoSexualOutro);
    if (oriOutroErr) { openSystemAlert(oriOutroErr); return false; }
    if (!estadoCivil) { openSystemAlert('Selecione seu estado civil.'); return false; }
    if (precisaTempoRel && !tempoRelacionamento) {
      openSystemAlert('Informe o tempo de relacionamento.');
      return false;
    }
    return true;
  }

  function handleNextStep(e: FormEvent) {
    e.preventDefault();
    if (!validateStep1()) return;
    setStep(2);
  }

  function handleGeneroChange(value: string) {
    setGenero(value);
    if (generoNeedsCatalogoChoice(value)) {
      setCatalogoLoja(suggestCatalogoFromGenero(value));
    } else {
      setCatalogoLoja('');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateStep2()) return;

    const nasc = validateDataNascimento(diaNascimento, mesNascimento, anoNascimento);
    if (!nasc.ok) {
      openSystemAlert(nasc.error);
      return;
    }

    let anatomia: 'masculino' | 'feminino';
    try {
      anatomia = resolveAnatomiaFromCadastro(genero, catalogoLoja);
    } catch {
      openSystemAlert('Selecione a personalização da loja.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), senha);
      const user = userCredential.user;
      const idToken = await user.getIdToken();
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      trackGA('sign_up', { method: 'Email' });
      trackMeta('CompleteRegistration');

      const idadeNum = nasc.value.idade;
      const nomeCompleto = `${nome.trim()} ${sobrenome.trim()}`;
      const userDoc: Record<string, unknown> = {
        nome: nomeCompleto,
        sobrenome: sobrenome.trim(),
        telefone,
        email: email.trim(),
        genero,
        anatomia,
        sexo: anatomia,
        dataNascimento: nasc.value.dataNascimento,
        diaNascimento: nasc.value.diaNascimento,
        mesNascimento: nasc.value.mesNascimento,
        anoNascimento: nasc.value.anoNascimento,
        idade: idadeNum,
        estado,
        cidade: cidade.trim(),
        orientacaoSexual,
        estadoCivil,
        tempoRelacionamento: precisaTempoRel ? tempoRelacionamento : null,
        foguinhos: INITIAL_FOGUINHOS,
        lastCheckInDate: null,
        pareadoCom: null,
        catalogoPersonalizado: {},
        createdAt: serverTimestamp(),
      };

      if (apelidoReal.trim()) userDoc.apelidoReal = apelidoReal.trim();
      if (genero === 'outro' && generoOutro.trim()) userDoc.generoOutro = generoOutro.trim();
      if (orientacaoSexual === 'outro' && orientacaoSexualOutro.trim()) {
        userDoc.orientacaoSexualOutro = orientacaoSexualOutro.trim();
      }

      await setDoc(doc(db, 'usuarios', user.uid), userDoc);

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
        {!hasPendingConvite && step === 1 && (
          <div className="mb-3">
            <Link href="/" className="inline-flex items-center text-gray-400 hover:text-white transition" aria-label="Voltar">
              <i className="fas fa-arrow-left" />
            </Link>
          </div>
        )}
        {step === 2 && (
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center text-gray-400 hover:text-white transition"
              aria-label="Voltar"
            >
              <i className="fas fa-arrow-left" />
            </button>
          </div>
        )}

        {hasPendingConvite && (
          <div className="mb-4 rounded-xl px-4 py-3 text-sm text-center font-medium"
            style={{ background: 'rgba(236, 72, 153, 0.15)', border: '1px solid rgba(236, 72, 153, 0.3)', color: '#f9a8d4' }}>
            <i className="fas fa-heart mr-2" />
            Você foi convidado! Crie sua conta e conecte-se.
          </div>
        )}

        <div className="text-center mb-5">
          <p className="text-xs text-gray-500 mb-1">Passo {step} de 2</p>
          <h2
            className="text-4xl font-bold text-transparent bg-clip-text mb-2"
            style={{ backgroundImage: 'linear-gradient(to right, #f9a8d4, #ef4444)', WebkitBackgroundClip: 'text' }}
          >
            CADASTRO
          </h2>
          <p className="text-gray-400 text-sm">
            {step === 1 ? 'Crie sua conta' : 'Conte um pouco sobre você'}
          </p>
        </div>

        {step === 1 ? (
          <form onSubmit={handleNextStep} className="space-y-3">
            <input type="text" placeholder="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="given-name" />
            <input type="text" placeholder="Último nome" value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} autoComplete="family-name" />
            <div>
              <input
                type="text"
                placeholder="Apelido no card (opcional)"
                value={apelidoReal}
                maxLength={APELIDO_REAL_MAX_LENGTH}
                onChange={(e) => setApelidoReal(e.target.value)}
              />
              <p className="text-[10px] text-gray-500 mt-1 px-1">
                Como seu nome aparece no card de memórias. Máx. {APELIDO_REAL_MAX_LENGTH} caracteres.
              </p>
            </div>
            <input type="tel" placeholder="Telefone (11 dígitos com DDD)" value={telefone}
              onChange={(e) => setTelefone(e.target.value.replace(/\D/g, '').slice(0, 11))}
              inputMode="numeric" autoComplete="tel" />
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <input type="password" placeholder="Senha (mín. 6 caracteres)" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />

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
                <button
                  type="button"
                  className="text-pink-400 underline hover:text-pink-300"
                  onClick={(e) => { e.preventDefault(); openLegalModal('terms'); }}
                >
                  Termos de Uso
                </button>
                {' '}e a{' '}
                <button
                  type="button"
                  className="text-pink-400 underline hover:text-pink-300"
                  onClick={(e) => { e.preventDefault(); openLegalModal('privacy'); }}
                >
                  Política de Privacidade
                </button>
              </label>
            </div>

            <button type="submit" className="btn-red w-full mt-2 py-4 rounded-xl flex items-center justify-center gap-3 text-base">
              Continuar <i className="fas fa-arrow-right" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 mb-2 px-1">Data de nascimento</p>
              <div className="grid grid-cols-3 gap-2">
                <DarkSelect
                  placeholder="Dia"
                  value={diaNascimento}
                  onChange={(e) => setDiaNascimento(e.target.value)}
                  aria-label="Dia de nascimento"
                >
                  {diaOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </DarkSelect>
                <DarkSelect
                  placeholder="Mês"
                  value={mesNascimento}
                  onChange={(e) => {
                    const nextMes = e.target.value;
                    setMesNascimento(nextMes);
                    setDiaNascimento((d) => clampDiaIfNeeded(nextMes, anoNascimento, d));
                  }}
                  aria-label="Mês de nascimento"
                >
                  {MESES_NASCIMENTO.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </DarkSelect>
                <DarkSelect
                  placeholder="Ano"
                  value={anoNascimento}
                  onChange={(e) => {
                    const nextAno = e.target.value;
                    setAnoNascimento(nextAno);
                    setDiaNascimento((d) => clampDiaIfNeeded(mesNascimento, nextAno, d));
                  }}
                  aria-label="Ano de nascimento"
                >
                  {anoOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </DarkSelect>
              </div>
            </div>

            <DarkSelect placeholder="Estado" value={estado} onChange={(e) => setEstado(e.target.value)}>
              {ESTADOS_BR.map(({ uf, nome: nomeUf }) => (
                <option key={uf} value={uf}>{nomeUf}</option>
              ))}
            </DarkSelect>

            <input type="text" placeholder="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />

            <DarkSelect placeholder="Gênero" value={genero} onChange={(e) => handleGeneroChange(e.target.value)}>
              {GENERO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </DarkSelect>

            {genero === 'outro' && (
              <input type="text" placeholder="Descreva seu gênero" value={generoOutro} onChange={(e) => setGeneroOutro(e.target.value)} />
            )}

            {precisaCatalogo && (
              <div>
                <p className="text-xs text-gray-400 mb-1 px-1">Personalização da loja</p>
                <p className="text-[10px] text-gray-500 mb-2 px-1">
                  Define quais momentos íntimos aparecem quando seu parceiro compra surpresas para você.
                </p>
                <DarkSelect placeholder="Selecione" value={catalogoLoja} onChange={(e) => setCatalogoLoja(e.target.value)}>
                  {CATALOGO_LOJA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </DarkSelect>
              </div>
            )}

            <DarkSelect placeholder="Orientação sexual" value={orientacaoSexual} onChange={(e) => setOrientacaoSexual(e.target.value)}>
              {ORIENTACAO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </DarkSelect>

            {orientacaoSexual === 'outro' && (
              <input type="text" placeholder="Descreva sua orientação" value={orientacaoSexualOutro}
                onChange={(e) => setOrientacaoSexualOutro(e.target.value)} />
            )}

            <DarkSelect placeholder="Estado civil" value={estadoCivil} onChange={(e) => {
              setEstadoCivil(e.target.value);
              if (e.target.value === 'solteiro') setTempoRelacionamento('');
            }}>
              {ESTADO_CIVIL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </DarkSelect>

            {precisaTempoRel && (
              <DarkSelect placeholder="Tempo de relacionamento" value={tempoRelacionamento}
                onChange={(e) => setTempoRelacionamento(e.target.value)}>
                {TEMPO_RELACIONAMENTO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </DarkSelect>
            )}

            <button type="submit" disabled={loading}
              className="btn-red w-full mt-2 py-4 rounded-xl flex items-center justify-center gap-3 text-base disabled:opacity-60">
              {loading ? 'Criando conta...' : 'CRIAR CONTA'} <i className="fas fa-user-plus" />
            </button>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 pt-3">
          Já tem conta?{' '}
          <Link href="/login" className="text-pink-400 hover:text-pink-300 underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
