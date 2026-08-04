import { getCatalogFilterGender } from '@/lib/utils/profile';

/** Formata #01…#99 com zero à esquerda; a partir de 100 fica sem pad. */
export function formatUsuarioNumero(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 100) return String(n).padStart(2, '0');
  return String(n);
}

type SexoOpts = {
  anatomia?: string | null;
  sexo?: string | null;
  genero?: string | null;
};

/** Preferência anatomia/sexo; fallback genero mulher* → feminino. */
export function isFemininoPerfil(opts?: SexoOpts | null): boolean {
  const catalog = getCatalogFilterGender(opts ?? undefined);
  if (catalog === 'feminino') return true;
  if (catalog === 'masculino') return false;
  const genero = (opts?.genero ?? '').trim().toLowerCase();
  return genero === 'mulher' || genero === 'mulher_trans';
}

/**
 * Preferência: anatomia/sexo (catálogo).
 * Só cai no genero quando anatomia/sexo não está definido como masculino/feminino.
 */
export function fundadorTitle(opts?: SexoOpts | null): 'Fundador' | 'Fundadora' {
  return isFemininoPerfil(opts) ? 'Fundadora' : 'Fundador';
}

/** Artigo "o" / "a" para o parceiro (ex.: "com a Ana"). */
export function artigoParceiro(opts?: SexoOpts | null): 'o' | 'a' {
  return isFemininoPerfil(opts) ? 'a' : 'o';
}

/**
 * Fundador(a) → "Fundador(a) #01"…"#100" (slot da cohort / casal).
 * Demais → "Usuário #N" (número global de cadastro).
 */
export function membershipLabel(opts: {
  numeroUsuario?: number | null;
  fundador?: boolean | null;
  fundadorNumero?: number | null;
  anatomia?: string | null;
  sexo?: string | null;
  genero?: string | null;
}): string | null {
  if (opts.fundador === true) {
    const title = fundadorTitle(opts);
    const fn = Number(opts.fundadorNumero);
    if (Number.isFinite(fn) && fn > 0) {
      return `${title} #${formatUsuarioNumero(fn)}`;
    }
    const n = Number(opts.numeroUsuario);
    if (Number.isFinite(n) && n > 0) {
      return `${title} #${formatUsuarioNumero(n)}`;
    }
    return title;
  }

  const n = Number(opts.numeroUsuario);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `Usuário #${formatUsuarioNumero(n)}`;
}
