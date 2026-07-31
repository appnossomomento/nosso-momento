import Link from 'next/link';

export default function PublicLegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0a060c] text-white">
      <header className="border-b border-white/10 px-4 py-4 flex items-center justify-between max-w-3xl mx-auto">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          Nosso Momento
        </Link>
        <nav className="flex gap-4 text-sm text-white/60">
          <Link href="/termos" className="hover:text-white transition">
            Termos
          </Link>
          <Link href="/privacidade" className="hover:text-white transition">
            Privacidade
          </Link>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
