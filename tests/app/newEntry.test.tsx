// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewEntry } from "../../src/app/screens/NewEntry";

const data = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const categories = [
  { ID: "c1", Name: "Food", Type: "expense", Hidden: false, SortOrder: 1 },
  { ID: "c2", Name: "Utilities", Type: "expense", Hidden: false, SortOrder: 2 },
  { ID: "c3", Name: "Furniture", Type: "expense", Hidden: true, SortOrder: 3 },
  { ID: "c4", Name: "Family", Type: "income", Hidden: false, SortOrder: 1 },
];

let save: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;
beforeEach(() => {
  save = vi.fn(async () => {});
  remove = vi.fn(async () => {});
  data.current = {
    rows: {
      Categories: categories,
      Transactions: [{ ID: "t9", Type: "expense", Date: "2026-11-11", Amount: 200, Description: "Haircut", Category: "Utilities", Source: "migrated" }],
    },
    save,
    remove,
  };
});

test("saves a typed expense with today's date", async () => {
  const onDone = vi.fn();
  render(<NewEntry today="2026-11-12" onDone={onDone} />);
  await userEvent.click(screen.getByRole("tab", { name: "Expense" }));
  await userEvent.type(screen.getByLabelText("Amount (NT$)"), "1,200");
  await userEvent.type(screen.getByLabelText("Description"), "Haircut");
  await userEvent.selectOptions(screen.getByLabelText("Category"), "Utilities");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith(
    "Transactions",
    expect.objectContaining({ Type: "expense", Amount: 1200, Date: "2026-11-12", Description: "Haircut", Category: "Utilities", Source: "app" }),
  );
  expect(onDone).toHaveBeenCalled();
});

test("an amount with cents shows an error and does not save", async () => {
  render(<NewEntry today="2026-11-12" onDone={() => {}} />);
  await userEvent.click(screen.getByRole("tab", { name: "Expense" }));
  await userEvent.type(screen.getByLabelText("Amount (NT$)"), "80.5");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByText("Use whole NT$ (no cents)")).toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
});

test("a new entry opens on the Meal tab", () => {
  render(<NewEntry today="2026-11-12" onDone={() => {}} />);
  expect(screen.getByRole("tab", { name: "Meal" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("Name")).toBeInTheDocument();
});

test("opening an expense that belongs to a meal shows the meal", () => {
  const rows = data.current.rows as Record<string, unknown[]>;
  data.current = {
    ...data.current,
    rows: {
      ...rows,
      Meals: [{ ID: "m1", Date: "2026-11-12", Name: "Buffet lunch", Kcal: 650, Protein: 32, InBudget: true, TransactionID: "t1" }],
      Transactions: [...rows.Transactions, { ID: "t1", Type: "expense", Date: "2026-11-12", Amount: 80, Description: "Buffet lunch", Category: "Food", MealID: "m1" }],
    },
  };
  render(<NewEntry editId="t1" today="2026-11-12" onDone={() => {}} />);
  expect(screen.getByLabelText("Name")).toHaveValue("Buffet lunch");
  expect(screen.getByLabelText("Price (NT$)")).toHaveValue("80");
});

test("hidden categories are not offered", async () => {
  render(<NewEntry today="2026-11-12" onDone={() => {}} />);
  await userEvent.click(screen.getByRole("tab", { name: "Expense" }));
  const options = within(screen.getByLabelText("Category")).getAllByRole("option").map((o) => o.textContent);
  expect(options).toContain("Food");
  expect(options).not.toContain("Furniture");
  expect(options).not.toContain("Family");
});

test("income shows income categories", async () => {
  render(<NewEntry today="2026-11-12" onDone={() => {}} />);
  await userEvent.click(screen.getByRole("tab", { name: "Income" }));
  const options = within(screen.getByLabelText("Category")).getAllByRole("option").map((o) => o.textContent);
  expect(options).toContain("Family");
  expect(options).not.toContain("Food");
});

test("editing keeps the original source and can delete after confirming", async () => {
  const onDone = vi.fn();
  render(<NewEntry editId="t9" today="2026-11-12" onDone={onDone} />);
  expect(screen.getByLabelText("Amount (NT$)")).toHaveValue("200");

  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(remove).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
  expect(remove).toHaveBeenCalledWith("Transactions", "t9");
  expect(onDone).toHaveBeenCalled();
});

test("editing an imported row keeps its ID and date and marks it as app-owned", async () => {
  // A migration re-run replaces rows still marked "migrated"; an edited row must survive it.
  render(<NewEntry editId="t9" today="2026-11-12" onDone={() => {}} />);
  const amount = screen.getByLabelText("Amount (NT$)");
  await userEvent.clear(amount);
  await userEvent.type(amount, "180");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(save).toHaveBeenCalledWith("Transactions", expect.objectContaining({ ID: "t9", Amount: 180, Date: "2026-11-11", Source: "app" }));
});
