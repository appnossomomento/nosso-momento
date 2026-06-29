import AdminLoginForm from '@/admin-panel/components/AdminLoginForm';

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Interno</p>
          <h1 className="text-xl font-semibold text-white">Painel Monitoring</h1>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
