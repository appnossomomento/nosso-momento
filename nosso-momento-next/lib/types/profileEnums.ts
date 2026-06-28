/** Valores de gênero (identidade / analytics) */
export const GENERO_OPTIONS = [
  { value: 'homem', label: 'Homem' },
  { value: 'mulher', label: 'Mulher' },
  { value: 'homem_trans', label: 'Homem Trans' },
  { value: 'mulher_trans', label: 'Mulher Trans' },
  { value: 'nao_binario', label: 'Não-binário' },
  { value: 'outro', label: 'Outro' },
  { value: 'prefiro_nao_responder', label: 'Prefiro não responder' },
] as const;

export const ORIENTACAO_OPTIONS = [
  { value: 'heterossexual', label: 'Heterossexual' },
  { value: 'lesbica', label: 'Lésbica' },
  { value: 'gay', label: 'Gay' },
  { value: 'bissexual', label: 'Bissexual' },
  { value: 'pansexual', label: 'Pansexual' },
  { value: 'assexual', label: 'Assexual' },
  { value: 'outro', label: 'Outra' },
  { value: 'prefiro_nao_responder', label: 'Prefiro não responder' },
] as const;

export const ESTADO_CIVIL_OPTIONS = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'namorando', label: 'Namorando' },
  { value: 'casado', label: 'Casado(a)' },
] as const;

export const TEMPO_RELACIONAMENTO_OPTIONS = [
  { value: 'ate_1_ano', label: '1 ano ou menos' },
  { value: '1_a_3_anos', label: '1 a 3 anos' },
  { value: '3_a_5_anos', label: '3 a 5 anos' },
  { value: '5_a_10_anos', label: '5 a 10 anos' },
  { value: '10_anos_ou_mais', label: '10 anos ou mais' },
] as const;

export const CATALOGO_LOJA_OPTIONS = [
  { value: 'masculino', label: 'Momentos masculinos' },
  { value: 'feminino', label: 'Momentos femininos' },
] as const;

export type GeneroValue = (typeof GENERO_OPTIONS)[number]['value'];
export type CatalogoLojaValue = (typeof CATALOGO_LOJA_OPTIONS)[number]['value'];
