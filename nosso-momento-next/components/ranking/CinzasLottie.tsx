'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

const SRC = '/lottie/Cinzas.json';

let cache: object | null = null;

type Props = {
  /** Viewport em px (largura = altura). */
  size?: number;
  className?: string;
};

/** Lottie de cinzas — estado “chama apagada” / usuário solo. */
export default function CinzasLottie({ size = 120, className }: Props) {
  const [data, setData] = useState<object | null>(cache);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cache) {
      setData(cache);
      return;
    }
    let cancelled = false;
    fetch(SRC)
      .then((r) => {
        if (!r.ok) throw new Error('missing');
        return r.json();
      })
      .then((json: object) => {
        cache = json;
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || !data) {
    return (
      <div
        className={className}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <div
          className="w-full h-full rounded-full"
          style={{
            background:
              'radial-gradient(circle at 50% 60%, rgba(120,113,108,0.45) 0%, rgba(40,40,40,0.2) 70%)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Lottie animationData={data} loop autoplay style={{ width: size, height: size }} />
    </div>
  );
}
