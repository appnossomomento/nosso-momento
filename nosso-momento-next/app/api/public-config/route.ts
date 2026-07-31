import {NextResponse} from 'next/server';

/**
 * Config pública para LPs estáticas (App Check / Firebase client).
 * Só expõe NEXT_PUBLIC_* — nunca secrets.
 */
export async function GET() {
  return NextResponse.json(
      {
        firebase: {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
          messagingSenderId:
            process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
        },
        recaptchaSiteKey: process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '',
        joinWaitlistUrl:
          process.env.NEXT_PUBLIC_JOIN_WAITLIST_URL ||
          'https://southamerica-east1-nosso-momento-app.cloudfunctions.net/joinWaitlist',
        waitlistMeta: Number(process.env.NEXT_PUBLIC_WAITLIST_META || '50') || 50,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300',
        },
      },
  );
}
