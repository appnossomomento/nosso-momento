import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage, waitForAppCheckToken } from '@/lib/firebase/client';

const MAX_SIZE = 5 * 1024 * 1024;

/** Upload opcional de capa do momento custom (Storage → URL no CF). */
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

  const ext =
    file.type === 'image/png' ? 'png' :
    file.type === 'image/webp' ? 'webp' :
    'jpg';
  const path = `custom_momentos/${pareamentoId}/${uid}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}

export function isStorageUploadError(err: unknown): boolean {
  const code = String((err as { code?: string }).code ?? '');
  return (
    code.startsWith('storage/') ||
    code.includes('unauthorized') ||
    code.includes('unauthenticated')
  );
}
