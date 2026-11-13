export type Tab = "today" | "money" | "gym" | "body";

type Props = { current: Tab | null; onTab(t: Tab): void; onAdd(): void };

const svg = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const ICONS: Record<Tab, JSX.Element> = {
  today: <svg {...svg}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></svg>,
  money: <svg {...svg}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2" /></svg>,
  gym: <svg {...svg}><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" /></svg>,
  body: <svg {...svg}><path d="M4 19l5-6 4 3 7-9" /><path d="M15 7h5v5" /></svg>,
};

const LABELS: Record<Tab, string> = { today: "Today", money: "Money", gym: "Gym", body: "Body" };

export function BottomNav({ current, onTab, onAdd }: Props) {
  const item = (t: Tab) => (
    <button key={t} aria-current={current === t ? "page" : undefined} onClick={() => onTab(t)}>
      {ICONS[t]}
      {LABELS[t]}
    </button>
  );
  return (
    <nav className="bottom-nav" aria-label="Main">
      {item("today")}
      {item("money")}
      <button className="fab" aria-label="Add entry" onClick={onAdd}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      {item("gym")}
      {item("body")}
    </nav>
  );
}
