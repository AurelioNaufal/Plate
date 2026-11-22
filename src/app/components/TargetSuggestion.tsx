import { useData } from "../store";
import { dailyWeights, suggestionKey, targetSuggestion, weightTrend } from "../../shared/body";
import type { Change } from "../../shared/changes";

/** The latest smoothed weight, or null with no weigh-ins. */
export function useTrendKg(): number | null {
  const { rows } = useData();
  return weightTrend(dailyWeights(rows.Body ?? [])).at(-1)?.kg ?? null;
}

/**
 * Offers new targets when the weight trend has moved. Nothing changes until
 * the owner taps Update; "Not now" hides this exact pair.
 */
export function TargetSuggestion({ onUpdated }: { onUpdated?(s: { protein: number | null; kcal: number | null }): void }) {
  const { rows, save, apply } = useData();
  const trendKg = useTrendKg();
  const s = targetSuggestion(rows.Settings ?? [], trendKg);
  if (!s || trendKg === null) return null;

  const parts: string[] = [];
  if (s.protein !== null) parts.push(`${s.protein} g protein`);
  if (s.kcal !== null) parts.push(`${s.kcal.toLocaleString("en-US")} kcal`);

  function update() {
    if (!s) return;
    // Only the targets that moved enough; the other stays as you set it.
    const changes: Change[] = [];
    if (s.protein !== null) changes.push({ tab: "Settings", row: { ID: "proteinTarget", Value: String(s.protein) } });
    if (s.kcal !== null) changes.push({ tab: "Settings", row: { ID: "kcalTarget", Value: String(s.kcal) } });
    void apply(changes);
    onUpdated?.(s);
  }

  return (
    <section className="card suggestion" aria-label="Suggested targets">
      <h2>Suggested targets</h2>
      <p className="small" style={{ margin: 0 }}>{`Your weight trend is ${trendKg.toFixed(1)} kg. Suggested: ${parts.join(", ")}.`}</p>
      <div className="grid-2">
        <button className="btn btn-secondary" onClick={() => void save("Settings", { ID: "targetSuggestionDismissed", Value: suggestionKey(s) })}>Not now</button>
        <button className="btn btn-primary" onClick={update}>Update</button>
      </div>
    </section>
  );
}
