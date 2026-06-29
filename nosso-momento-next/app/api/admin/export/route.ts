import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSessionCookie } from '@/lib/auth/adminMonitoring';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { fetchAllUsers, usersToCsv } from '@/admin-panel/lib/aggregateMetrics';

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('__admin_monitoring')?.value;
  const session = await verifyAdminSessionCookie(cookie);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    const rows = await fetchAllUsers(db);
    const csv = usersToCsv(rows);
    const filename = `nosso-momento-usuarios-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[/api/admin/export]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
