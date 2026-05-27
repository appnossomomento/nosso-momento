'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAppStore } from '@/lib/store/appStore';

interface ParceiroHeaderProps {
  /** Exibe ícone de carrinho (para a página /loja) */
  showCart?: boolean;
  /** 'black' = header preto (padrão); 'gradient' = header vermelho */
  variant?: 'black' | 'gradient';
}

export default function ParceiroHeader({ showCart = false, variant = 'black' }: ParceiroHeaderProps) {
  const router = useRouter();
  const { parceiroData, parceiroNome, usuario, carrinho, set, pareadoUid, parceirosAtivos } = useAppStore();

  const foto = parceiroData?.fotoUrl ?? null;
  const nome = parceiroNome ?? parceiroData?.nome ?? 'Parceiro';
  // Foguinhos individualizados por par (atualizado em tempo real via usePareamentoListeners)
  const parAtivo = parceirosAtivos.find((p) => p.uid === pareadoUid);
  const foguinhos = Number(parAtivo?.foguinhos ?? usuario?.foguinhos ?? 0);
  const cartCount = carrinho.length;

  const isGradient = variant === 'gradient';
  const wrapperStyle = isGradient
    ? { background: 'linear-gradient(180deg,#ff2d3f 0%,#ff5565 100%)', boxShadow: '0 4px 20px rgba(255,45,63,0.35)', paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }
    : { background: '#000000', borderBottom: '1px solid #222', paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' };
  const btnBg = isGradient ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.08)';
  const pillBg = isGradient ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.10)';
  const fotoBorder = isGradient ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.25)';

  return (
    <div
      className="flex-shrink-0 px-4 pb-3 flex items-center gap-3 w-full sticky top-0 z-30"
      style={wrapperStyle}
    >
      {/* Voltar */}
      <button
        onClick={() => router.push('/parceiro')}
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: btnBg }}
      >
        <i className="fas fa-arrow-left text-white text-sm" />
      </button>

      {/* Foto + nome */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div
          className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
          style={{ border: `2px solid ${fotoBorder}`, background: 'rgba(0,0,0,0.20)' }}
        >
          {foto ? (
            <Image src={foto} alt={nome} width={36} height={36} className="w-full h-full object-cover" />
          ) : (
            <i className="fas fa-user text-white/70 text-xs" />
          )}
        </div>
        <p className="text-sm font-bold text-white truncate">{nome}</p>
      </div>

      {/* Foguinhos + carrinho */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="flex items-center gap-1.5"
          style={{ background: pillBg, borderRadius: 20, padding: '4px 10px' }}
        >
          <i className="fas fa-fire text-white text-sm" />
          <span className="text-sm font-bold text-white">{foguinhos}</span>
        </div>

        {showCart && (
          <button
            onClick={() => set({ showCartSidebar: true })}
            className="relative w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: pillBg }}
          >
            <i className="fas fa-shopping-cart text-white text-sm" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-400 text-black text-[10px] font-bold flex items-center justify-center leading-none">
                {cartCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
