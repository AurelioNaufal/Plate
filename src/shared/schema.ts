// The new Sheet's data tabs. Columns are decided here once so later plans
// never need a schema migration. Rows are read and written by header name.

export type ColType = "string" | "number" | "boolean" | "date";
export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

const s = "string" as const;
const n = "number" as const;
const b = "boolean" as const;
const d = "date" as const;

export const TABS = {
  Transactions: { columns: [["ID", s], ["Type", s], ["Date", d], ["Amount", n], ["Description", s], ["Category", s], ["Source", s], ["MealID", s], ["RecurringID", s], ["CreatedAt", s]] },
  Categories: { columns: [["ID", s], ["Name", s], ["Type", s], ["Hidden", b], ["SortOrder", n]] },
  Meals: { columns: [["ID", s], ["Date", d], ["Time", s], ["Name", s], ["Kcal", n], ["Protein", n], ["InBudget", b], ["TransactionID", s], ["Items", s], ["Estimated", b], ["CreatedAt", s]] },
  SavedFoods: { columns: [["ID", s], ["Name", s], ["Kcal", n], ["Protein", n], ["Price", n], ["SortOrder", n]] },
  QuickAdd: { columns: [["ID", s], ["Name", s], ["Kcal", n], ["Protein", n], ["SortOrder", n]] },
  Recurring: { columns: [["ID", s], ["Name", s], ["Amount", n], ["Category", s], ["Frequency", s], ["Weekday", n], ["MonthDay", n], ["Active", b], ["StartDate", d], ["ActiveSince", d], ["ChargedThrough", d]] },
  Budgets: { columns: [["ID", s], ["Category", s], ["MonthlyLimit", n]] },
  Exercises: { columns: [["ID", s], ["Name", s], ["MuscleGroup", s], ["SortOrder", n]] },
  Routines: { columns: [["ID", s], ["Name", s], ["Weekdays", s], ["ExerciseIDs", s]] },
  Workouts: { columns: [["ID", s], ["SessionID", s], ["Date", d], ["ExerciseID", s], ["SetNumber", n], ["WeightKg", n], ["Reps", n], ["Done", b]] },
  Body: { columns: [["ID", s], ["Date", d], ["WeightKg", n], ["BodyFatPct", n], ["WaistCm", n], ["ArmCm", n]] },
  Settings: { columns: [["ID", s], ["Value", s]] },
} satisfies Record<string, { columns: [string, ColType][] }>;

export type TabName = keyof typeof TABS;
export const TAB_NAMES = Object.keys(TABS) as TabName[];

export function isTabName(x: unknown): x is TabName {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(TABS, x);
}

export function columnNames(tab: TabName): string[] {
  return TABS[tab].columns.map(([name]) => name);
}

export function columnType(tab: TabName, column: string): ColType | undefined {
  return (TABS[tab].columns as [string, ColType][]).find(([name]) => name === column)?.[1];
}

/** The owner's categories from the old Sheet; seeded into the Categories tab. */
export const DEFAULT_CATEGORIES = {
  expense: [
    "Food", "Rent", "Utilities", "Campus Stuff/Taiwan Government", "Transportation",
    "Recreation & Entertainment", "Furniture", "Health", "Personal Spending", "Saving", "Other",
  ],
  income: ["Family", "Scholarship Allowance", "Gift", "Part-Time Jobs", "Other"],
};

export type TxType = "expense" | "income";
export type TxSource = "app" | "migrated" | "recurring" | "manual";

export interface Transaction extends Row {
  ID: string;
  Type: TxType;
  Date: string;
  Amount: number;
  Description: string | null;
  Category: string | null;
  Source: TxSource | null;
}

export interface Category extends Row {
  ID: string;
  Name: string;
  Type: TxType;
  Hidden: boolean | null;
  SortOrder: number | null;
}
