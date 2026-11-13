import { FoodList } from "../components/FoodList";

export function SavedFoods({ onBack }: { onBack(): void }) {
  return <FoodList tab="SavedFoods" title="Saved foods" addLabel="Add saved food" withPrice reorderable={false} onBack={onBack} />;
}
