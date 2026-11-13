// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SavedFoods } from "../../src/app/screens/SavedFoods";
import { QuickAdd } from "../../src/app/screens/QuickAdd";
import { Recurring } from "../../src/app/screens/Recurring";
import type { Row } from "../../src/shared/schema";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const gym: Row = { ID: "r1", Name: "Gym", Amount: 40, Category: "Health", Frequency: "weekly", Weekday: 0, MonthDay: null, Active: true, StartDate: "2026-11-15", ActiveSince: null, ChargedThrough: "2026-11-15" };

let save: ReturnType<typeof vi.fn>;
let remove: ReturnType<typeof vi.fn>;
let apply: ReturnType<typeof vi.fn>;
beforeEach(() => {
  save = vi.fn(async () => {});
  remove = vi.fn(async () => {});
  apply = vi.fn(async () => {});
  data.current = {
    rows: {
      SavedFoods: [
        { ID: "f2", Name: "7-11 Tuna Onigiri", Price: 35, Kcal: 200, Protein: 6, SortOrder: 2 },
        { ID: "f1", Name: "Combo Roti + Milk Fami", Price: 49, Kcal: 450, Protein: 14, SortOrder: 1 },
      ],
      QuickAdd: [
        { ID: "q1", Name: "Rice (scoop)", Kcal: 200, Protein: 4, SortOrder: 1 },
        { ID: "q2", Name: "Chicken breast", Kcal: 180, Protein: 30, SortOrder: 2 },
        { ID: "q3", Name: "Tofu", Kcal: 60, Protein: 5, SortOrder: 3 },
      ],
      Recurring: [gym],
      Categories: [
        { ID: "c1", Name: "Food", Type: "expense", Hidden: false, SortOrder: 1 },
        { ID: "c2", Name: "Health", Type: "expense", Hidden: false, SortOrder: 2 },
        { ID: "c3", Name: "Recreation & Entertainment", Type: "expense", Hidden: false, SortOrder: 3 },
        { ID: "c4", Name: "Family", Type: "income", Hidden: false, SortOrder: 1 },
      ],
    },
    save,
    remove,
    apply,
  };
});

describe("Saved foods", () => {
  test("lists foods in SortOrder with their numbers", () => {
    render(<SavedFoods onBack={() => {}} />);
    const rows = within(screen.getByRole("list", { name: "Saved foods" })).getAllByRole("button");
    expect(rows[0]).toHaveTextContent("Combo Roti + Milk Fami");
    expect(rows[0]).toHaveTextContent("NT$49 · 14 g · 450 kcal");
  });

  test("adding a name that already exists (any case) is refused", async () => {
    render(<SavedFoods onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add saved food" }));
    await userEvent.type(screen.getByLabelText("Name"), "combo roti + milk fami");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Already exists")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  test("a new food goes to the end with blank numbers left blank", async () => {
    render(<SavedFoods onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add saved food" }));
    await userEvent.type(screen.getByLabelText("Name"), "Bubble tea");
    await userEvent.type(screen.getByLabelText("Price (NT$)"), "45");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith("SavedFoods", expect.objectContaining({ Name: "Bubble tea", Price: 45, Kcal: null, Protein: null, SortOrder: 3 }));
  });

  test("editing a food saves only that food", async () => {
    render(<SavedFoods onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Combo Roti/ }));
    const protein = screen.getByLabelText("Protein (g)");
    await userEvent.clear(protein);
    await userEvent.type(protein, "16");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith("SavedFoods", expect.objectContaining({ ID: "f1", Name: "Combo Roti + Milk Fami", Protein: 16, Price: 49 }));
  });

  test("a price with cents is refused", async () => {
    render(<SavedFoods onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add saved food" }));
    await userEvent.type(screen.getByLabelText("Name"), "Snack");
    await userEvent.type(screen.getByLabelText("Price (NT$)"), "40.5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Use whole NT$ (no cents)")).toBeInTheDocument();
  });

  test("deleting asks first", async () => {
    render(<SavedFoods onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Tuna Onigiri/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(remove).toHaveBeenCalledWith("SavedFoods", "f2");
  });
});

describe("Quick-add buttons", () => {
  test("▲ on the second button swaps it with the first in one change", async () => {
    render(<QuickAdd onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Move Chicken breast up" }));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0][0]).toEqual([
      { tab: "QuickAdd", row: expect.objectContaining({ ID: "q2", SortOrder: 1 }) },
      { tab: "QuickAdd", row: expect.objectContaining({ ID: "q1", SortOrder: 2 }) },
    ]);
  });

  test("the first can't move up and the last can't move down", () => {
    render(<QuickAdd onBack={() => {}} />);
    expect(screen.getByRole("button", { name: "Move Rice (scoop) up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Tofu down" })).toBeDisabled();
  });

  test("a new button is added at the end", async () => {
    render(<QuickAdd onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add quick-add button" }));
    await userEvent.type(screen.getByLabelText("Name"), "Egg");
    await userEvent.type(screen.getByLabelText("Kcal"), "70");
    await userEvent.type(screen.getByLabelText("Protein (g)"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith("QuickAdd", expect.objectContaining({ Name: "Egg", Kcal: 70, Protein: 6, SortOrder: 4 }));
  });
});

describe("Recurring charges", () => {
  test("lists each item with its amount and schedule", () => {
    render(<Recurring today="2026-11-20" onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /Gym/ })).toHaveTextContent("NT$40 · Every Sunday");
  });

  test("switching off saves Active false and keeps the rest", async () => {
    render(<Recurring today="2026-11-20" onBack={() => {}} />);
    await userEvent.click(screen.getByRole("switch", { name: "Gym" }));
    expect(save).toHaveBeenCalledWith("Recurring", expect.objectContaining({ ID: "r1", Active: false, ChargedThrough: "2026-11-15" }));
  });

  test("switching back on starts charging from today, not the missed weeks", async () => {
    data.current = { ...data.current, rows: { ...(data.current.rows as object), Recurring: [{ ...gym, Active: false }] } };
    render(<Recurring today="2026-11-20" onBack={() => {}} />);
    await userEvent.click(screen.getByRole("switch", { name: "Gym" }));
    expect(save).toHaveBeenCalledWith("Recurring", expect.objectContaining({ ID: "r1", Active: true, ActiveSince: "2026-11-20" }));
  });

  test("a monthly item saves its day of month and no weekday", async () => {
    render(<Recurring today="2026-11-20" onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add recurring charge" }));
    await userEvent.type(screen.getByLabelText("Name"), "YouTube Premium");
    await userEvent.type(screen.getByLabelText("Amount (NT$)"), "199");
    await userEvent.selectOptions(screen.getByLabelText("Category"), "Recreation & Entertainment");
    await userEvent.selectOptions(screen.getByLabelText("Frequency"), "monthly");
    const day = screen.getByLabelText("Day of month");
    await userEvent.clear(day);
    await userEvent.type(day, "26");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith(
      "Recurring",
      expect.objectContaining({ Name: "YouTube Premium", Amount: 199, Category: "Recreation & Entertainment", Frequency: "monthly", MonthDay: 26, Weekday: null, StartDate: "2026-11-20", Active: true }),
    );
  });

  test("a weekly item defaults to Sunday and only offers expense categories", async () => {
    render(<Recurring today="2026-11-20" onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add recurring charge" }));
    expect(screen.getByLabelText("Day of week")).toHaveValue("0");
    const options = within(screen.getByLabelText("Category")).getAllByRole("option").map((o) => o.textContent);
    expect(options).not.toContain("Family");
  });

  test("an amount with cents and a bad day of month are refused", async () => {
    render(<Recurring today="2026-11-20" onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Add recurring charge" }));
    await userEvent.type(screen.getByLabelText("Name"), "Phone");
    await userEvent.type(screen.getByLabelText("Amount (NT$)"), "40.5");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Use whole NT$ (no cents)")).toBeInTheDocument();

    const amount = screen.getByLabelText("Amount (NT$)");
    await userEvent.clear(amount);
    await userEvent.type(amount, "400");
    await userEvent.selectOptions(screen.getByLabelText("Frequency"), "monthly");
    const day = screen.getByLabelText("Day of month");
    await userEvent.clear(day);
    await userEvent.type(day, "32");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Use a day from 1 to 31")).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });

  test("editing keeps the charge history fields", async () => {
    render(<Recurring today="2026-11-20" onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Gym/ }));
    const amount = screen.getByLabelText("Amount (NT$)");
    await userEvent.clear(amount);
    await userEvent.type(amount, "50");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(save).toHaveBeenCalledWith("Recurring", expect.objectContaining({ ID: "r1", Amount: 50, ChargedThrough: "2026-11-15", StartDate: "2026-11-15" }));
  });

  test("deleting says past charges stay", async () => {
    render(<Recurring today="2026-11-20" onBack={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /Gym/ }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/Past charges stay in your transactions\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));
    expect(remove).toHaveBeenCalledWith("Recurring", "r1");
  });
});
