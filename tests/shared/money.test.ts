import { parseAmountInput, parseSheetAmount, formatNT } from "../../src/shared/money";

describe("parseSheetAmount", () => {
  test("parses currency-formatted whole amounts", () => {
    expect(parseSheetAmount("$3,640.00")).toBe(3640);
    expect(parseSheetAmount("$62.00")).toBe(62);
    expect(parseSheetAmount("NT$80")).toBe(80);
    expect(parseSheetAmount(80)).toBe(80);
  });
  test("rejects fractional and empty amounts", () => {
    expect(parseSheetAmount("$49.50")).toBeNull();
    expect(parseSheetAmount("")).toBeNull();
    expect(parseSheetAmount("abc")).toBeNull();
  });
});

describe("parseAmountInput", () => {
  test("accepts thousands separators and whitespace", () => {
    expect(parseAmountInput("1,200")).toEqual({ ok: true, value: 1200 });
    expect(parseAmountInput(" 80 ")).toEqual({ ok: true, value: 80 });
  });
  test.each(["80.5", "", "-5", "0", "abc"])("rejects %j", (input) => {
    const r = parseAmountInput(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
});

describe("formatNT", () => {
  test("formats with NT$ and thousands separators", () => {
    expect(formatNT(1235)).toBe("NT$1,235");
    expect(formatNT(80)).toBe("NT$80");
  });
});
