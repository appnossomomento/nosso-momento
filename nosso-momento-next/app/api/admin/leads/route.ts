import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSessionCookie } from '@/lib/auth/adminMonitoring';
import type { LpLead } from '@/admin-panel/types';


const DEFAULT_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbzBLRdnuzt-_NURajfDrNECSql4S18oENpfnIAbV-V6ty0C1-9a5zXZI_IFehila8LVdQ/exec';

export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('__admin_monitoring')?.value;
  const session = await verifyAdminSessionCookie(cookie);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const endpoint = (process.env.LP_SHEETS_ENDPOINT || DEFAULT_ENDPOINT).trim();
  const token = (process.env.LP_LEADS_TOKEN || 'nm-leads-read-9pL4wKx2').trim();

  if (!endpoint || !token) {
    return NextResponse.json(
      {
        error: 'not_configured',
        message: 'Defina LP_SHEETS_ENDPOINT e LP_LEADS_TOKEN (e atualize o Apps Script).',
      },
      { status: 503 },
    );
  }

  const url = new URL(endpoint);
  url.searchParams.set('action', 'leads');
  url.searchParams.set('token', token);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: 'sheets_http_error', status: res.status },
        { status: 502 },
      );
    }

    const raw = (await res.json()) as {
      ok?: boolean;
      error?: string;
      generatedAt?: string;
      count?: number;
      meta?: number;
      leads?: LpLead[];
    };

    if (raw.ok === false || raw.error === 'unauthorized') {
      return NextResponse.json(
        { error: 'sheets_unauthorized', message: 'Token de leitura inválido no Apps Script.' },
        { status: 502 },
      );
    }

    let leads = Array.isArray(raw.leads) ? raw.leads : [];

    const q = request.nextUrl.searchParams.get('q')?.trim().toLowerCase();
    if (q) {
      leads = leads.filter((l) => {
        const blob = [
          l.nome,
          l.email,
          l.whatsapp,
          l.parceiroNome,
          l.cidadeEstado,
          l.origem,
          l.utmSource,
          l.utmMedium,
          l.utmCampaign,
          l.utmContent,
          l.utmTerm,
        ]
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }

    return NextResponse.json({
      generatedAt: raw.generatedAt || new Date().toISOString(),
      total: leads.length,
      countSheet: raw.count ?? leads.length,
      meta: raw.meta ?? 50,
      leads,
    });
  } catch (err) {
    console.error('[/api/admin/leads]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
