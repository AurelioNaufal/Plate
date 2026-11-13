import { seedCategories, summaryFormulas } from "../../src/backend/setup";

describe("seedCategories", () => {
  let n = 0;
  const rows = seedCategories(() => `c${++n}`);

  test("seeds 11 expense and 5 income categories", () => {
    expect(rows).toHaveLength(16);
    expect(rows.filter((r) => r.Type === "expense")).toHaveLength(11);
    expect(rows.filter((r) => r.Type === "income")).toHaveLength(5);
  });
  test("starts with Food, ordered from 1 within each type, none hidden", () => {
    expect(rows[0]).toMatchObject({ Name: "Food", Type: "expense", SortOrder: 1, Hidden: false });
    expect(rows.find((r) => r.Type === "income")).toMatchObject({ Name: "Family", SortOrder: 1 });
  });
  test("names are unique within each type", () => {
    for (const type of ["expense", "income"]) {
      const names = rows.filter((r) => r.Type === type).map((r) => r.Name);
      expect(new Set(names).size).toBe(names.length);
    }
  });
});

describe("summaryFormulas", () => {
  const f = Object.fromEntries(summaryFormulas().map((x) => [x.cell, x.formula]));
  test("has the month list helper, category list and per-category totals", () => {
    expect(f.H2).toContain("UNIQUE");
    expect(f.A4).toContain("Categories!");
    expect(f.B4).toContain("$B$1");
    expect(f.B4).toContain('"All time"');
  });
  test("has totals for spent, income and net", () => {
    expect(f.E3).toContain('"expense"');
    expect(f.E4).toContain('"income"');
    expect(f.E5).toBe("=E4-E3");
  });
});
