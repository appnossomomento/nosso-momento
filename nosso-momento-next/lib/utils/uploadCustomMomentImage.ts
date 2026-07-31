import { auth, waitForAppCheckToken } from '@/lib/firebase/client';
import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';

const MAX_SIZE = 5 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('read_failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Upload de capa via Cloud Function (Admin SDK, sem download token permanente).
 * Retorna imgPath para persistir no Firestore.
 */
export async function uploadCustomMomentImage(
  file: File,
  pareamentoId: string,
  uid: string,
): Promise<string> {
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('not_authenticated');
  }
  if (file.size > MAX_SIZE) {
    throw new Error('file_too_large');
  }

  await waitForAppCheckToken();
  const base64 = await fileToBase64(file);
  const result = await callFunction<{ imgPath: string; url: string | null }>(
    FUNCTIONS.uploadCustomMomentImage,
    {
      pareamentoId,
      base64,
      contentType: file.type || 'image/jpeg',
      fileName: file.name || 'capa',
    },
  );
  if (!result?.imgPath) throw new Error('upload_failed');
  return result.imgPath;
}

export function isStorageUploadError(err: unknown): boolean {
  const msg = String((err as { message?: string }).message ?? err ?? '');
  const code = String((err as { code?: string }).code ?? '');
  return (
    code.startsWith('storage/') ||
    msg.includes('upload_failed') ||
    msg.includes('forbidden') ||
    msg.includes('unauthorized') ||
    msg.includes('unauthenticated')
  );
}
