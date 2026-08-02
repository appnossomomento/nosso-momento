import Image from 'next/image';

const LOGO_WHITE = '/assets/icons/logo-icon-white-bottom.png';

export default function VipStatusInline() {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600 shadow-[0_1px_5px_rgba(251,191,36,0.45)]"
        aria-hidden
      >
        <Image
          src={LOGO_WHITE}
          alt=""
          width={10}
          height={10}
          className="object-contain drop-shadow"
        />
      </span>
      <span className="text-xs font-semibold text-amber-300">Usuário VIP</span>
    </div>
  );
}
