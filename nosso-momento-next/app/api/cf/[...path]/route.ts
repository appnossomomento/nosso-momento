import { NextRequest, NextResponse } from 'next/server';

const CF_BASE =
  process.env.CLOUD_FUNCTIONS_BASE_URL ??
  'https://southamerica-east1-nosso-momento-app.cloudfunctions.net';

/**
 * Proxy server-side para Cloud Functions em desenvolvimento local.
 * Evita CORS quando o Next roda em localhost:3001 (ou outra porta).
 * Bloqueado em produção — client usa CF diretamente.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { path } = await context.params;
  const functionName = path.join('/');
  const targetUrl = `${CF_BASE}/${functionName}`;

  const auth = request.headers.get('authorization') ?? '';
  const appCheck = request.headers.get('x-firebase-appcheck') ?? '';
  const contentType = request.headers.get('content-type') ?? 'application/json';

  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        ...(auth ? { Authorization: auth } : {}),
        ...(appCheck ? { 'X-Firebase-AppCheck': appCheck } : {}),
      },
      body,
    });

    const responseText = await upstream.text();
    return new NextResponse(responseText, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'proxy_failed';
    console.error(`[/api/cf/${functionName}] proxy error:`, message);
    return NextResponse.json({ error: 'proxy_failed', message }, { status: 502 });
  }
}

export async function OPTIONS() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Firebase-AppCheck',
    },
  });
}
