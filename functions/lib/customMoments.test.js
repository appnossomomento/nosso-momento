/* eslint-disable max-len */
"use strict";

const {
  buildCustomMomentId,
  parseCustomMomentId,
  isCustomMomentId,
  isUserPareamentoMember,
  findCustomMoment,
  sanitizeCatalogoPersonalizado,
  validateCustomMomentCreateInput,
  canAddCustomMoment,
  getPartnerUidsFromSender,
} = require("./customMoments");
const {MAX_CUSTOM_MOMENTS} = require("./constants");

describe("customMoments — parse/build id", () => {
  test("round-trip com pareamentoId contendo underscore", () => {
    const pareamentoId = "5511999991111_5511888882222";
    const itemId = "abc123xyz";
    const id = buildCustomMomentId(pareamentoId, itemId);
    expect(isCustomMomentId(id)).toBe(true);
    expect(parseCustomMomentId(id)).toEqual({pareamentoId, itemId});
  });
});

describe("customMoments — sanitizeCatalogoPersonalizado", () => {
  test("free com excluido retorna vip_required", () => {
    const result = sanitizeCatalogoPersonalizado(
        {"Jantar": {excluido: true}}, false,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("vip_required");
  });

  test("VIP persiste preco e bloqueio", () => {
    const result = sanitizeCatalogoPersonalizado(
        {"Jantar": {preco: 12, bloqueado: true}}, true,
    );
    expect(result.ok).toBe(true);
    expect(result.catalogo.Jantar).toEqual({preco: 12, bloqueado: true});
  });
});

describe("customMoments — membership e find", () => {
  const pareamento = {pessoa1Uid: "uid-a", pessoa2Uid: "uid-b"};

  test("isUserPareamentoMember", () => {
    expect(isUserPareamentoMember(pareamento, "uid-a")).toBe(true);
    expect(isUserPareamentoMember(pareamento, "uid-x")).toBe(false);
  });

  test("findCustomMoment ignora inativos", () => {
    const momentosCustom = {
      "uid-a": [
        {id: "item1", nome: "Massagem", preco: 10, ativo: true},
        {id: "item2", nome: "Old", preco: 5, ativo: false},
      ],
    };
    expect(findCustomMoment(momentosCustom, "uid-a", "item1").nome)
        .toBe("Massagem");
    expect(findCustomMoment(momentosCustom, "uid-a", "item2")).toBeNull();
  });
});

describe("customMoments — create validation", () => {
  test("rejeita preço inválido", () => {
    const result = validateCustomMomentCreateInput({nome: "Teste", preco: 0});
    expect(result.ok).toBe(false);
  });

  test("aceita payload válido", () => {
    const result = validateCustomMomentCreateInput({nome: "Jantar", preco: 50});
    expect(result.ok).toBe(true);
    expect(result.item.preco).toBe(50);
  });
});

describe("customMoments — canAddCustomMoment", () => {
  test("respeita limite de itens ativos", () => {
    const full = Array.from({length: MAX_CUSTOM_MOMENTS}, (_, i) => ({
      id: `i${i}`, ativo: true,
    }));
    expect(canAddCustomMoment(full)).toBe(false);
    expect(canAddCustomMoment([{id: "1", ativo: true}])).toBe(true);
  });

  test("21º custom seria rejeitado pelo handler", () => {
    expect(MAX_CUSTOM_MOMENTS).toBe(20);
    const atLimit = Array.from({length: 20}, (_, i) => ({
      id: `m${i}`, ativo: true,
    }));
    expect(canAddCustomMoment(atLimit)).toBe(false);
  });
});

describe("customMoments — getPartnerUidsFromSender", () => {
  test("coleta parceiros de pareamentosAtivos sem duplicar", () => {
    const uids = getPartnerUidsFromSender({
      pareamentosAtivos: [
        {uid: "p1"},
        {uid: "p2"},
        {uid: "p1"},
      ],
      pareadoUid: "p1",
    }, "me");
    expect(uids.sort()).toEqual(["p1", "p2"]);
  });
});
