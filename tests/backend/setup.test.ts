import { seedCategories, seedQuickAdd, seedSavedFoods, seedRecurring, seedExercises, seedRoutines, summaryFormulas, planSeeds } from "../../src/backend/setup";

describe("planSeeds", () => {
  let k = 0;
  const id = () => `p${++k}`;
  const empty = (tab: string) => ({ tab, hasRows: false }) as { tab: "Recurring"; hasRows: boolean };

  test("an empty tab is seeded once and marked", () => {
    const plan = planSeeds([empty("Recurring")], [], "2026-11-13", id);
    expect(plan.writes.map((w) => w.tab)).toEqual(["Recurring"]);
    expect(plan.markers).toEqual([{ ID: "seeded:Recurring", Value: "2026-11-13" }]);
  });

  test("a tab emptied by the owner is not seeded again", () => {
    const plan = planSeeds([empty("Recurring")], [{ ID: "seeded:Recurring", Value: "2026-11-13" }], "2027-03-01", id);
    expect(plan.writes).toEqual([]);
    expect(plan.markers).toEqual([]);
  });

  test("a tab that already has rows only gets its marker", () => {
    const plan = planSeeds([{ tab: "Categories", hasRows: true }], [], "2026-11-13", id);
    expect(plan.writes).toEqual([]);
    expect(plan.markers).toEqual([{ ID: "seeded:Categories", Value: "2026-11-13" }]);
  });

  test("recurring starter items never start in the past", () => {
    const plan = planSeeds([empty("Recurring")], [], "2027-03-01", id);
    expect(plan.writes[0].rows.map((r) => r.StartDate)).toEqual(["2027-03-01", "2027-03-01"]);
    const early = planSeeds([empty("Recurring")], [], "2026-11-13", id);
    expect(early.writes[0].rows.map((r) => r.StartDate)).toEqual(["2026-11-15", "2026-11-15"]);
  });
});

describe("starter rows", () => {
  let n = 0;
  const newId = () => `s${++n}`;

  test("seedQuickAdd has the 9 buttons in order", () => {
    const rows = seedQuickAdd(newId);
    expect(rows).toHaveLength(9);
    expect(rows[0]).toMatchObject({ Name: "Rice (scoop)", Kcal: 200, Protein: 4, SortOrder: 1 });
    expect(rows[8]).toMatchObject({ Name: "Veggies", Kcal: 100, Protein: 2, SortOrder: 9 });
    expect(rows.map((r) => r.SortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rows.every((r) => typeof r.ID === "string" && r.ID)).toBe(true);
  });

  test("seedSavedFoods has the 3 usual foods", () => {
    const rows = seedSavedFoods(newId);
    expect(rows).toHaveLength(3);
    expect(rows).toContainEqual(expect.objectContaining({ Name: "Combo Roti + Milk Fami", Price: 49, Kcal: 450, Protein: 14, SortOrder: 1 }));
    // McChicken + medium fries + lemon tea.
    expect(rows).toContainEqual(expect.objectContaining({ Name: "McD McChicken Meal", Price: 151, Kcal: 880, Protein: 19 }));
  });

  test("seedRecurring has gym and laundry every Sunday from 15 Nov", () => {
    const rows = seedRecurring(newId);
    expect(rows).toHaveLength(2);
    const base = { Frequency: "weekly", Weekday: 0, MonthDay: null, StartDate: "2026-11-15", Active: true, ActiveSince: null, ChargedThrough: null };
    expect(rows[0]).toMatchObject({ Name: "Gym", Amount: 40, Category: "Health", ...base });
    expect(rows[1]).toMatchObject({ Name: "Laundry", Amount: 20, Category: "Utilities", ...base });
  });
});

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

describe("gym starter rows", () => {
  let g = 0;
  const gid = () => `g${++g}`;

  test("seedExercises has the 11 starters with muscle groups", () => {
    const rows = seedExercises(gid);
    expect(rows).toHaveLength(11);
    expect(rows[8]).toMatchObject({ Name: "Abs", MuscleGroup: "Core", SortOrder: 9 });
    expect(rows[0]).toMatchObject({ Name: "Lat pulldown", MuscleGroup: "Back", SortOrder: 1 });
  });

  test("seedRoutines points Push, Pull and Anytime at the exercises by name", () => {
    const ex = seedExercises(gid);
    const id = (name: string) => ex.find((e) => e.Name === name)!.ID;
    const rows = seedRoutines(ex, gid);
    expect(rows.map((r) => [r.Name, r.Weekdays])).toEqual([["Push", "1,4"], ["Pull", "2,5"], ["Anytime", ""]]);
    expect(rows[0].ExerciseIDs).toBe(["Bench press", "Incline bench press", "Shoulder press", "Pec deck (chest)", "Tricep"].map(id).join(","));
    expect(String(rows[1].ExerciseIDs).split(",")).toHaveLength(3);
    expect(rows[2].ExerciseIDs).toBe(["Leg extension", "Leg curl", "Abs"].map(id).join(","));
  });

  test("seedRoutines matches names in any case and skips missing ones", () => {
    const rows = seedRoutines([{ ID: "x1", Name: "BENCH PRESS" }], gid);
    expect(rows[0].ExerciseIDs).toBe("x1");
    expect(rows[1].ExerciseIDs).toBe("");
  });

  test("planSeeds writes routines that use the exercises written in the same run", () => {
    const plan = planSeeds([{ tab: "Exercises", hasRows: false }, { tab: "Routines", hasRows: false }], [], "2026-11-22", gid);
    const ex = plan.writes.find((w) => w.tab === "Exercises")!.rows;
    const routines = plan.writes.find((w) => w.tab === "Routines")!.rows;
    const exIds = new Set(ex.map((e) => e.ID));
    expect(String(routines[0].ExerciseIDs).split(",").every((i) => exIds.has(i))).toBe(true);
  });

  test("planSeeds uses existing exercises when only Routines is empty", () => {
    const existing = { Exercises: [{ ID: "old-bench", Name: "Bench press" }] };
    const plan = planSeeds([{ tab: "Exercises", hasRows: true }, { tab: "Routines", hasRows: false }], [], "2026-11-22", gid, existing);
    expect(plan.writes.map((w) => w.tab)).toEqual(["Routines"]);
    expect(plan.writes[0].rows[0].ExerciseIDs).toBe("old-bench");
  });
});
