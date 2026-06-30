import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/client';

const MAX_SIZE = 5 * 1024 * 1024;

/** Upload opcional de capa do momento custom (Storage → URL no CF). */
export async function uploadCustomMomentImage(
  file: File,
  pareamentoId: string,
  uid: string,
): Promise<string> {
  if (file.size > MAX_SIZE) {
    throw new Error('file_too_large');
  }
  const ext =
    file.type === 'image/png' ? 'png' :
    file.type === 'image/webp' ? 'webp' :
    'jpg';
  const path = `custom_momentos/${pareamentoId}/${uid}/${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
