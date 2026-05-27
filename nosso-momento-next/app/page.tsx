import Link from 'next/link';
import Image from 'next/image';

export default function LandingPage() {
  return (
    <div
      className="landing-screen"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0.9)), url('https://images.unsplash.com/photo-1517511620798-cec17d428bc0?auto=format&fit=crop&w=1470&q=80')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="card p-6 sm:p-8 text-white" style={{ width: '92vw', maxWidth: 520, borderRadius: 24 }}>
        <div className="text-center mb-6">
          <Image
            src="/assets/icons/logo-topdown-white-txt.png"
            alt="Nosso Momento"
            width={200}
            height={80}
            loading="eager"
            className="mx-auto mb-6"
            style={{ width: '66%', maxWidth: 200, height: 'auto' }}
          />
          <p className="text-gray-300 tracking-wider">
            Apimente a relação.<br />Deixe tudo mais gostoso!
          </p>
        </div>
        <div className="space-y-4">
          <Link
            href="/login"
            className="btn-red w-full py-4 rounded-xl flex items-center justify-center gap-3 text-lg"
          >
            ENTRAR <i className="fas fa-sign-in-alt" />
          </Link>
        </div>
      </div>
    </div>
  );
}
