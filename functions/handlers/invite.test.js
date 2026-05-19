/* eslint-disable max-len */
"use strict";

// â”€â”€ Testes da lÃ³gica pura de invite.js â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Segue o mesmo padrÃ£o dos demais testes do projeto: testa lÃ³gica extraÃ­vel
// sem invocar os handlers HTTP diretamente (que dependem do runner do Firebase).

const crypto = require("crypto");

// â”€â”€ LÃ³gica replicada do handler (mantida em sincronia) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CONVITE_URL_BASE = "https://nossomomento.app";
const CONVITE_TTL_MS = 48 * 60 * 60 * 1000;

function gerarToken() {
  return crypto.randomBytes(20).toString("hex");
}

function construirUrl(token) {
  return `${CONVITE_URL_BASE}?convite=${token}`;
}

function validarTelefone(telefone) {
  return typeof telefone === "string" && /^\d{11}$/.test(telefone);
}

// â”€â”€ gerarConvite: token â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("gerarConvite â€” lÃ³gica do token", () => {
  test("token tem 40 caracteres hexadecimais", () => {
    const token = gerarToken();
    expect(token).toMatch(/^[a-f0-9]{40}$/);
  });

  test("tokens gerados sÃ£o Ãºnicos", () => {
    const tokens = new Set(Array.from({length: 20}, () => gerarToken()));
    expect(tokens.size).toBe(20);
  });

  test("TTL Ã© 48 horas em milissegundos", () => {
    expect(CONVITE_TTL_MS).toBe(172800000);
  });

  test("data de expiraÃ§Ã£o Ã© 48h Ã  frente do momento de criaÃ§Ã£o", () => {
    const before = Date.now();
    const expiraEm = new Date(Date.now() + CONVITE_TTL_MS);
    const after = Date.now();
    const diffMs = expiraEm.getTime() - before;
    expect(diffMs).toBeGreaterThanOrEqual(CONVITE_TTL_MS);
    expect(diffMs).toBeLessThanOrEqual(CONVITE_TTL_MS + (after - before));
  });
});

// â”€â”€ gerarConvite: URL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("gerarConvite â€” construÃ§Ã£o da URL", () => {
  test("URL contÃ©m a base correta", () => {
    const url = construirUrl("abc123");
    expect(url).toContain("https://nossomomento.app");
  });

  test("URL contÃ©m o parÃ¢metro ?convite=", () => {
    const token = "abc123";
    const url = construirUrl(token);
    expect(url).toBe(`https://nossomomento.app?convite=${token}`);
  });

  test("token de 40 chars produz URL vÃ¡lida", () => {
    const token = gerarToken();
    const url = construirUrl(token);
    expect(url).toMatch(
        /^https:\/\/nossomomento\.app\?convite=[a-f0-9]{40}$/,
    );
  });
});

// â”€â”€ verificarTelefone: validaÃ§Ã£o do telefone â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("verificarTelefone â€” validaÃ§Ã£o de telefone", () => {
  test("aceita telefone com exatamente 11 dÃ­gitos", () => {
    expect(validarTelefone("11999999999")).toBe(true);
  });

  test("aceita telefone iniciado com zero", () => {
    expect(validarTelefone("01999999999")).toBe(true);
  });

  test("rejeita telefone com menos de 11 dÃ­gitos", () => {
    expect(validarTelefone("9999999")).toBe(false);
  });

  test("rejeita telefone com mais de 11 dÃ­gitos", () => {
    expect(validarTelefone("119999999990")).toBe(false);
  });

  test("rejeita telefone com letra", () => {
    expect(validarTelefone("1199999999a")).toBe(false);
  });

  test("rejeita telefone com espaÃ§o", () => {
    expect(validarTelefone("11 999999999")).toBe(false);
  });

  test("rejeita telefone com +55 no inÃ­cio", () => {
    expect(validarTelefone("+5511999999999")).toBe(false);
  });

  test("rejeita string vazia", () => {
    expect(validarTelefone("")).toBe(false);
  });

  test("rejeita null", () => {
    expect(validarTelefone(null)).toBe(false);
  });

  test("rejeita undefined", () => {
    expect(validarTelefone(undefined)).toBe(false);
  });

  test("rejeita nÃºmero (nÃ£o string)", () => {
    expect(validarTelefone(11999999999)).toBe(false);
  });
});
