import { Suspense } from 'react';
import AdminDashboard from '@/admin-panel/components/AdminDashboard';

export default function AdminMonitoringPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a] text-white/50 p-8 text-sm">Carregando...</div>}>
      <AdminDashboard />
    </Suspense>
  );
}
