import { useState } from "react";
import { useData } from "../store";
import { BackHeader } from "../components/BackHeader";
import { getSetting, parseNutritionInput, roundKcal, roundProtein, targetsFrom } from "../../shared/meals";
import { maintenanceKcal, profileFrom } from "../../shared/body";
import { TargetSuggestion, useTrendKg } from "../components/TargetSuggestion";

type Field = "protein" | "kcal";

export function Targets({ onBack }: { onBack(): void }) {
  const { rows, save } = useData();
  const settings = rows.Settings ?? [];
  const [protein, setProtein] = useState(String(targetsFrom(settings).protein));
  const [kcal, setKcal] = useState(getSetting(settings, "kcalTarget") ?? "");
  const [error, setError] = useState<{ field: Field; message: string }>();
  const trendKg = useTrendKg();
  const profile = profileFrom(settings);
  const estimate = maintenanceKcal(profile, trendKg);
  const missing =
    profile.heightCm === null || profile.age === null || profile.sex === null
      ? "Add height, age and sex in Profile for an estimate"
      : trendKg === null
        ? "Log your weight on the Body tab for an estimate"
        : null;

  function submit() {
    const p = parseNutritionInput(protein);
    if (!p.ok) return setError({ field: "protein", message: p.error });
    if (p.value === null || p.value === 0) return setError({ field: "protein", message: "Enter a protein target" });
    const k = parseNutritionInput(kcal);
    if (!k.ok) return setError({ field: "kcal", message: k.error });
    void save("Settings", { ID: "proteinTarget", Value: String(roundProtein(p.value)) });
    // Blank (or 0) clears the calorie target; the ring then offers to set one.
    void save("Settings", { ID: "kcalTarget", Value: k.value ? String(roundKcal(k.value)) : null });
    onBack();
  }

  const errorFor = (field: Field) =>
    error?.field === field ? <div id={`${field}-error`} className="field-error" role="alert">{error.message}</div> : null;

  return (
    <main className="screen">
      <BackHeader title="Targets" onBack={onBack} />
      <section className="card">
        <label className="field">
          Protein (g/day)
          <input value={protein} onChange={(e) => { setProtein(e.target.value); setError(undefined); }} inputMode="decimal" aria-invalid={error?.field === "protein"} aria-describedby={error?.field === "protein" ? "protein-error" : undefined} />
        </label>
        {errorFor("protein")}
        <label className="field">
          Calories (kcal/day, optional)
          <input value={kcal} onChange={(e) => { setKcal(e.target.value); setError(undefined); }} inputMode="numeric" aria-invalid={error?.field === "kcal"} aria-describedby={error?.field === "kcal" ? "kcal-error" : undefined} />
        </label>
        {errorFor("kcal")}
        {estimate !== null ? (
          <div className="row-between">
            <span className="small muted">{`Estimated maintenance: ${estimate.toLocaleString("en-US")} kcal`}</span>
            <button className="btn-link" onClick={() => { setKcal(String(estimate)); setError(undefined); }}>Use estimate</button>
          </div>
        ) : (
          <span className="small muted">{missing}</span>
        )}
        <p className="muted small" style={{ margin: 0 }}>Leave calories blank if you only want to track protein. Targets change only when you save or tap Update.</p>
      </section>
      <TargetSuggestion onUpdated={(sug) => { if (sug.protein !== null) setProtein(String(sug.protein)); if (sug.kcal !== null) setKcal(String(sug.kcal)); }} />
      <button className="btn btn-primary" onClick={submit}>Save</button>
    </main>
  );
}
