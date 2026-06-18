/* eslint-disable linebreak-style */
jest.mock("./config", () => ({
  admin: {
    appCheck: jest.fn(() => ({
      verifyToken: jest.fn(),
    })),
  },
}));

const {getAppCheckMode} = require("./appCheck");

describe("getAppCheckMode", () => {
  const prev = process.env.ENFORCE_APP_CHECK;

  afterEach(() => {
    if (prev === undefined) delete process.env.ENFORCE_APP_CHECK;
    else process.env.ENFORCE_APP_CHECK = prev;
  });

  test("off por padrão", () => {
    delete process.env.ENFORCE_APP_CHECK;
    expect(getAppCheckMode()).toBe("off");
  });

  test("monitor", () => {
    process.env.ENFORCE_APP_CHECK = "monitor";
    expect(getAppCheckMode()).toBe("monitor");
  });

  test("enforce", () => {
    process.env.ENFORCE_APP_CHECK = "true";
    expect(getAppCheckMode()).toBe("enforce");
  });
});
