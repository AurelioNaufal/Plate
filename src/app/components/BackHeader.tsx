/** The header for screens under Settings: a back arrow and the title. */
export function BackHeader({ title, onBack }: { title: string; onBack(): void }) {
  return (
    <header className="screen-header" style={{ justifyContent: "flex-start" }}>
      <button className="icon-btn" aria-label="Back" onClick={onBack} style={{ marginLeft: -12 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <h1 style={{ fontSize: 24 }}>{title}</h1>
    </header>
  );
}
