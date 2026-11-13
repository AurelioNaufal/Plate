import { FoodList } from "../components/FoodList";

export function QuickAdd({ onBack }: { onBack(): void }) {
  return <FoodList tab="QuickAdd" title="Quick-add buttons" addLabel="Add quick-add button" withPrice={false} reorderable onBack={onBack} />;
}
