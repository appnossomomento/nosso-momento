import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSessionCookie } from '@/lib/auth/adminMonitoring';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { fetchVipUsers } from '@/admin-panel/lib/fetchVipUsers';

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('__admin_monitoring')?.value;
  const session = await verifyAdminSessionCookie(cookie);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    let users = await fetchVipUsers(db);

    const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase();
    if (q) {
      users = users.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.nome.toLowerCase().includes(q) ||
          u.telefone.replace(/\D/g, '').includes(q.replace(/\D/g, '')),
      );
    }

    const vipCount = users.filter((u) => u.vip).length;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      total: users.length,
      vipCount,
      users,
    });
  } catch (err) {
    console.error('[/api/admin/users]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
