'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store/appStore';

function mesesJuntos(pareadoDesde: string | null | undefined): number {
  if (!pareadoDesde) return 0;
  const start = new Date(pareadoDesde);
  const now = new Date();
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function rrPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number, dy: number, dw: number, dh: number
) {
  const aspect = img.width / img.height;
  const targetAspect = dw / dh;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (aspect > targetAspect) {
    sw = img.height * targetAspect;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetAspect;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

type SetFn = (s: Record<string, unknown>) => void;

async function generateStoriesCard(params: {
  nomesCasal: string;
  mesLabel: string;
  mesNome: string;
  meses: number;
  foguinhosGastos: number;
  momentosResgatados: number;
  realizacoes: number;
  photoSrc: string | null;
  memoriasItems: unknown[];
  set: SetFn;
}) {
  const {
    nomesCasal, mesLabel, mesNome, meses,
    foguinhosGastos, momentosResgatados, realizacoes,
    photoSrc, memoriasItems, set,
  } = params;

  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d')!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, 1920);
  bg.addColorStop(0, '#0d0008');
  bg.addColorStop(0.5, '#110a14');
  bg.addColorStop(1, '#1a0a10');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1920);

  const radial = ctx.createRadialGradient(540, 960, 80, 540, 960, 820);
  radial.addColorStop(0, 'rgba(255,45,63,0.07)');
  radial.addColorStop(1, 'transparent');
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, 1080, 1920);

  // Load images
  let logoImg: HTMLImageElement | null = null;
  let photoImg: HTMLImageElement | null = null;
  try { logoImg = await loadImage('/assets/icons/iconprincipal.png'); } catch { /* ok */ }
  if (photoSrc) { try { photoImg = await loadImage(photoSrc); } catch { /* ok */ } }

  // â”€â”€ TOP: Logo + name â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const logoSize = 108;
  if (logoImg) {
    ctx.save();
    ctx.shadowColor = 'rgba(255,80,100,0.65)';
    ctx.shadowBlur = 48;
    ctx.drawImage(logoImg, (1080 - logoSize) / 2, 74, logoSize, logoSize);
    ctx.restore();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Nosso Momento', 540, 232);
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.font = '30px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Memórias do Casal', 540, 280);

  // â”€â”€ NEON CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const cardX = 52, cardY = 328, cardW = 976, cardH = 1468;
  const cardR = 48;

  for (const [blur, alpha] of [[80, 0.18], [40, 0.34], [16, 0.52]] as [number, number][]) {
    ctx.save();
    ctx.shadowColor = `rgba(255,45,63,${alpha})`;
    ctx.shadowBlur = blur;
    rrPath(ctx, cardX, cardY, cardW, cardH, cardR);
    ctx.strokeStyle = 'rgba(255,45,63,0.88)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  rrPath(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.fillStyle = '#12131a';
  ctx.fill();

  ctx.save();
  rrPath(ctx, cardX, cardY, cardW, cardH, cardR);
  ctx.strokeStyle = 'rgba(255,65,85,0.70)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // â”€â”€ PROFILE PHOTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const pX = cardX + 44, pY = cardY + 52, pW = 216, pH = 288, pR = 22;
  rrPath(ctx, pX, pY, pW, pH, pR);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  if (photoImg) {
    ctx.save(); rrPath(ctx, pX, pY, pW, pH, pR); ctx.clip();
    drawImageCover(ctx, photoImg, pX, pY, pW, pH);
    ctx.restore();
  } else if (logoImg) {
    ctx.save(); rrPath(ctx, pX, pY, pW, pH, pR); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fill();
    const pad = 30;
    ctx.drawImage(logoImg, pX + pad, pY + pad, pW - pad * 2, pH - pad * 2);
    ctx.restore();
  }

  // â”€â”€ COUPLE INFO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const iX = pX + pW + 36;
  const iW = cardX + cardW - iX - 44;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 46px -apple-system, BlinkMacSystemFont, sans-serif';
  const words = (nomesCasal || 'Nosso Momento').split(' ');
  let line = ''; let ty = cardY + 108;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > iW) { ctx.fillText(line, iX, ty); line = word; ty += 54; }
    else { line = test; }
  }
  ctx.fillText(line, iX, ty);

  ctx.fillStyle = 'rgba(255,255,255,0.44)';
  ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
  const mesStr = mesLabel + (meses > 0 ? ` - juntos há ${meses} ${meses === 1 ? 'mês' : 'meses'}` : '');
  ctx.fillText(mesStr, iX, ty + 42);

  const bioStats = [
    { icon: '🔥', value: foguinhosGastos, label: 'foguinhos gastos' },
    { icon: '💏', value: momentosResgatados, label: 'momentos resgatados' },
    { icon: '✅', value: realizacoes, label: 'realizações' },
  ];
  let sY = ty + 106;
  for (const { icon, value, label } of bioStats) {
    ctx.font = '30px -apple-system'; ctx.fillStyle = 'rgba(255,255,255,0.90)';
    ctx.fillText(icon, iX, sY);
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillStyle = '#ffffff';
    const valStr = String(value); ctx.fillText(valStr, iX + 44, sY);
    ctx.font = '26px -apple-system, BlinkMacSystemFont, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.50)';
    ctx.fillText(label, iX + 44 + ctx.measureText(valStr).width + 10, sY);
    sY += 48;
  }

  // â”€â”€ DIVIDER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const divY = Math.max(pY + pH, sY) + 50;
  const dg = ctx.createLinearGradient(cardX + 44, 0, cardX + cardW - 44, 0);
  dg.addColorStop(0, 'transparent'); dg.addColorStop(0.3, 'rgba(255,255,255,0.12)');
  dg.addColorStop(0.7, 'rgba(255,255,255,0.12)'); dg.addColorStop(1, 'transparent');
  ctx.strokeStyle = dg; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cardX + 44, divY); ctx.lineTo(cardX + cardW - 44, divY); ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,65,85,0.95)';
  ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, sans-serif';
  const tituloMes = `Nossos momentos de ${mesNome}`;
  ctx.fillText(tituloMes, 540, divY + 46);
  ctx.textAlign = 'left';

  // â”€â”€ PHOTO GRID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const gridStartY = divY + 74;
  const gap = 6;
  const cellW = (cardW - 88 - gap * 2) / 3;
  const gridItems = memoriasItems.slice(0, 9);

  if (gridItems.length > 0) {
    for (let i = 0; i < gridItems.length; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      const cx = cardX + 44 + col * (cellW + gap);
      const cy = gridStartY + row * (cellW + gap);
      rrPath(ctx, cx, cy, cellW, cellW, 14); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
      const item = gridItems[i] as Record<string, unknown>;
      const imgSrc = String(item.thumbnailUrl ?? item.fotoUrl ?? item.url ?? '');
      if (imgSrc) {
        try {
          const img = await loadImage(imgSrc);
          ctx.save(); rrPath(ctx, cx, cy, cellW, cellW, 14); ctx.clip();
          drawImageCover(ctx, img, cx, cy, cellW, cellW); ctx.restore();
        } catch { /* keep placeholder */ }
      }
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.font = '32px -apple-system'; ctx.textAlign = 'center';
    ctx.fillText('📸', 540, gridStartY + 60);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '26px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('Suas memórias aparecerão aqui', 540, gridStartY + 108);
    ctx.textAlign = 'left';
  }

  // â”€â”€ FOOTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fLineY = 1832;
  const fg = ctx.createLinearGradient(200, 0, 880, 0);
  fg.addColorStop(0, 'transparent'); fg.addColorStop(0.35, 'rgba(255,45,63,0.55)');
  fg.addColorStop(0.65, 'rgba(255,45,63,0.55)'); fg.addColorStop(1, 'transparent');
  ctx.strokeStyle = fg; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(200, fLineY); ctx.lineTo(880, fLineY); ctx.stroke();

  ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font = '30px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('@nossomomentoapp', 540, 1880);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.93);
  set({ memoriasShareGenerating: false, memoriasSharePreviewUrl: dataUrl });
}

export default function ShareModal() {
  const {
    memoriasShareModalOpen,
    memoriasSharePreviewOpen,
    memoriasSharePreviewUrl,
    memoriasShareGenerating,
    memoriasShareLastPhoto,
    memoriasMonth,
    memoriasItems,
    usuario,
    parceiroNome,
    achievementStats,
    set,
  } = useAppStore();

  useEffect(() => {
    if (!memoriasShareGenerating || !memoriasSharePreviewOpen) return;
    const stats = (achievementStats ?? {}) as Record<string, unknown>;
    const monthDate = memoriasMonth ? new Date(memoriasMonth) : new Date();
    generateStoriesCard({
      nomesCasal: [usuario?.nome, parceiroNome].filter(Boolean).join(' e '),
      mesLabel: monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      mesNome: monthDate.toLocaleDateString('pt-BR', { month: 'long' }),
      meses: mesesJuntos(usuario?.pareadoDesde),
      foguinhosGastos: (stats.totalFoguinhosGastos as number) ?? 0,
      momentosResgatados: ((stats.momentsRedeemed as { total?: number } | undefined)?.total) ?? 0,
      realizacoes: (stats.momentosCompletados as number) ?? 0,
      photoSrc: memoriasShareLastPhoto ?? null,
      memoriasItems,
      set: set as unknown as SetFn,
    }).catch(() => set({ memoriasShareGenerating: false } as Record<string, unknown>));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoriasShareGenerating, memoriasSharePreviewOpen]);

  if (!memoriasShareModalOpen && !memoriasSharePreviewOpen) return null;

  function closePicker() { set({ memoriasShareModalOpen: false }); }

  function closePreview() {
    set({
      memoriasSharePreviewOpen: false,
      memoriasSharePreviewMode: null,
      memoriasSharePreviewUrl: null,
      memoriasSharePreviewFile: null,
      memoriasShareGenerating: false,
    } as Record<string, unknown>);
  }

  function handleChoice() {
    set({
      memoriasShareModalOpen: false,
      memoriasSharePreviewOpen: true,
      memoriasSharePreviewMode: 'stories',
      memoriasShareGenerating: true,
      memoriasSharePreviewUrl: null,
    } as Record<string, unknown>);
  }

  async function handleDownload() {
    if (!memoriasSharePreviewUrl) return;
    const a = document.createElement('a');
    a.href = memoriasSharePreviewUrl;
    a.download = 'nosso-momento-stories.jpg';
    a.click();
  }

  async function handleShareNative() {
    if (!memoriasSharePreviewUrl) return;
    try {
      const res = await fetch(memoriasSharePreviewUrl);
      const blob = await res.blob();
      const file = new File([blob], 'nosso-momento-stories.jpg', { type: 'image/jpeg' });
      await navigator.share({ files: [file], title: 'Nosso Momento', text: 'Nossas memórias ❤️' });
    } catch { handleDownload(); }
  }

  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // â”€â”€ Picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (memoriasShareModalOpen) {
    return (
      <div className="fixed inset-0 bg-black/85 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0" onClick={closePicker}>
        <div
          className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
          style={{ background: '#080808', border: '1px solid rgba(255,45,63,0.20)' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header gradient */}
          <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#ff2d3f 0%,#ff5565 100%)' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,0,0,0.22)' }}
              >
                <i className="fas fa-share-alt text-white text-base" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base leading-tight">Compartilhar Memórias</h3>
                <p className="text-white/70 text-xs mt-0.5">Compartilhe nos seus stories.</p>
              </div>
            </div>
          </div>

          {/* Opção */}
          <div className="p-5">
            <button
              onClick={handleChoice}
              className="w-full rounded-2xl overflow-hidden text-left transition active:scale-95"
              style={{ background: '#111', border: '1px solid rgba(255,45,63,0.22)' }}
            >
              <div className="flex items-center gap-4 p-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg,#ff2d3f,#ff5565)' }}
                >
                  <span className="text-2xl">📱</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm">Stories 1080×1920</p>
                  <p className="text-white/40 text-xs mt-0.5">Clique para compartilhar.</p>
                </div>
                <i className="fas fa-chevron-right text-white/30 text-sm" />
              </div>
            </button>
          </div>

          <div className="px-5 pb-5">
            <button
              onClick={closePicker}
              className="w-full py-3 rounded-2xl text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // â”€â”€ Preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center px-4" onClick={closePreview}>
      <div
        className="w-full rounded-3xl overflow-hidden shadow-2xl"
        style={{ maxHeight: '92vh', maxWidth: '400px', background: '#080808', border: '1px solid rgba(255,45,63,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg,#ff2d3f 0%,#ff5565 100%)' }}
        >
          <div>
            <h3 className="text-base font-bold text-white leading-tight">Stories 1080×1920</h3>
            <p className="text-white/70 text-xs mt-0.5">Compartilhe nos seus stories.</p>
          </div>
          <button
            onClick={closePreview}
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,0,0,0.22)' }}
          >
            <i className="fas fa-times text-white text-sm" />
          </button>
        </div>

        {/* Preview — fundo preto */}
        <div className="p-4">
          <div
            className="rounded-2xl overflow-hidden bg-black flex items-center justify-center"
            style={{ aspectRatio: '9/16', maxHeight: '56vh' }}
          >
            {memoriasShareGenerating ? (
              <div className="flex flex-col items-center gap-3 text-white/50">
                <i className="fas fa-spinner fa-spin text-2xl text-red-400" />
                <p className="text-sm">Gerando Stories...</p>
              </div>
            ) : memoriasSharePreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={memoriasSharePreviewUrl} alt="Preview Stories" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <p className="text-sm text-gray-500">Erro ao gerar.</p>
            )}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={() => { closePreview(); set({ memoriasShareModalOpen: true }); }}
              className="py-3 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
            >
              Voltar
            </button>
            <button
              onClick={handleDownload}
              disabled={!memoriasSharePreviewUrl}
              className="py-3 rounded-xl text-sm disabled:opacity-40"
              style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)' }}
            >
              <i className="fas fa-download mr-1" />Salvar
            </button>
            <button
              onClick={handleShareNative}
              disabled={!memoriasSharePreviewUrl}
              className="py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#ff2d3f,#c8003a)' }}
            >
              <i className="fas fa-share mr-1" />Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
