// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Today } from "../../src/app/screens/Today";
import { Reviews } from "../../src/app/screens/Reviews";
import type { Row } from "../../src/shared/schema";

const data = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../src/app/store", () => ({ useData: () => data.current }));

const tx = (ID: string, Date: string, Amount: number, Category = "Food"): Row => ({ ID, Type: "expense", Date, Amount, Category, Description: ID });

beforeEach(() => {
  data.current = {
    rows: {
      Transactions: [tx("a", "2026-11-16", 300), tx("b", "2026-11-18", 120, "Health"), tx("c", "2026-11-10", 200), tx("d", "2026-11-03", 90)],
      Meals: [{ ID: "m", Date: "2026-11-16", Name: "Chicken rice", Protein: 32, Kcal: 650, TransactionID: "a", InBudget: true }],
      Workouts: [{ ID: "w", SessionID: "s1", Date: "2026-11-17", ExerciseID: "bench", SetNumber: 1, WeightKg: 40, Reps: 10, Done: true }],
      Body: [], Settings: [], Recurring: [], Routines: [], Exercises: [], Budgets: [], Categories: [],
    },
  };
});

test("on Sunday, Today opens with last week's review", () => {
  render(<Today today="2026-11-22" />);
  const card = screen.getByRole("region", { name: "Last week" });
  expect(card).toHaveTextContent("Sun 15 Nov – Sat 21 Nov");
  expect(card).toHaveTextContent("NT$420");
  expect(card).toHaveTextContent("+NT$220 vs the week before");
  expect(card).toHaveTextContent("1 workout");
  expect(card).toHaveTextContent("Chicken rice");
  // It sits above everything else on Today.
  expect(screen.getAllByRole("region")[0]).toBe(card);
});

test("on other days there's no review card", () => {
  render(<Today today="2026-11-23" />);
  expect(screen.queryByRole("region", { name: "Last week" })).toBeNull();
});

test("Reviews lists the last 12 weeks, each opening to its review", async () => {
  render(<Reviews today="2026-11-22" onBack={() => {}} />);
  const weeks = within(screen.getByRole("list", { name: "Past weeks" })).getAllByRole("button");
  expect(weeks).toHaveLength(12);
  expect(weeks[0]).toHaveTextContent("Sun 15 Nov – Sat 21 Nov");
  expect(weeks[0]).toHaveTextContent("NT$420");
  await userEvent.click(weeks[1]);
  expect(screen.getByRole("region", { name: "Week of Sun 8 Nov" })).toHaveTextContent("NT$200");
});

test("the review card words weight for a first week and after a long gap", () => {
  data.current = { rows: { ...(data.current.rows as object), Body: [{ ID: "x", Date: "2026-11-18", WeightKg: 60 }] } };
  const { unmount } = render(<Today today="2026-11-22" />);
  expect(screen.getByRole("region", { name: "Last week" })).toHaveTextContent("Trend 60.0 kg · first weigh-ins");
  unmount();
  data.current = { rows: { ...(data.current.rows as object), Body: [{ ID: "o", Date: "2026-10-04", WeightKg: 61 }, { ID: "n", Date: "2026-11-20", WeightKg: 60 }] } };
  render(<Today today="2026-11-22" />);
  expect(screen.getByRole("region", { name: "Last week" })).toHaveTextContent("Trend −1.0 kg since Sun 4 Oct");
});
