const {planFundadorGrant, MAX_FUNDADOR_COUPLES} = require("./fundadores");

function snap(data) {
  if (data == null) return {exists: false, data: () => null};
  return {exists: true, data: () => data};
}

describe("planFundadorGrant", () => {
  test("não concede se ambos já são fundadores", () => {
    const plan = planFundadorGrant(
        snap({couplesGranted: 10}),
        {fundador: true, fundadorNumero: 3},
        {fundador: true, fundadorNumero: 3},
    );
    expect(plan).toEqual({
      grantSender: false,
      grantReceiver: false,
      nextCount: null,
      fundadorNumero: null,
    });
  });

  test("concede aos dois e incrementa quando há vaga", () => {
    const plan = planFundadorGrant(
        snap({couplesGranted: 0}),
        {},
        {},
    );
    expect(plan).toEqual({
      grantSender: true,
      grantReceiver: true,
      nextCount: 1,
      fundadorNumero: 1,
    });
  });

  test("parceiro novo herda número sem consumir slot", () => {
    const plan = planFundadorGrant(
        snap({couplesGranted: 42}),
        {fundador: true, fundadorNumero: 7},
        {},
    );
    expect(plan).toEqual({
      grantSender: false,
      grantReceiver: true,
      nextCount: null,
      fundadorNumero: 7,
    });
  });

  test("não concede quando atingiu o teto", () => {
    const plan = planFundadorGrant(
        snap({couplesGranted: MAX_FUNDADOR_COUPLES}),
        {},
        {},
    );
    expect(plan).toEqual({
      grantSender: false,
      grantReceiver: false,
      nextCount: null,
      fundadorNumero: null,
    });
  });

  test("doc inexistente conta como zero", () => {
    const plan = planFundadorGrant(snap(null), {}, {});
    expect(plan).toEqual({
      grantSender: true,
      grantReceiver: true,
      nextCount: 1,
      fundadorNumero: 1,
    });
  });
});
