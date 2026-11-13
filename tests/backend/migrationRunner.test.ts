import { mergeForMigration } from "../../src/backend/migrationRunner";

const headers = ["ID", "Type", "Date", "Amount", "Description", "Category", "Source", "Notes"];

test("keeps non-migrated rows (with extra columns) after the fresh import and drops old migrated rows", () => {
  const data = [
    headers,
    ["m1", "expense", "2025-08-26", 100, "old import", "Food", "migrated", ""],
    ["a1", "expense", "2026-11-12", 80, "app row", "Food", "app", "my note"],
    ["", "", "", "", "", "", "", ""],
  ];
  const { values, clearFrom, clearRows } = mergeForMigration(data, [
    { ID: "n1", Type: "expense", Date: "2025-08-26", Amount: 100, Description: "fresh", Category: "Food", Source: "migrated" },
  ]);
  expect(values.map((r) => r[0])).toEqual(["n1", "a1"]);
  expect(values[1][7]).toBe("my note");
  // Rows 2..3 are overwritten; only the leftover tail (row 4) is cleared afterwards.
  expect(clearFrom).toBe(4);
  expect(clearRows).toBe(1);
});

test("refuses to run without a Source column, rather than duplicating imports", () => {
  expect(() => mergeForMigration([["ID", "Type"], ["m1", "expense"]], [])).toThrow(/Source/);
});
