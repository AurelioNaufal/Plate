import type { Row } from "./schema";
import { categoryOf } from "./aggregate";
import { monthRange } from "./dates";

export type BudgetLevel = "ok" | "warn" | "over";
export type BudgetStatus = { category: string; limit: number; spent: number; left: number; share: number; level: BudgetLevel };

/** ok under 80% of the limit, warn from 80% to 100%, over above 100%. */
export const budgetLevel = (share: number): BudgetLevel => (share > 1 ? "over" : share >= 0.8 ? "warn" : "ok");

/**
 * Each budget's spending in a month ("YYYY-MM"): every expense in its category,
 * recurring charges included. Only budgets with a usable limit, in category order.
 */
export function budgetStatus(budgets: Row[], txs: Row[], month: string, categories: Row[] = []): BudgetStatus[] {
  const { start, end } = monthRange(month);
  const spentBy = new Map<string, number>();
  for (const t of txs) {
    if (t.Type !== "expense" || typeof t.Date !== "string" || t.Date < start || t.Date > end) continue;
    const c = categoryOf(t);
    spentBy.set(c, (spentBy.get(c) ?? 0) + (Number(t.Amount) || 0));
  }
  const order = new Map(categories.filter((c) => c.Type === "expense").map((c) => [String(c.Name), Number(c.SortOrder ?? 0)]));
  return budgets
    .filter((b) => typeof b.MonthlyLimit === "number" && b.MonthlyLimit > 0 && String(b.Category ?? "").trim())
    .map((b) => {
      const category = String(b.Category);
      const limit = b.MonthlyLimit as number;
      const spent = spentBy.get(category) ?? 0;
      const share = spent / limit;
      return { category, limit, spent, left: limit - spent, share, level: budgetLevel(share) };
    })
    .sort((a, b) => (order.get(a.category) ?? Infinity) - (order.get(b.category) ?? Infinity) || a.category.localeCompare(b.category));
}
