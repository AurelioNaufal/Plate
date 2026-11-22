import { useMemo } from "react";
import { useData } from "../store";
import { bestSeries, sessionsFrom, setLabel } from "../../shared/gym";
import { formatShortDay } from "../format";
import { BackHeader } from "../components/BackHeader";
import { LineChart } from "../components/charts";

export function ExerciseProgress({ exerciseId, onBack }: { exerciseId: string; onBack(): void }) {
  const { rows } = useData();
  const workouts = rows.Workouts ?? [];
  const name = String((rows.Exercises ?? []).find((e) => e.ID === exerciseId)?.Name ?? "Deleted exercise");
  const series = useMemo(() => bestSeries(workouts, exerciseId), [workouts, exerciseId]);
  const history = useMemo(
    () =>
      sessionsFrom(workouts)
        .map((s) => ({ date: s.date, sets: s.sets.filter((r) => String(r.ExerciseID) === exerciseId) }))
        .filter((s) => s.sets.length > 0),
    [workouts, exerciseId],
  );
  const unit = series[0]?.unit ?? "kg";
  const best = series.length ? Math.max(...series.map((p) => p.value)) : null;

  return (
    <main className="screen">
      <BackHeader title={name} onBack={onBack} />
      {best === null ? (
        <section className="card">
          <p className="muted small" style={{ margin: 0 }}>No sets logged yet</p>
        </section>
      ) : (
        <>
          <section className="card" aria-label="Progress">
            <div className="row-between">
              <h2>{unit === "kg" ? "Best set weight" : "Best reps"}</h2>
              <span style={{ fontWeight: 700 }}>{`Best: ${best} ${unit}`}</span>
            </div>
            <LineChart
              points={series.map((p) => ({ x: p.date, y: p.value }))}
              unit={unit}
              label={`${name}: ${unit === "kg" ? "best set weight" : "best reps"} per workout, ${series.length} workouts, best ${best} ${unit}`}
            />
          </section>
          <section className="card">
            <h2>History</h2>
            <ul className="plain-list" aria-label="History">
              {history.map((s) => (
                <li key={s.date + s.sets[0].ID} className="small">{`${formatShortDay(s.date)} · ${s.sets.map(setLabel).join(", ")}`}</li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
