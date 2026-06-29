import Image from 'next/image';
import clsx from 'clsx';

type Props = {
  message?: string;
  className?: string;
  fullScreen?: boolean;
};

export default function AppLoadingScreen({ message, className, fullScreen = true }: Props) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center bg-[#0a0a0a] text-white',
        fullScreen && 'min-h-[100dvh]',
        className,
      )}
    >
      <Image
        src="/icon.png"
        alt="Nosso Momento"
        width={112}
        height={112}
        priority
        className="animate-logo-pulse"
      />
      {message && <p className="text-white/50 text-sm mt-5">{message}</p>}
    </div>
  );
}
