// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { TransactionList } from "../../src/app/components/TransactionList";

test("a paid meal's line shows its protein per NT$10", () => {
  const tx = { ID: "t1", Type: "expense", Date: "2026-11-13", Amount: 70, Description: "Chicken rice", Category: "Food", MealID: "m1" };
  const meal = { ID: "m1", Protein: 32, Kcal: 650 };
  render(<TransactionList transactions={[tx]} pendingIds={new Set()} mealsById={new Map([["m1", meal]])} onOpen={() => {}} />);
  expect(screen.getByRole("button", { name: /Chicken rice/ })).toHaveTextContent("4.6 g per NT$10");
});
