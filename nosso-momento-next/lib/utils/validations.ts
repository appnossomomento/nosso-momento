export function validateTelefone(tel: string): string | null {
  if (tel.length !== 11 || !/^\d+$/.test(tel)) {
    return 'O telefone deve conter exatamente 11 dígitos numéricos (com DDD).';
  }
  return null;
}

export function validateSenha(senha: string): string | null {
  if (senha.length < 6) {
    return 'A senha deve ter no mínimo 6 caracteres.';
  }
  return null;
}

export function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Email inválido.';
  }
  return null;
}

export function isValidConviteToken(token: string): boolean {
  return /^[a-f0-9]{40}$/.test(token);
}

export const APELIDO_REAL_MAX_LENGTH = 12;
export const IDADE_MINIMA = 18;
export const IDADE_MAXIMA = 120;

export function validateApelidoReal(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > APELIDO_REAL_MAX_LENGTH) {
    return `O apelido no card deve ter no máximo ${APELIDO_REAL_MAX_LENGTH} caracteres.`;
  }
  return null;
}

export function validateIdade(idade: number): string | null {
  if (!Number.isFinite(idade) || idade < IDADE_MINIMA) {
    return `É necessário ter pelo menos ${IDADE_MINIMA} anos para usar o app.`;
  }
  if (idade > IDADE_MAXIMA) return 'Idade inválida.';
  return null;
}

export function validateCidade(cidade: string): string | null {
  if (!cidade.trim() || cidade.trim().length < 2) return 'Informe uma cidade válida.';
  return null;
}

export function validateEstado(uf: string): string | null {
  if (!/^[A-Z]{2}$/.test(uf)) return 'Selecione um estado.';
  return null;
}

export function validateGeneroOutro(genero: string, outro: string): string | null {
  if (genero === 'outro' && !outro.trim()) return 'Descreva seu gênero.';
  return null;
}

export function validateOrientacaoOutro(orientacao: string, outro: string): string | null {
  if (orientacao === 'outro' && !outro.trim()) return 'Descreva sua orientação sexual.';
  return null;
}
