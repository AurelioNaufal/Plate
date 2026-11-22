import { useState } from "react";
import { useData } from "../store";
import { getSetting } from "../../shared/meals";
import { BackHeader } from "../components/BackHeader";

type Field = "height" | "age";

export function Profile({ onBack }: { onBack(): void }) {
  const { rows, apply } = useData();
  const settings = rows.Settings ?? [];
  const [height, setHeight] = useState(getSetting(settings, "heightCm") ?? "");
  const [age, setAge] = useState(getSetting(settings, "age") ?? "");
  const [sex, setSex] = useState(getSetting(settings, "sex") ?? "");
  const [error, setError] = useState<{ field: Field; message: string }>();
  const [saved, setSaved] = useState(false);

  function submit() {
    const h = height.trim().replace(",", ".");
    if (h && (!/^\d+(\.\d+)?$/.test(h) || Number(h) < 100 || Number(h) > 250)) return setError({ field: "height", message: "Use 100 to 250 cm" });
    const a = age.trim();
    if (a && (!/^\d+$/.test(a) || Number(a) < 10 || Number(a) > 100)) return setError({ field: "age", message: "Use a whole age from 10 to 100" });
    setError(undefined);
    void apply([
      { tab: "Settings", row: { ID: "heightCm", Value: h || null } },
      { tab: "Settings", row: { ID: "age", Value: a || null } },
      { tab: "Settings", row: { ID: "sex", Value: sex || null } },
    ]);
    setSaved(true);
  }

  const field = (f: Field, label: string, value: string, set: (v: string) => void, mode: "decimal" | "numeric") => (
    <>
      <label className="field">
        {label}
        <input
          value={value}
          inputMode={mode}
          onChange={(e) => { set(e.target.value); setError(undefined); setSaved(false); }}
          aria-invalid={error?.field === f}
          aria-describedby={error?.field === f ? `${f}-error` : undefined}
        />
      </label>
      {error?.field === f && <div id={`${f}-error`} className="field-error" role="alert">{error.message}</div>}
    </>
  );

  return (
    <main className="screen">
      <BackHeader title="Profile" onBack={onBack} />
      <section className="card">
        {field("height", "Height (cm)", height, setHeight, "decimal")}
        {field("age", "Age", age, setAge, "numeric")}
        <label className="field">
          Sex
          <select value={sex} onChange={(e) => { setSex(e.target.value); setSaved(false); }}>
            <option value="">Not set</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </label>
        <p className="muted small" style={{ margin: 0 }}>Used only for BMI and the calorie estimate. It stays in your own Sheet.</p>
      </section>
      <div className="row-between">
        <span className="small muted">{saved ? "Saved" : ""}</span>
        <button className="btn btn-primary" onClick={submit}>Save</button>
      </div>
    </main>
  );
}
