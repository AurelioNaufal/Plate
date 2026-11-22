// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryDetail } from "../../src/app/screens/CategoryDetail";
import type { Period } from "../../src/shared/aggregate";
import type { Row } from "../../src/shared/schema";

const tx = (ID: string, Type: string, Date: string, Amount: number, Category: string, Description: string): Row => ({ ID, Type, Date, Amount, Category, Description, Source: "app" });

vi.mock("../../src/app/store", () => ({
  useData: () => ({
    rows: {
      Transactions: [
        tx("f1", "expense", "2026-09-03", 200, "Food", "Noodles"),
        tx("f2", "expense", "2026-09-20", 100, "Food", "Rice box"),
        tx("u1", "expense", "2026-09-21", 500, "Utilities", "Phone"),
        tx("f3", "expense", "2026-11-02", 100, "Food", "Sandwich"),
        tx("i1", "income", "2026-11-05", 900, "Food", "Odd refund"),
        { ...tx("n1", "expense", "2026-11-06", 70, "", "Old row"), Category: null },
        tx("n2", "expense", "2026-11-07", 30, "", "Blank row"),
      ],
      Meals: [],
    },
    pending: [],
  }),
}));

const all: Period = { kind: "all", start: "2026-09-03", end: "2026-11-22" };

test("Food over 3 months: total, bars, a table that adds to 100%, and its entries", () => {
  const { container } = render(<CategoryDetail category="Food" period={all} onBack={() => {}} onOpen={() => {}} />);
  expect(screen.getByRole("heading", { name: "Food" })).toBeInTheDocument();
  expect(screen.getByText("NT$400")).toBeInTheDocument();
  expect(screen.getByText("3 entries")).toBeInTheDocument();
  expect(container.querySelectorAll("[data-bar]")).toHaveLength(3);

  const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  expect(rows.map((r) => r.textContent)).toEqual(["Sep300·75%", "Oct0·0%", "Nov100·25%"].map((t) => t.replace(/·/g, "")));

  const list = screen.getByRole("list", { name: "Transactions" });
  expect(within(list).getAllByRole("button")).toHaveLength(3);
  expect(within(list).queryByText("Phone")).toBeNull();
  expect(within(list).queryByText("Odd refund")).toBeNull();
});

test("tapping an entry opens it", async () => {
  const onOpen = vi.fn();
  render(<CategoryDetail category="Food" period={all} onBack={() => {}} onOpen={onOpen} />);
  await userEvent.click(screen.getByRole("button", { name: /Sandwich/ }));
  expect(onOpen).toHaveBeenCalledWith("f3");
});

test("Uncategorised lists the rows with no category, as Money counted them", () => {
  render(<CategoryDetail category="Uncategorised" period={all} onBack={() => {}} onOpen={() => {}} />);
  expect(within(screen.getByRole("region", { name: "Category total" })).getByText("NT$100")).toBeInTheDocument();
  expect(within(screen.getByRole("list", { name: "Transactions" })).getAllByRole("button")).toHaveLength(2);
});
