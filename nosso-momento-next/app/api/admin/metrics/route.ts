import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSessionCookie } from '@/lib/auth/adminMonitoring';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { aggregateMetrics } from '@/admin-panel/lib/aggregateMetrics';

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('__admin_monitoring')?.value;
  const session = await verifyAdminSessionCookie(cookie);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const daysParam = request.nextUrl.searchParams.get('days');
  const periodDays = Math.min(365, Math.max(1, parseInt(daysParam ?? '30', 10) || 30));

  try {
    const db = getAdminFirestore();
    const metrics = await aggregateMetrics(db, periodDays);
    return NextResponse.json(metrics);
  } catch (err) {
    console.error('[/api/admin/metrics]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
