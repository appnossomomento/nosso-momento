'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store/appStore';
import { callFunction, sendInput, FUNCTIONS } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import { validateTelefone } from '@/lib/utils/validations';
import OverlayModal from '@/components/ui/OverlayModal';

export default function PairingModal() {
  const { showPairingModal, set } = useAppStore();
  const [telefone, setTelefone] = useState('');
  const [apelido, setApelido] = useState('');
  const [erroTelefone, setErroTelefone] = useState('');
  const [gerandoConvite, setGerandoConvite] = useState(false);
  const [enviandoSolicitar, setEnviandoSolicitar] = useState(false);

  function fechar() {
    set({ showPairingModal: false });
  }

  async function handleGerarConvite() {
    setGerandoConvite(true);
    try {
      const result = await callFunction<{ token: string; url: string }>(FUNCTIONS.gerarConvite, {});
      const link = `${window.location.origin}/convite/${result.token}`;
      await navigator.clipboard.writeText(link);
      set({ pendingConviteLink: link });
      showToast('Link de convite copiado! 💌', 'sucesso');
      fechar();
    } catch {
      showToast('Erro ao gerar convite.', 'erro');
    } finally {
      setGerandoConvite(false);
    }
  }

  async function handleSolicitarPareamento() {
    const telNumero = telefone.replace(/\D/g, '');
    if (!validateTelefone(telNumero)) {
      setErroTelefone('Digite um telefone válido com 11 dígitos.');
      return;
    }
    if (!apelido.trim()) {
      showToast('Informe um apelido.', 'erro');
      return;
    }
    setEnviandoSolicitar(true);
    try {
      await sendInput('pairing_request', {
        toPhone: telNumero,
      });
      showToast('Solicitação enviada! 💕', 'sucesso');
      fechar();
    } catch {
      showToast('Erro ao enviar solicitação.', 'erro');
    } finally {
      setEnviandoSolicitar(false);
    }
  }

  return (
    <OverlayModal
      open={showPairingModal}
      onClose={fechar}
      maxWidth="max-w-md"
      panelClassName="bg-[#120b16] text-white border border-white/10 p-6"
      ariaLabel="Conectar com parceiro"
    >
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Conexão</p>
          <h3 className="text-2xl font-semibold mt-1">Conecte-se com seu amor</h3>
        </div>
        <button onClick={fechar} className="text-white/70 hover:text-white p-1">
          <i className="fas fa-times" />
        </button>
      </div>

      <button
        onClick={handleGerarConvite}
        disabled={gerandoConvite}
        className="w-full py-4 rounded-2xl font-bold text-white text-base mb-4 transition active:scale-95 disabled:opacity-60"
        style={{ background: 'linear-gradient(135deg,#ff2d50,#e8184a)', boxShadow: '0 4px 20px rgba(255,45,80,0.4)' }}
      >
        <i className="fas fa-paper-plane mr-2" />
        {gerandoConvite ? 'Gerando...' : 'Convidar meu amor'}
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-xs">ou parear por código</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-white/60">Telefone do parceiro (11 dígitos)</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={11}
            value={telefone}
            onChange={(e) => {
              setTelefone(e.target.value.replace(/\D/g, ''));
              setErroTelefone('');
            }}
            placeholder="Ex: 11999999999"
            className="mt-2 w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
          {erroTelefone && <p className="mt-1.5 text-xs text-red-400 font-medium">{erroTelefone}</p>}
        </div>
        <div>
          <label className="text-xs text-white/60">Apelido carinhoso</label>
          <input
            type="text"
            maxLength={32}
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder="Ex: Meu Amor"
            className="mt-2 w-full rounded-xl bg-white/10 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
        </div>
        <button
          onClick={handleSolicitarPareamento}
          disabled={enviandoSolicitar}
          className="w-full rounded-xl bg-white/10 border border-white/15 py-3 text-white/80 font-semibold hover:bg-white/15 transition disabled:opacity-50"
        >
          {enviandoSolicitar ? 'Enviando...' : 'Enviar solicitação'}
        </button>
      </div>

      <button onClick={fechar} className="mt-4 w-full text-center text-white/30 text-xs hover:text-white/60 transition">
        Fechar
      </button>
    </OverlayModal>
  );
}
