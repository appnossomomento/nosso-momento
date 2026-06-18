/* eslint-disable max-len, linebreak-style */
"use strict";

const {
  sanitizeMomentRedeemItems,
  computeMasterPrice,
  momentMatchesPartnerGender,
  resolveMasterMomentItem,
  isCustomMomentId,
  getCatalogCfg,
} = require("./momentPricing");

describe("momentPricing — sanitizeMomentRedeemItems", () => {
  test("preserva id e ignora custo do client", () => {
    const items = sanitizeMomentRedeemItems([
      {
        id: "abc123",
        nome: "3 Minutos de Abraço",
        custoFoguinhos: 1,
        emoji: "🤗",
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("abc123");
    expect(items[0].nome).toBe("3 Minutos de Abraço");
    expect(items[0].custoFoguinhos).toBeUndefined();
  });

  test("aceita momentoMestreId como fallback de id", () => {
    const items = sanitizeMomentRedeemItems([
      {momentoMestreId: "mestre-1", nome: "Jantar"},
    ]);
    expect(items[0].id).toBe("mestre-1");
  });
});

describe("momentPricing — computeMasterPrice", () => {
  const mestre = {intensidade: 3, nome: "Caliente"};

  test("usa intensidade x 2 por padrão", () => {
    expect(computeMasterPrice(mestre, {})).toBe(6);
  });

  test("usa preço customizado do catálogo do parceiro", () => {
    expect(computeMasterPrice(mestre, {preco: 15})).toBe(15);
  });

  test("ignora preço inválido e cai no default", () => {
    expect(computeMasterPrice(mestre, {preco: 0})).toBe(6);
    expect(computeMasterPrice(mestre, {preco: 5000})).toBe(6);
  });
});

describe("momentPricing — momentMatchesPartnerGender", () => {
  test("Unisex aceita qualquer parceiro", () => {
    expect(momentMatchesPartnerGender(
        {targetGender: "Unisex"}, "masculino",
    )).toBe(true);
  });

  test("rejeita gênero incompatível", () => {
    expect(momentMatchesPartnerGender(
        {targetGender: "feminino"}, "masculino",
    )).toBe(false);
  });
});

describe("momentPricing — resolveMasterMomentItem", () => {
  const mestre = {
    id: "m1",
    nome: "3 Minutos de Abraço",
    intensidade: 2,
    targetGender: "Unisex",
    categoria: "Lovezin",
    emoji: "🤗",
    img: "https://example.com/img.jpg",
  };

  const partner = {sexo: "masculino", catalogoPersonalizado: {}};

  test("resolve item com preço default", () => {
    const result = resolveMasterMomentItem(
        {id: "m1", nome: mestre.nome}, mestre, partner,
    );
    expect(result.ok).toBe(true);
    expect(result.item.custoFoguinhos).toBe(4);
    expect(result.item.nome).toBe("3 Minutos de Abraço");
  });

  test("rejeita momento bloqueado no catálogo do parceiro", () => {
    const blockedPartner = {
      ...partner,
      catalogoPersonalizado: {"3 Minutos de Abraço": {bloqueado: true}},
    };
    const result = resolveMasterMomentItem({id: "m1"}, mestre, blockedPartner);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("momento_bloqueado");
  });

  test("rejeita preço manipulado — servidor recalcula", () => {
    const customPartner = {
      ...partner,
      catalogoPersonalizado: {"3 Minutos de Abraço": {preco: 20}},
    };
    const result = resolveMasterMomentItem({id: "m1"}, mestre, customPartner);
    expect(result.ok).toBe(true);
    expect(result.item.custoFoguinhos).toBe(20);
  });
});

describe("momentPricing — custom ids", () => {
  test("identifica ids custom VIP", () => {
    expect(isCustomMomentId("custom_pareamento_item")).toBe(true);
    expect(isCustomMomentId("mestre-1")).toBe(false);
  });
});

describe("momentPricing — getCatalogCfg", () => {
  test("retorna cfg por nome do momento", () => {
    const cfg = getCatalogCfg({"Jantar": {preco: 8}}, "Jantar");
    expect(cfg.preco).toBe(8);
  });
});
