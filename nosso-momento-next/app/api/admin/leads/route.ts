import {NextRequest, NextResponse} from 'next/server';
import {verifyAdminSessionCookie} from '@/lib/auth/adminMonitoring';
import {getAdminFirestore} from '@/lib/firebase/admin';
import type {LpLead} from '@/admin-panel/types';

function tsToIso(value: unknown): string {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as {toDate: () => Date}).toDate === 'function'
  ) {
    try {
      return (value as {toDate: () => Date}).toDate().toISOString();
    } catch {
      /* ignore */
    }
  }
  if (typeof value === 'string') return value;
  return '';
}

function mapLead(id: string, data: Record<string, unknown>): LpLead {
  const cidade = typeof data.cidade === 'string' ? data.cidade : '';
  const estado = typeof data.estado === 'string' ? data.estado : '';
  const cidadeEstado =
    (typeof data.cidadeEstado === 'string' && data.cidadeEstado) ||
    [cidade, estado].filter(Boolean).join('/') ||
    '';

  return {
    data: tsToIso(data.createdAt) || tsToIso(data.updatedAt) || id,
    nome: typeof data.nome === 'string' ? data.nome : '',
    whatsapp:
      typeof data.telefoneWhatsapp === 'string' ? data.telefoneWhatsapp : '',
    email: typeof data.email === 'string' ? data.email : '',
    parceiroNome: typeof data.nomeParceiro === 'string' ? data.nomeParceiro : '',
    cidadeEstado,
    origem:
      (typeof data.origem === 'string' && data.origem) ||
      (typeof data.source === 'string' && data.source) ||
      '',
    consentimento: data.consentimento ? 'sim' : '',
    utmSource: typeof data.utm_source === 'string' ? data.utm_source : '',
    utmMedium: typeof data.utm_medium === 'string' ? data.utm_medium : '',
    utmCampaign: typeof data.utm_campaign === 'string' ? data.utm_campaign : '',
    utmContent: typeof data.utm_content === 'string' ? data.utm_content : '',
    utmTerm: typeof data.utm_term === 'string' ? data.utm_term : '',
    gclid: typeof data.gclid === 'string' ? data.gclid : '',
    fbclid: typeof data.fbclid === 'string' ? data.fbclid : '',
    landingUrl: typeof data.landing_url === 'string' ? data.landing_url : '',
  };
}

/**
 * Leads da LP a partir do Firestore (lista-de-espera).
 * Sem tokens/Sheets no client — secrets não são necessários nesta rota.
 */
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get('__admin_monitoring')?.value;
  const session = await verifyAdminSessionCookie(cookie);
  if (!session) {
    return NextResponse.json({error: 'unauthorized'}, {status: 401});
  }

  try {
    const db = getAdminFirestore();
    const snap = await db.collection('lista-de-espera').get();
    let leads = snap.docs.map((doc) => mapLead(doc.id, doc.data()));

    leads.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

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

    const meta = Number(process.env.NEXT_PUBLIC_WAITLIST_META || '50') || 50;

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      total: leads.length,
      countSheet: leads.length,
      meta,
      leads,
    });
  } catch (err) {
    console.error('[/api/admin/leads]', err);
    return NextResponse.json({error: 'internal_error'}, {status: 500});
  }
}
