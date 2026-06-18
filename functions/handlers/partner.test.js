/* eslint-disable linebreak-style, max-len */
jest.mock("../lib/config", () => ({
  admin: {
    auth: jest.fn(() => ({
      verifyIdToken: jest.fn(),
    })),
    firestore: jest.fn(),
  },
}));

jest.mock("../lib/http", () => ({
  setCorsHeaders: jest.fn(),
  rateLimitHttp: jest.fn(() => false),
}));

jest.mock("../lib/appCheck", () => ({
  requireAppCheck: jest.fn(async () => false),
}));

const {admin} = require("../lib/config");
const {areUsersPaired} = require("../lib/pairing");

describe("areUsersPaired + perfil público", () => {
  test("pareados via pareamentosAtivos", () => {
    const sender = {
      pareamentosAtivos: [{uid: "b", pareamentoId: "p1"}],
    };
    const partner = {
      pareamentosAtivos: [{uid: "a", pareamentoId: "p1"}],
    };
    expect(areUsersPaired(sender, partner, "a", "b")).toBe(true);
  });

  test("não pareados", () => {
    expect(areUsersPaired({pareamentosAtivos: []}, {pareamentosAtivos: []}, "a", "b"))
        .toBeFalsy();
  });
});

describe("getParceiroPerfil handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("exporta função onRequest", () => {
    const partner = require("./partner");
    expect(typeof partner.getParceiroPerfil).toBe("function");
    expect(admin.auth).toBeDefined();
  });
});
