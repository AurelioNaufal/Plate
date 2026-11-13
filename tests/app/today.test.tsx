// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Today } from "../../src/app/screens/Today";
import type { Row } from "../../src/shared/schema";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const meals: Row[] = [
  { ID: "m1", Date: "2026-11-13", Time: "08:00", Name: "Bread + milk", Protein: 30, Kcal: 500, InBudget: true, TransactionID: "t1" },
  { ID: "m2", Date: "2026-11-13", Time: "12:00", Name: "Snack from home", Protein: null, Kcal: null, InBudget: false, TransactionID: null },
  { ID: "m3", Date: "2026-11-13", Time: "19:00", Name: "Dumplings", Protein: 20, Kcal: 300, InBudget: true, TransactionID: "t3" },
  { ID: "old", Date: "2026-11-12", Time: "19:00", Name: "Yesterday", Protein: 99, Kcal: 999 },
];
const txs: Row[] = [
  { ID: "t1", Type: "expense", Date: "2026-11-13", Amount: 50, Category: "Food", MealID: "m1" },
  { ID: "t3", Type: "expense", Date: "2026-11-13", Amount: 60, Category: "Food", MealID: "m3" },
];
const recurring: Row[] = [
  { ID: "r1", Name: "Gym", Amount: 40, Category: "Health", Frequency: "weekly", Weekday: 0, Active: true, StartDate: "2026-11-15" },
  { ID: "r2", Name: "Laundry", Amount: 20, Category: "Utilities", Frequency: "weekly", Weekday: 0, Active: true, StartDate: "2026-11-15" },
];

const setRows = (over: Partial<Record<string, Row[]>> = {}) => {
  data.current = { rows: { Transactions: txs, Meals: meals, Recurring: recurring, Settings: [], ...over } };
};
beforeEach(() => setRows());

const renderToday = (props: Partial<Parameters<typeof Today>[0]> = {}) => render(<Today today="2026-11-13" {...props} />);

test("the protein ring adds only tracked values against the default 120 g target", () => {
  renderToday();
  const rings = within(screen.getByRole("region", { name: "Today's nutrition" }));
  expect(rings.getByText("50g / 120g")).toBeInTheDocument();
  expect(rings.getByText("70g to go")).toBeInTheDocument();
  expect(rings.getByRole("img", { name: "Protein 50 of 120 grams" })).toBeInTheDocument();
});

test("a meal with no numbers is still listed, marked no nutrition", () => {
  renderToday();
  const list = within(screen.getByRole("region", { name: "Meals today" }));
  expect(list.getAllByRole("button").map((b) => b.textContent)).toEqual([
    expect.stringContaining("Bread + milk"),
    expect.stringContaining("Snack from home"),
    expect.stringContaining("Dumplings"),
  ]);
  const snack = list.getByRole("button", { name: /Snack from home/ });
  expect(snack).toHaveTextContent("no nutrition");
  expect(snack).toHaveTextContent("not in budget");
  expect(list.getByRole("button", { name: /Bread \+ milk/ })).toHaveTextContent("NT$50");
});

test("tapping a meal opens it", async () => {
  const onOpenMeal = vi.fn();
  renderToday({ onOpenMeal });
  await userEvent.click(within(screen.getByRole("region", { name: "Meals today" })).getByRole("button", { name: /Dumplings/ }));
  expect(onOpenMeal).toHaveBeenCalledWith("m3");
});

test("without a calorie target it offers to set one", async () => {
  const onOpenTargets = vi.fn();
  renderToday({ onOpenTargets });
  await userEvent.click(screen.getByRole("button", { name: "Set a calorie target" }));
  expect(onOpenTargets).toHaveBeenCalled();
});

test("with a calorie target it shows what is left", () => {
  setRows({ Settings: [{ ID: "kcalTarget", Value: "2200" }] });
  renderToday();
  expect(screen.getByText("1,400 left")).toBeInTheDocument();
  expect(screen.getByText("800 kcal")).toBeInTheDocument();
});

test("hitting the protein target says so", () => {
  setRows({ Settings: [{ ID: "proteinTarget", Value: "40" }] });
  renderToday();
  expect(screen.getByText("Target hit")).toBeInTheDocument();
});

test("coming up lists the next 7 days of recurring charges", () => {
  renderToday();
  const coming = within(screen.getByRole("region", { name: "Coming up" }));
  expect(coming.getByText("Sun 15 Nov · Gym · NT$40")).toBeInTheDocument();
  expect(coming.getByText("Sun 15 Nov · Laundry · NT$20")).toBeInTheDocument();
});

test("coming up says when there is nothing", () => {
  setRows({ Recurring: [] });
  renderToday();
  expect(screen.getByText("Nothing in the next 7 days")).toBeInTheDocument();
});
