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
  render(<Money today="2026-11-12" onOpen={() => {}} />);
  expect(screen.getAllByText("NT$1,195").length).toBeGreaterThan(0);

  await userEvent.selectOptions(screen.getByLabelText("Category filter"), "Utilities");
  const list = screen.getByRole("list", { name: "Transactions" });
  const items = within(list).getAllByRole("button");
  expect(items).toHaveLength(2);
  expect(within(list).getByText("Haircut")).toBeInTheDocument();
  expect(within(list).getByText("Laundry")).toBeInTheDocument();
});

test("recurring rows carry an auto label", () => {
  render(<Money today="2026-11-12" onOpen={() => {}} />);
  const list = screen.getByRole("list", { name: "Transactions" });
  expect(within(list).getAllByText("auto")).toHaveLength(2);
});
