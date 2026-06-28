import type { CatalogoLojaValue, GeneroValue } from '@/lib/types/profileEnums';

/** Normaliza masculino/feminino/unisex para comparação com targetGender (case-insensitive). */
export function normalizeCatalogGender(value?: string | null): string {
  if (!value?.trim()) return 'unisex';
  const v = value.trim().toLowerCase();
  if (v === 'masculino' || v === 'm') return 'masculino';
  if (v === 'feminino' || v === 'f') return 'feminino';
  if (v === 'unisex') return 'unisex';
  return v;
}

/** Anatomia/sexo do usuário para filtro de catálogo — fallback legado em `sexo`. */
export function getCatalogFilterGender(user: {
  anatomia?: string | null;
  sexo?: string | null;
} | null | undefined): string {
  const raw = user?.anatomia ?? user?.sexo;
  const normalized = normalizeCatalogGender(raw);
  return normalized === 'unisex' ? 'unisex' : normalized;
}

export function generoNeedsCatalogoChoice(genero: string): boolean {
  return genero !== 'homem' && genero !== 'mulher';
}

export function suggestCatalogoFromGenero(genero: string): CatalogoLojaValue {
  if (genero === 'mulher' || genero === 'mulher_trans') return 'feminino';
  return 'masculino';
}

export function resolveAnatomiaFromCadastro(
  genero: string,
  catalogoEscolhido?: string,
): CatalogoLojaValue {
  if (genero === 'homem') return 'masculino';
  if (genero === 'mulher') return 'feminino';
  const norm = normalizeCatalogGender(catalogoEscolhido);
  if (norm === 'masculino' || norm === 'feminino') return norm;
  throw new Error('catalogo_loja_required');
}

/** targetGender do momento mestre bate com anatomia do receptor? */
export function momentMatchesCatalogFilter(
  targetGender: string | undefined | null,
  receptorAnatomia: string | undefined | null,
): boolean {
  const target = normalizeCatalogGender(targetGender || 'unisex');
  if (target === 'unisex') return true;
  const receptor = getCatalogFilterGender({ anatomia: receptorAnatomia, sexo: receptorAnatomia });
  if (receptor === 'unisex') return true;
  return target === receptor;
}

export function isGeneroValue(v: string): v is GeneroValue {
  return [
    'homem', 'mulher', 'homem_trans', 'mulher_trans',
    'nao_binario', 'outro', 'prefiro_nao_responder',
  ].includes(v);
}
