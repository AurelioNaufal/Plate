// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Money } from "../../src/app/screens/Money";
import { realWeek } from "../fixtures/week";

vi.mock("../../src/app/store", () => ({
  useData: () => ({
    status: "ready",
    rows: {
      Transactions: realWeek,
      Categories: [
        { ID: "c1", Name: "Food", Type: "expense", Hidden: false, SortOrder: 1 },
        { ID: "c2", Name: "Utilities", Type: "expense", Hidden: false, SortOrder: 2 },
        { ID: "c3", Name: "Health", Type: "expense", Hidden: false, SortOrder: 3 },
      ],
    },
    pending: [],
  }),
}));

test("shows the week's spending and filters the list by category", async () => {
  render(<Money today="2026-11-12" onOpen={() => {}} onOpenCategory={() => {}} />);
  expect(screen.getAllByText("NT$1,195").length).toBeGreaterThan(0);

  await userEvent.selectOptions(screen.getByLabelText("Category filter"), "Utilities");
  const list = screen.getByRole("list", { name: "Transactions" });
  const items = within(list).getAllByRole("button");
  expect(items).toHaveLength(2);
  expect(within(list).getByText("Haircut")).toBeInTheDocument();
  expect(within(list).getByText("Laundry")).toBeInTheDocument();
});

test("recurring rows carry an auto label", () => {
  render(<Money today="2026-11-12" onOpen={() => {}} onOpenCategory={() => {}} />);
  const list = screen.getByRole("list", { name: "Transactions" });
  expect(within(list).getAllByText("auto")).toHaveLength(2);
});

test("headline cards show counts, savings rate and the top category", () => {
  render(<Money today="2026-11-12" onOpen={() => {}} onOpenCategory={() => {}} />);
  const head = screen.getByRole("region", { name: "Period summary" });
  expect(within(head).getByText("17 entries")).toBeInTheDocument();
  expect(within(head).getByText("1 entry")).toBeInTheDocument();
  expect(within(head).getByText("Saved 76%")).toBeInTheDocument();
  expect(within(head).getByText("Food NT$955")).toBeInTheDocument();
});

test("the Income switch lists only income, with its total and each row's share", async () => {
  render(<Money today="2026-11-12" onOpen={() => {}} onOpenCategory={() => {}} />);
  await userEvent.click(within(screen.getByRole("tablist", { name: "Entries shown" })).getByRole("tab", { name: "Income" }));
  const list = screen.getByRole("list", { name: "Transactions" });
  expect(within(list).getAllByRole("button")).toHaveLength(1);
  expect(within(list).getByText("Part-time pay (Nov)")).toBeInTheDocument();
  expect(within(list).getByText("100%")).toBeInTheDocument();
  expect(screen.getByText("Total NT$5,000")).toBeInTheDocument();
});

test("expense rows show their entry count, and tapping one opens that category", async () => {
  const onOpenCategory = vi.fn();
  render(<Money today="2026-11-12" onOpen={() => {}} onOpenCategory={onOpenCategory} />);
  const cats = screen.getByRole("region", { name: "Expense categories" });
  const food = within(cats).getByRole("button", { name: /Food/ });
  expect(food).toHaveTextContent("14 entries");
  await userEvent.click(food);
  expect(onOpenCategory).toHaveBeenCalledWith("Food");
});

test("a year shows monthly cash flow with one table row per month", async () => {
  render(<Money today="2026-11-12" onOpen={() => {}} onOpenCategory={() => {}} />);
  await userEvent.click(within(screen.getByRole("tablist", { name: "Period" })).getByRole("tab", { name: "Year" }));
  const flow = screen.getByRole("region", { name: "Monthly cash flow" });
  const body = within(flow).getByRole("table").querySelector("tbody")!;
  expect(body.querySelectorAll("tr")).toHaveLength(12);
  expect(within(flow).getByRole("img", { name: /Income vs spent/ })).toBeInTheDocument();
  const nov = within(body).getByText("Nov").closest("tr")!;
  expect(nov).toHaveTextContent("5,000");
  expect(nov).toHaveTextContent("2,194");
  expect(nov).toHaveTextContent("56%");
});

test("the income card breaks income down by category", () => {
  render(<Money today="2026-11-12" onOpen={() => {}} onOpenCategory={() => {}} />);
  const inc = screen.getByRole("region", { name: "Income by category" });
  expect(inc).toHaveTextContent("Part-Time Jobs");
  expect(inc).toHaveTextContent("100%");
});
