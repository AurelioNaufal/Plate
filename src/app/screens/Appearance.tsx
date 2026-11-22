import { useState } from "react";
import { useData } from "../store";
import { BackHeader } from "../components/BackHeader";
import { applyTheme, initialTheme, type ThemeChoice } from "../theme";

const CHOICES: { choice: ThemeChoice; label: string }[] = [
  { choice: "auto", label: "Auto" },
  { choice: "light", label: "Light" },
  { choice: "dark", label: "Dark" },
];

export function Appearance({ onBack }: { onBack(): void }) {
  const { save } = useData();
  const [current, setCurrent] = useState<ThemeChoice>(() => initialTheme());

  function pick(choice: ThemeChoice) {
    applyTheme(choice);
    setCurrent(choice);
    void save("Settings", { ID: "theme", Value: choice });
  }

  return (
    <main className="screen">
      <BackHeader title="Appearance" onBack={onBack} />
      <section className="card">
        <h2>Theme</h2>
        <div className="segmented" role="tablist" aria-label="Theme">
          {CHOICES.map(({ choice, label }) => (
            <button key={choice} role="tab" aria-selected={current === choice} onClick={() => pick(choice)}>{label}</button>
          ))}
        </div>
        <p className="small muted" style={{ margin: 0 }}>Auto follows your phone's light or dark setting.</p>
      </section>
    </main>
  );
}
