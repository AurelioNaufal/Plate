import { useMemo, useState } from "react";
import { createApi, type ApiConfig } from "./api";
import { loadConfig, saveConfig, clearConfig } from "./config";
import { DataProvider, useData } from "./store";
import { Settings } from "./screens/Settings";
import { Today } from "./screens/Today";
import { Money } from "./screens/Money";
import { BottomNav, type Tab } from "./components/BottomNav";
import { NewEntry } from "./screens/NewEntry";
import { Categories } from "./screens/Categories";
import { Targets } from "./screens/Targets";
import { SavedFoods } from "./screens/SavedFoods";
import { QuickAdd } from "./screens/QuickAdd";
import { Recurring } from "./screens/Recurring";
import { Gym } from "./screens/Gym";
import { Workout } from "./screens/Workout";
import { ExerciseProgress } from "./screens/ExerciseProgress";
import { draftFromSession, loadDraft, newDraft, saveDraft, type Draft } from "./workoutDraft";
import { sessionsFrom } from "../shared/gym";
import { todayTaipei } from "../shared/dates";

type Screen = { name: Tab } | { name: "new"; editId?: string; editMealId?: string } | { name: "settings" } | { name: "categories" } | { name: "targets" }
  | { name: "savedFoods" } | { name: "quickAdd" } | { name: "recurring"; from: "today" | "settings" }
  | { name: "workout"; draft: Draft } | { name: "exercise"; id: string };

export function App() {
  const [config, setConfig] = useState<ApiConfig | null>(() => loadConfig());
  const api = useMemo(() => (config ? createApi(config) : null), [config]);

  const save = (cfg: ApiConfig) => {
    saveConfig(cfg);
    setConfig(cfg);
  };
  const forget = () => {
    clearConfig();
    setConfig(null);
  };

  return (
    <DataProvider api={api}>
      <Shell config={config} onSaveConfig={save} onClearConfig={forget} />
    </DataProvider>
  );
}

type ShellProps = { config: ApiConfig | null; onSaveConfig(cfg: ApiConfig): void; onClearConfig(): void };

function Shell({ config, onSaveConfig, onClearConfig }: ShellProps) {
  const { status, loadError, reload, pending, retry, rows } = useData();
  const [screen, setScreen] = useState<Screen>({ name: "today" });

  if (status === "needs-setup") return <Settings config={config} onSave={onSaveConfig} />;
  if (status === "loading") return <main className="center muted">Loading your data…</main>;
  if (status === "error")
    return (
      <main className="center">
        <p>Couldn't load your data: {loadError}</p>
        <button className="btn btn-primary" onClick={reload}>Try again</button>
        <button className="btn-link" onClick={onClearConfig}>Change connection</button>
      </main>
    );

  const failed = pending.filter((p) => p.error);

  /** Starts a routine (or a blank workout) unless one is already in progress on this phone. */
  function startWorkout(routineId: string | null) {
    const existing = loadDraft();
    if (existing) return setScreen({ name: "workout", draft: existing });
    const routine = routineId ? (rows.Routines ?? []).find((r) => r.ID === routineId) ?? null : null;
    const d = newDraft(routine, rows.Exercises ?? [], rows.Workouts ?? [], todayTaipei(), () => crypto.randomUUID());
    saveDraft(d);
    setScreen({ name: "workout", draft: d });
  }
  const tab = ["today", "money", "gym", "body"].includes(screen.name) ? (screen.name as Tab) : null;

  return (
    <>
      {failed.length > 0 && (
        <div style={{ maxWidth: 560, margin: "12px auto 0", padding: "0 16px" }}>
          <div className="banner" role="alert">
            <span>
              {failed.length === 1 ? "1 change" : `${failed.length} changes`} didn't save: {failed[0].error}
            </span>
            <button className="btn-link" onClick={() => failed.forEach((p) => retry(p.id))}>Retry</button>
          </div>
        </div>
      )}

      {screen.name === "today" && (
        <Today
          onOpenMeal={(id) => setScreen({ name: "new", editMealId: id })}
          onOpenTargets={() => setScreen({ name: "targets" })}
          onOpenRecurring={() => setScreen({ name: "recurring", from: "today" })}
        />
      )}
      {screen.name === "money" && <Money onOpen={(id) => setScreen({ name: "new", editId: id })} />}
      {screen.name === "gym" && (
        <Gym
          onStart={startWorkout}
          onResume={() => {
            const d = loadDraft();
            if (d) setScreen({ name: "workout", draft: d });
          }}
          onEditSession={(id) => {
            const s = sessionsFrom(rows.Workouts ?? []).find((x) => x.id === id);
            if (!s) return;
            const d = draftFromSession(s);
            saveDraft(d);
            setScreen({ name: "workout", draft: d });
          }}
          onOpenExercise={(id) => setScreen({ name: "exercise", id })}
        />
      )}
      {screen.name === "workout" && (
        <Workout key={screen.draft.sessionId} draft={screen.draft} onDone={() => setScreen({ name: "gym" })} onLeave={() => setScreen({ name: "gym" })} />
      )}
      {screen.name === "exercise" && <ExerciseProgress exerciseId={screen.id} onBack={() => setScreen({ name: "gym" })} />}
      {screen.name === "body" && (
        <main className="screen">
          <header className="screen-header"><h1>Body</h1></header>
          <section className="card">
            <p className="muted small" style={{ margin: 0 }}>Weight, targets and body stats arrive in a later update.</p>
          </section>
          <section className="card">
            <button className="list-row" onClick={() => setScreen({ name: "settings" })}>
              <span>Settings</span>
              <span className="muted">›</span>
            </button>
          </section>
        </main>
      )}
      {screen.name === "settings" && (
        <Settings
          config={config}
          onSave={(c) => { onSaveConfig(c); setScreen({ name: "today" }); }}
          links={[
            { label: "Categories", onOpen: () => setScreen({ name: "categories" }) },
            { label: "Saved foods", onOpen: () => setScreen({ name: "savedFoods" }) },
            { label: "Quick-add buttons", onOpen: () => setScreen({ name: "quickAdd" }) },
            { label: "Recurring charges", onOpen: () => setScreen({ name: "recurring", from: "settings" }) },
            { label: "Targets", onOpen: () => setScreen({ name: "targets" }) },
          ]}
        />
      )}
      {screen.name === "targets" && <Targets onBack={() => setScreen({ name: "settings" })} />}
      {screen.name === "savedFoods" && <SavedFoods onBack={() => setScreen({ name: "settings" })} />}
      {screen.name === "quickAdd" && <QuickAdd onBack={() => setScreen({ name: "settings" })} />}
      {screen.name === "recurring" && <Recurring onBack={() => setScreen(screen.from === "today" ? { name: "today" } : { name: "settings" })} />}
      {screen.name === "new" && (
        <NewEntry
          key={screen.editId ?? screen.editMealId ?? "new"}
          editId={screen.editId}
          editMealId={screen.editMealId}
          onDone={() => setScreen({ name: screen.editId ? "money" : "today" })}
        />
      )}
      {screen.name === "categories" && <Categories onBack={() => setScreen({ name: "settings" })} />}

      {screen.name !== "new" && screen.name !== "workout" && (
        <BottomNav current={tab} onTab={(t) => setScreen({ name: t })} onAdd={() => setScreen({ name: "new" })} />
      )}
    </>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <main className="screen">
      <header className="screen-header"><h1>{title}</h1></header>
      <section className="card">
        <p className="muted small" style={{ margin: 0 }}>Coming in a later update.</p>
      </section>
    </main>
  );
}
