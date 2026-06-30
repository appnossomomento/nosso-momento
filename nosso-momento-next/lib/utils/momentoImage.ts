/** Hosts conhecidos com imagens mortas no catálogo mestre legado. */
const BLOCKED_IMG_HOSTS = ['individuale.med.br'];

/** Remove URLs externas quebradas antes de renderizar o catálogo. */
export function sanitizeMomentoImgUrl(img: unknown): string | undefined {
  if (typeof img !== 'string') return undefined;
  const trimmed = img.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith('/')) return trimmed;

  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (BLOCKED_IMG_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) {
      return undefined;
    }
    return trimmed;
  } catch {
    return undefined;
  }
}
