/* eslint-disable max-len */
"use strict";

const {
  collectPartnerEntries,
  buildPartnerUpdateAfterRemoval,
  pareamentoIdFromPhones,
} = require("./deleteAccount");

const FieldValue = {
  delete: () => ({_delete: true}),
};

describe("deleteAccount — collectPartnerEntries", () => {
  test("lista parceiros de pareamentosAtivos", () => {
    const partners = collectPartnerEntries({
      pareamentosAtivos: [
        {uid: "p1", telefone: "11999991111", pareamentoId: "a_b"},
        {uid: "p2", telefone: "11888882222"},
      ],
    }, "me");
    expect(partners).toHaveLength(2);
    expect(partners[0].uid).toBe("p1");
  });

  test("inclui pareadoUid legado", () => {
    const partners = collectPartnerEntries({
      pareadoUid: "legacy",
      pareadoCom: "11777773333",
      pareamentosAtivos: [],
    }, "me");
    expect(partners[0].uid).toBe("legacy");
  });
});

describe("deleteAccount — buildPartnerUpdateAfterRemoval", () => {
  test("limpa legado quando última conexão", () => {
    const update = buildPartnerUpdateAfterRemoval({
      pareamentosAtivos: [{uid: "gone", telefone: "11"}],
      pareadoUid: "gone",
    }, "gone", FieldValue);
    expect(update.pareamentosAtivos).toEqual([]);
    expect(update.pareadoUid).toEqual({_delete: true});
    expect(update.foguinhos).toBe(0);
  });

  test("mantém primeira conexão como legado", () => {
    const update = buildPartnerUpdateAfterRemoval({
      pareamentosAtivos: [
        {uid: "gone", telefone: "11"},
        {uid: "stay", telefone: "22"},
      ],
    }, "gone", FieldValue);
    expect(update.pareadoUid).toBe("stay");
    expect(update.pareadoCom).toBe("22");
  });
});

describe("deleteAccount — pareamentoIdFromPhones", () => {
  test("ordena telefones", () => {
    expect(pareamentoIdFromPhones("11888882222", "11999991111"))
        .toBe("11888882222_11999991111");
  });
});
