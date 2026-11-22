import { useMemo, useState } from "react";
import { createApi, type ApiConfig } from "./api";
import { loadConfig, saveConfig, clearConfig } from "./config";
import { DataProvider, useData } from "./store";
import { Settings } from "./screens/Settings";
import { Today } from "./screens/Today";
import { Money } from "./screens/Money";
import { CategoryDetail } from "./screens/CategoryDetail";
import { Export } from "./screens/Export";
import { Budgets } from "./screens/Budgets";
import { Reviews } from "./screens/Reviews";
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
import { Exercises } from "./screens/Exercises";
import { Routines } from "./screens/Routines";
import { Body } from "./screens/Body";
import { Profile } from "./screens/Profile";
import { TargetSuggestion } from "./components/TargetSuggestion";
import { draftFromSession, draftToResume, loadDraft, newDraft, saveDraft, startChoice, type Draft } from "./workoutDraft";
import { sessionsFrom } from "../shared/gym";
import { todayTaipei } from "../shared/dates";
import { periodFor, type Period } from "../shared/aggregate";

type Screen = { name: Tab; asking?: string | null } | { name: "new"; editId?: string; editMealId?: string; back?: Screen } | { name: "category"; category: string } | { name: "export" } | { name: "reviews" } | { name: "budgets"; from: "money" | "settings" } | { name: "settings" } | { name: "categories" } | { name: "targets" }
  | { name: "savedFoods" } | { name: "quickAdd" } | { name: "recurring"; from: "today" | "settings" }
  | { name: "workout"; draft: Draft } | { name: "exercise"; id: string } | { name: "exercises" } | { name: "routines" } | { name: "profile" };

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
  // Lives here so Money keeps its period while a category or an entry is open.
  const [moneyPeriod, setMoneyPeriod] = useState<Period>(() => periodFor("week", todayTaipei()));

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

  /**
   * Starts a routine (or a blank workout). Today's open workout is resumed only for the same
   * routine; an untouched one is replaced; one with saved sets needs replace (Gym asks first).
   */
  function startWorkout(routineId: string | null, replace = false) {
    const existing = draftToResume(todayTaipei());
    const choice = replace ? "replace" : startChoice(existing, routineId);
    if (choice === "resume" && existing) return setScreen({ name: "workout", draft: existing });
    if (choice === "ask") return setScreen({ name: "gym", asking: routineId });
    const routine = routineId ? (rows.Routines ?? []).find((r) => r.ID === routineId) ?? null : null;
    const d = newDraft(routine, rows.Exercises ?? [], rows.Workouts ?? [], todayTaipei(), () => crypto.randomUUID());
    saveDraft(d);
    setScreen({ name: "workout", draft: d });
  }
  const tab = screen.name === "category" ? "money" : ["today", "money", "gym", "body"].includes(screen.name) ? (screen.name as Tab) : null;

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
          onStartWorkout={startWorkout}
          onOpenGym={() => setScreen({ name: "gym" })}
        />
      )}
      {screen.name === "money" && (
        <Money
          period={moneyPeriod}
          onPeriodChange={setMoneyPeriod}
          onOpen={(id) => setScreen({ name: "new", editId: id })}
          onOpenCategory={(category) => setScreen({ name: "category", category })}
          onOpenBudgets={() => setScreen({ name: "budgets", from: "money" })}
        />
      )}
      {screen.name === "category" && (
        <CategoryDetail
          category={screen.category}
          period={moneyPeriod.kind === "all" ? periodFor("all", todayTaipei(), rows.Transactions) : moneyPeriod}
          onBack={() => setScreen({ name: "money" })}
          onOpen={(id) => setScreen({ name: "new", editId: id, back: screen })}
        />
      )}
      {screen.name === "gym" && (
        <Gym
          key={screen.asking === undefined ? "gym" : `ask-${screen.asking}`}
          asking={screen.asking}
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
        <Body
          onOpenProfile={() => setScreen({ name: "profile" })}
          onOpenSettings={() => setScreen({ name: "settings" })}
          onOpenTargets={() => setScreen({ name: "targets" })}
          onOpenReviews={() => setScreen({ name: "reviews" })}
          suggestion={<TargetSuggestion />}
        />
      )}
      {screen.name === "profile" && <Profile onBack={() => setScreen({ name: "body" })} />}
      {screen.name === "settings" && (
        <Settings
          config={config}
          onSave={(c) => { onSaveConfig(c); setScreen({ name: "today" }); }}
          links={[
            { label: "Categories", onOpen: () => setScreen({ name: "categories" }) },
            { label: "Saved foods", onOpen: () => setScreen({ name: "savedFoods" }) },
            { label: "Quick-add buttons", onOpen: () => setScreen({ name: "quickAdd" }) },
            { label: "Budgets", onOpen: () => setScreen({ name: "budgets", from: "settings" }) },
            { label: "Recurring charges", onOpen: () => setScreen({ name: "recurring", from: "settings" }) },
            { label: "Exercises", onOpen: () => setScreen({ name: "exercises" }) },
            { label: "Routines", onOpen: () => setScreen({ name: "routines" }) },
            { label: "Targets", onOpen: () => setScreen({ name: "targets" }) },
            { label: "Profile", onOpen: () => setScreen({ name: "profile" }) },
            { label: "Export", onOpen: () => setScreen({ name: "export" }) },
          ]}
        />
      )}
      {screen.name === "exercises" && <Exercises onBack={() => setScreen({ name: "settings" })} />}
      {screen.name === "routines" && <Routines onBack={() => setScreen({ name: "settings" })} />}
      {screen.name === "targets" && <Targets onBack={() => setScreen({ name: "settings" })} />}
      {screen.name === "savedFoods" && <SavedFoods onBack={() => setScreen({ name: "settings" })} />}
      {screen.name === "quickAdd" && <QuickAdd onBack={() => setScreen({ name: "settings" })} />}
      {screen.name === "recurring" && <Recurring onBack={() => setScreen(screen.from === "today" ? { name: "today" } : { name: "settings" })} />}
      {screen.name === "new" && (
        <NewEntry
          key={screen.editId ?? screen.editMealId ?? "new"}
          editId={screen.editId}
          editMealId={screen.editMealId}
          onDone={() => setScreen(screen.back ?? { name: screen.editId ? "money" : "today" })}
        />
      )}
      {screen.name === "budgets" && <Budgets onBack={() => setScreen(screen.from === "money" ? { name: "money" } : { name: "settings" })} />}
      {screen.name === "reviews" && <Reviews onBack={() => setScreen({ name: "body" })} />}
      {screen.name === "export" && <Export onBack={() => setScreen({ name: "settings" })} />}
      {screen.name === "categories" && <Categories onBack={() => setScreen({ name: "settings" })} />}

      {screen.name !== "new" && screen.name !== "workout" && (
        <BottomNav
          current={tab}
          onTab={(t) => {
            // The Money tab starts at this week; only coming back from a category or an entry keeps the period.
            if (t === "money") setMoneyPeriod(periodFor("week", todayTaipei()));
            setScreen({ name: t });
          }} onAdd={() => setScreen({ name: "new" })} />
      )}
    </>
  );
}
