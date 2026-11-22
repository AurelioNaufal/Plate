// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Budgets } from "../../src/app/screens/Budgets";
import { Today } from "../../src/app/screens/Today";
import { Money } from "../../src/app/screens/Money";
import { realWeek } from "../fixtures/week";
import type { Row } from "../../src/shared/schema";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const cats: Row[] = [
  { ID: "c1", Name: "Food", Type: "expense", Hidden: false, SortOrder: 1 },
  { ID: "c2", Name: "Utilities", Type: "expense", Hidden: false, SortOrder: 2 },
  { ID: "c3", Name: "Old stuff", Type: "expense", Hidden: true, SortOrder: 3 },
  { ID: "c4", Name: "Part-Time Jobs", Type: "income", Hidden: false, SortOrder: 4 },
];
let apply: ReturnType<typeof vi.fn>;
const setRows = (budgets: Row[]) => {
  apply = vi.fn(async () => {});
  data.current = { rows: { Transactions: realWeek, Categories: cats, Budgets: budgets, Meals: [], Recurring: [], Settings: [], Workouts: [], Routines: [] }, pending: [], apply };
};

describe("Budgets screen", () => {
  test("lists visible expense categories, each with a limit field", () => {
    setRows([{ ID: "b1", Category: "Utilities", MonthlyLimit: 800 }]);
    render(<Budgets onBack={() => {}} />);
    expect(screen.getByLabelText("Food monthly limit")).toHaveValue("");
    expect(screen.getByLabelText("Utilities monthly limit")).toHaveValue("800");
    expect(screen.queryByLabelText("Old stuff monthly limit")).toBeNull();
    expect(screen.queryByLabelText("Part-Time Jobs monthly limit")).toBeNull();
  });

  test("setting a limit saves it; clearing one removes the row", async () => {
    setRows([{ ID: "b1", Category: "Utilities", MonthlyLimit: 800 }]);
    render(<Budgets onBack={() => {}} />);
    await userEvent.type(screen.getByLabelText("Food monthly limit"), "6000");
    await userEvent.clear(screen.getByLabelText("Utilities monthly limit"));
    await userEvent.click(screen.getByRole("button", { name: "Save budgets" }));
    expect(apply).toHaveBeenCalledWith([
      { tab: "Budgets", row: { Category: "Food", MonthlyLimit: 6000 } },
      { tab: "Budgets", removeId: "b1" },
    ]);
  });

  test("a limit must be a whole NT$ amount above 0", async () => {
    setRows([]);
    render(<Budgets onBack={() => {}} />);
    await userEvent.type(screen.getByLabelText("Food monthly limit"), "12.5");
    await userEvent.click(screen.getByRole("button", { name: "Save budgets" }));
    expect(screen.getByText("Use a whole NT$ amount above 0")).toBeInTheDocument();
    expect(apply).not.toHaveBeenCalled();
  });
});

test("Today shows what's left of the Food budget this month", () => {
  setRows([{ ID: "b1", Category: "Food", MonthlyLimit: 6000 }]);
  render(<Today today="2026-11-12" />);
  expect(screen.getByText("NT$4,046 left of Food budget this month")).toBeInTheDocument();
});

test("Today says how far over the Food budget is", () => {
  setRows([{ ID: "b1", Category: "Food", MonthlyLimit: 1500 }]);
  render(<Today today="2026-11-12" />);
  expect(screen.getByText("NT$454 over Food budget this month")).toBeInTheDocument();
});

test("Money shows a bar per budget for the month of the period's end", () => {
  setRows([{ ID: "b1", Category: "Food", MonthlyLimit: 2000 }, { ID: "b2", Category: "Utilities", MonthlyLimit: 150 }]);
  render(<Money today="2026-11-12" onOpen={() => {}} />);
  const card = within(screen.getByRole("region", { name: "Budgets" }));
  expect(card.getByText("NT$46 left")).toBeInTheDocument();
  expect(card.getByText("NT$50 over")).toBeInTheDocument();
  expect(card.getAllByRole("meter")).toHaveLength(2);
});
