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

export type DataNascimentoValidada = {
  dataNascimento: string;
  diaNascimento: number;
  mesNascimento: number;
  anoNascimento: number;
  idade: number;
};

/** Valida dia/mês/ano e exige 18+ na data de hoje. */
export function validateDataNascimento(
  dia: string,
  mes: string,
  ano: string,
): { ok: true; value: DataNascimentoValidada } | { ok: false; error: string } {
  if (!dia || !mes || !ano) {
    return { ok: false, error: 'Selecione sua data de nascimento completa.' };
  }

  const d = parseInt(dia, 10);
  const m = parseInt(mes, 10);
  const y = parseInt(ano, 10);

  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) {
    return { ok: false, error: 'Data de nascimento inválida.' };
  }

  if (m < 1 || m > 12) return { ok: false, error: 'Mês inválido.' };

  const maxDia = new Date(y, m, 0).getDate();
  if (d < 1 || d > maxDia) return { ok: false, error: 'Dia inválido para o mês selecionado.' };

  const birth = new Date(y, m - 1, d);
  if (
    birth.getFullYear() !== y ||
    birth.getMonth() !== m - 1 ||
    birth.getDate() !== d
  ) {
    return { ok: false, error: 'Data de nascimento inválida.' };
  }

  const today = new Date();
  let idade = today.getFullYear() - y;
  const aniversarioEsteAno = new Date(today.getFullYear(), m - 1, d);
  if (today < aniversarioEsteAno) idade -= 1;

  const idadeErr = validateIdade(idade);
  if (idadeErr) return { ok: false, error: idadeErr };

  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');

  return {
    ok: true,
    value: {
      dataNascimento: `${y}-${mm}-${dd}`,
      diaNascimento: d,
      mesNascimento: m,
      anoNascimento: y,
      idade,
    },
  };
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
