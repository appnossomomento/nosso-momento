import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import type { MomentoCustom } from '@/lib/types';

/** Paths de Storage (sem URL http). */
export function isStorageMediaPath(value: string | null | undefined): boolean {
  if (!value) return false;
  return (
    value.startsWith('custom_momentos/') ||
    value.startsWith('memorias/')
  );
}

/**
 * Assina paths via CF e devolve mapa path → url.
 */
export async function resolveMediaUrlMap(
  paths: string[],
): Promise<Record<string, string | null>> {
  const unique = [...new Set(paths.filter(isStorageMediaPath))];
  if (!unique.length) return {};
  try {
    const res = await callFunction<{ urls: Record<string, string | null> }>(
      FUNCTIONS.resolveMediaUrls,
      { paths: unique },
    );
    return res?.urls ?? {};
  } catch (err) {
    console.warn('[resolveMediaUrls]', err);
    return {};
  }
}

/** Enriquece momentosCustom com `img` assinado a partir de `imgPath`. */
export async function enrichMomentosCustomWithSignedUrls(
  raw: Record<string, MomentoCustom[]> | null,
): Promise<Record<string, MomentoCustom[]> | null> {
  if (!raw) return null;
  const paths: string[] = [];
  for (const list of Object.values(raw)) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item?.imgPath && isStorageMediaPath(item.imgPath)) {
        paths.push(item.imgPath);
      }
    }
  }
  if (!paths.length) return raw;

  const urls = await resolveMediaUrlMap(paths);
  const next: Record<string, MomentoCustom[]> = {};
  for (const [ownerUid, list] of Object.entries(raw)) {
    next[ownerUid] = (Array.isArray(list) ? list : []).map((item) => {
      if (!item) return item;
      const path = item.imgPath;
      if (path && urls[path]) {
        return { ...item, img: urls[path] ?? undefined };
      }
      return item;
    });
  }
  return next;
}
