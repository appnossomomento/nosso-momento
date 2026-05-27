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
