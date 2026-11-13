// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MealForm } from "../../src/app/components/MealForm";
import type { Change } from "../../src/shared/changes";
import type { Row } from "../../src/shared/schema";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const categories: Row[] = [{ ID: "c1", Name: "Food", Type: "expense", Hidden: false, SortOrder: 1 }];
const quickAdd: Row[] = [
  { ID: "q2", Name: "Chicken breast", Kcal: 180, Protein: 30, SortOrder: 2 },
  { ID: "q1", Name: "Rice (scoop)", Kcal: 200, Protein: 4, SortOrder: 1 },
];
const savedFoods: Row[] = [{ ID: "f1", Name: "Combo Roti + Milk Fami", Price: 49, Kcal: 450, Protein: 14, SortOrder: 1 }];

let apply: ReturnType<typeof vi.fn>;
beforeEach(() => {
  apply = vi.fn(async () => {});
  data.current = { rows: { Categories: categories, QuickAdd: quickAdd, SavedFoods: savedFoods, Transactions: [], Meals: [] }, apply };
});

const renderForm = (props: Partial<Parameters<typeof MealForm>[0]> = {}) =>
  render(<MealForm today="2026-11-13" nowTime="12:10" onDone={() => {}} {...props} />);
const quick = () => within(screen.getByRole("group", { name: "Quick add" }));
const appliedChanges = (): Change[] => apply.mock.calls[0][0];
const upserted = (tab: string) => appliedChanges().filter((c): c is { tab: "Meals"; row: Row } => "row" in c && c.tab === tab);

test("quick-add adds each portion to the totals, names the meal, and − takes one away", async () => {
  renderForm();
  await userEvent.click(quick().getByRole("button", { name: "Chicken breast" }));
  await userEvent.click(quick().getByRole("button", { name: "Chicken breast" }));
  await userEvent.click(quick().getByRole("button", { name: "Rice (scoop)" }));
  expect(screen.getByLabelText("Kcal")).toHaveValue("560");
  expect(screen.getByLabelText("Protein (g)")).toHaveValue("64");
  expect(screen.getByLabelText("Name")).toHaveValue("Prasmanan");
  expect(quick().getByText("×2")).toBeInTheDocument();

  await userEvent.click(quick().getByRole("button", { name: "Remove one Chicken breast" }));
  expect(screen.getByLabelText("Kcal")).toHaveValue("380");
  expect(screen.getByLabelText("Protein (g)")).toHaveValue("34");
});

test("quick-add keeps a value typed by hand and adds to it", async () => {
  renderForm();
  await userEvent.type(screen.getByLabelText("Kcal"), "100");
  await userEvent.click(quick().getByRole("button", { name: "Rice (scoop)" }));
  expect(screen.getByLabelText("Kcal")).toHaveValue("300");
});

test("quick-add buttons follow SortOrder", () => {
  renderForm();
  expect(quick().getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual(["Rice (scoop)", "Chicken breast"]);
});

test("saving a quick-add meal sends the meal and its expense together, items in the order tapped", async () => {
  const onDone = vi.fn();
  renderForm({ onDone });
  await userEvent.click(quick().getByRole("button", { name: "Chicken breast" }));
  await userEvent.click(quick().getByRole("button", { name: "Rice (scoop)" }));
  await userEvent.type(screen.getByLabelText("Price (NT$)"), "80");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(apply).toHaveBeenCalledTimes(1);
  expect(appliedChanges()).toHaveLength(2);
  expect(upserted("Meals")[0].row).toMatchObject({ Name: "Prasmanan", Items: "Chicken breast, Rice (scoop)", Kcal: 380, Protein: 34, Date: "2026-11-13", Time: "12:10", InBudget: true });
  expect(upserted("Transactions")[0].row).toMatchObject({ Amount: 80, Category: "Food", Description: "Prasmanan" });
  expect(onDone).toHaveBeenCalled();
});

test("a saved food fills name, price, kcal and protein", async () => {
  renderForm();
  await userEvent.click(within(screen.getByRole("group", { name: "Saved foods" })).getByRole("button", { name: "Combo Roti + Milk Fami" }));
  expect(screen.getByLabelText("Name")).toHaveValue("Combo Roti + Milk Fami");
  expect(screen.getByLabelText("Price (NT$)")).toHaveValue("49");
  expect(screen.getByLabelText("Kcal")).toHaveValue("450");
  expect(screen.getByLabelText("Protein (g)")).toHaveValue("14");
});

test("a meal not counted in the budget saves without a price as one change", async () => {
  renderForm();
  await userEvent.type(screen.getByLabelText("Name"), "Dinner at home");
  await userEvent.click(screen.getByRole("switch", { name: "Count in budget" }));
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(appliedChanges()).toHaveLength(1);
  expect(upserted("Meals")[0].row).toMatchObject({ InBudget: false, TransactionID: null });
});

test("a counted meal without a price shows the price error and does not save", async () => {
  renderForm();
  await userEvent.type(screen.getByLabelText("Name"), "Lunch");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByText("Enter a price, or turn off Count in budget")).toBeInTheDocument();
  expect(apply).not.toHaveBeenCalled();
});

test("editing a meal keeps its Items unless quick-add is used, and can delete both rows", async () => {
  const meal: Row = { ID: "m1", Date: "2026-11-12", Time: "19:00", Name: "Buffet dinner", Kcal: 700, Protein: 35, InBudget: true, TransactionID: "t1", Items: "Rice, Tofu", Estimated: false };
  const tx: Row = { ID: "t1", Type: "expense", Date: "2026-11-12", Amount: 90, Description: "Buffet dinner", Category: "Food", Source: "app", MealID: "m1" };
  data.current = { ...data.current, rows: { ...(data.current.rows as object), Meals: [meal], Transactions: [tx] } };
  renderForm({ meal });
  expect(screen.getByLabelText("Price (NT$)")).toHaveValue("90");
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(upserted("Meals")[0].row).toMatchObject({ ID: "m1", Items: "Rice, Tofu" });
  expect(upserted("Transactions")[0].row).toMatchObject({ ID: "t1", Amount: 90 });

  await userEvent.click(screen.getByRole("button", { name: "Delete" }));
  await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
  expect(apply).toHaveBeenLastCalledWith([{ tab: "Meals", removeId: "m1" }, { tab: "Transactions", removeId: "t1" }]);
});
