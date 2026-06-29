"use strict";

const {
  getActiveConnectionCount,
  hasConnectionToUid,
  wouldExceedConnectionLimit,
} = require("./connections");

describe("connections", () => {
  test("getActiveConnectionCount usa pareamentosAtivos", () => {
    const data = {pareamentosAtivos: [{uid: "a"}, {uid: "b"}]};
    expect(getActiveConnectionCount(data)).toBe(2);
  });

  test("getActiveConnectionCount fallback pareadoUid legado", () => {
    expect(getActiveConnectionCount({pareadoUid: "x"})).toBe(1);
    expect(getActiveConnectionCount({})).toBe(0);
  });

  test("hasConnectionToUid detecta uid na lista ou legado", () => {
    const data = {pareamentosAtivos: [{uid: "b"}], pareadoUid: "c"};
    expect(hasConnectionToUid(data, "b")).toBe(true);
    expect(hasConnectionToUid(data, "c")).toBe(true);
    expect(hasConnectionToUid(data, "z")).toBe(false);
  });

  test("wouldExceedConnectionLimit VIP com 5 conexões", () => {
    const vip = {
      vip: true,
      pareamentosAtivos: [
        {uid: "1"}, {uid: "2"}, {uid: "3"}, {uid: "4"}, {uid: "5"},
      ],
    };
    expect(wouldExceedConnectionLimit(vip, "6", 5)).toBe(true);
    expect(wouldExceedConnectionLimit(vip, "3", 5)).toBe(false);
  });

  test("wouldExceedConnectionLimit VIP com 4 permite 5ª", () => {
    const vip = {
      vip: true,
      pareamentosAtivos: [{uid: "1"}, {uid: "2"}, {uid: "3"}, {uid: "4"}],
    };
    expect(wouldExceedConnectionLimit(vip, "5", 5)).toBe(false);
  });
});
