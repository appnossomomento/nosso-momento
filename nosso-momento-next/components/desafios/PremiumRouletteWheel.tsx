'use client';

import Image from 'next/image';
import clsx from 'clsx';
import { ROULETTE_SEGMENTS } from '@/lib/desafios/rouletteSegments';

type Props = {
  rotationDeg: number;
  spinning?: boolean;
  size?: number;
  className?: string;
};

const LED_COUNT = 12;
const CENTER_LOGO = '/assets/icons/logo-icon-white-bottom.png';
const PIN = '/assets/icons/pin-roleta.png';

/**
 * Roleta premium — aro fino, disco quase full-bleed, pin PNG + logo no hub.
 */
export default function PremiumRouletteWheel({
  rotationDeg,
  spinning = false,
  size = 300,
  className,
}: Props) {
  const hubOuter = size * 0.22;
  const hubInner = size * 0.155;
  const pinW = Math.round(size * 0.1);
  const pinH = Math.round(pinW * 1.35);

  return (
    <div
      className={clsx('relative mx-auto select-none', className)}
      style={{
        width: size,
        height: size,
        paddingTop: pinH * 0.32,
      }}
      aria-hidden
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Aura */}
        <div
          className="pointer-events-none absolute inset-[-8%] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(225,29,72,0.34) 0%, rgba(159,18,57,0.12) 40%, transparent 68%)',
            filter: 'blur(8px)',
          }}
        />

        {/* Aro fino (só borda + LEDs) — disco por baixo quase colado */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none z-[1]"
          style={{
            boxShadow: [
              '0 0 0 1.5px rgba(255,70,95,0.65)',
              '0 0 18px rgba(225,29,72,0.35)',
              '0 0 40px rgba(225,29,72,0.14)',
            ].join(', '),
          }}
        >
          {Array.from({ length: LED_COUNT }).map((_, i) => {
            const ang = (i / LED_COUNT) * 360 - 90;
            const rad = (ang * Math.PI) / 180;
            // Colados na borda externa
            const r = 49.2;
            const x = 50 + r * Math.cos(rad);
            const y = 50 + r * Math.sin(rad);
            return (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 4.5,
                  height: 4.5,
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  background:
                    'radial-gradient(circle, #fffef5 0%, #ffe4c8 40%, #fb7185 100%)',
                  boxShadow:
                    '0 0 5px 1px rgba(255,230,210,0.8), 0 0 10px rgba(244,63,94,0.45)',
                }}
              />
            );
          })}
        </div>

        {/* Disco — quase full size (aro ~2%) */}
        <div
          className="absolute inset-[1.8%] rounded-full overflow-hidden z-0"
          style={{
            transform: `rotate(${rotationDeg}deg)`,
            transition: spinning
              ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
              : 'none',
            boxShadow: 'inset 0 0 22px rgba(0,0,0,0.4)',
          }}
        >
          <svg viewBox="0 0 200 200" width="100%" height="100%" className="block">
            <defs>
              {/* userSpaceOnUse: gradiente do centro da roda — evita “mancha” por fatia */}
              <radialGradient
                id="segA"
                gradientUnits="userSpaceOnUse"
                cx="100"
                cy="100"
                r="100"
              >
                <stop offset="0%" stopColor="#5c1828" />
                <stop offset="55%" stopColor="#8f2038" />
                <stop offset="100%" stopColor="#c42a48" />
              </radialGradient>
              <radialGradient
                id="segB"
                gradientUnits="userSpaceOnUse"
                cx="100"
                cy="100"
                r="100"
              >
                <stop offset="0%" stopColor="#3a1018" />
                <stop offset="55%" stopColor="#5a1828" />
                <stop offset="100%" stopColor="#7a2038" />
              </radialGradient>
            </defs>

            {ROULETTE_SEGMENTS.map((seg, i) => (
              <path
                key={`fill-${i}`}
                d={seg.path}
                fill={seg.tone === 'a' ? 'url(#segA)' : 'url(#segB)'}
              />
            ))}

            {/*
              Divisórias neon em camadas (sem feGaussianBlur):
              o blur SVG era cortado no topo pelo overflow do disco.
            */}
            {ROULETTE_SEGMENTS.map((seg, i) => {
              const rad = (seg.startAngle * Math.PI) / 180;
              const r0 = 27;
              const r1 = 98.4;
              const x1 = 100 + r0 * Math.cos(rad);
              const y1 = 100 + r0 * Math.sin(rad);
              const x2 = 100 + r1 * Math.cos(rad);
              const y2 = 100 + r1 * Math.sin(rad);
              return (
                <g key={`div-${i}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(255,60,90,0.35)"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(255,120,150,0.75)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(255,235,240,0.98)"
                    strokeWidth="0.75"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {ROULETTE_SEGMENTS.map((seg, i) => (
              <text
                key={`lbl-${i}`}
                x={seg.lx}
                y={seg.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize={seg.valor === 10 ? 13 : 14.5}
                fontWeight={600}
                letterSpacing="0.01em"
                style={{
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
                transform={`rotate(${seg.rot.toFixed(2)}, ${seg.lx.toFixed(2)}, ${seg.ly.toFixed(2)})`}
              >
                {seg.label}
              </text>
            ))}
          </svg>
        </div>

        {/* Pin */}
        <div
          className="absolute left-1/2 z-30"
          style={{
            top: -pinH * 0.28,
            transform: 'translateX(-50%)',
            width: pinW,
            height: pinH,
            filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))',
          }}
        >
          <Image
            src={PIN}
            alt=""
            width={pinW}
            height={pinH}
            className="object-contain"
            style={{ width: '100%', height: '100%' }}
            priority
            aria-hidden
          />
        </div>

        {/* Hub */}
        <div
          className="absolute left-1/2 top-1/2 z-20 flex items-center justify-center rounded-full"
          style={{
            width: hubOuter,
            height: hubOuter,
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(circle at 50% 40%, #2a0c14 0%, #12060a 70%, #080305 100%)',
            boxShadow: [
              '0 0 0 1px rgba(60,15,25,0.9)',
              'inset 0 2px 6px rgba(0,0,0,0.65)',
              '0 0 18px rgba(225,29,72,0.22)',
            ].join(', '),
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: hubInner,
              height: hubInner,
              background:
                'radial-gradient(circle at 40% 30%, #ff6b7a 0%, #e11d48 42%, #8b1030 100%)',
              boxShadow: [
                '0 0 0 1px rgba(255,120,140,0.25)',
                '0 0 16px rgba(244,63,94,0.5)',
                'inset 0 1px 4px rgba(255,255,255,0.3)',
                'inset 0 -4px 10px rgba(0,0,0,0.4)',
              ].join(', '),
            }}
          >
            <Image
              src={CENTER_LOGO}
              alt=""
              width={Math.round(hubInner * 0.5)}
              height={Math.round(hubInner * 0.5)}
              className="object-contain"
              style={{
                width: '50%',
                height: '50%',
                filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.4))',
              }}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  );
}
