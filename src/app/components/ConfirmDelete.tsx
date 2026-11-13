import { useState } from "react";

/** A Delete button that asks once before calling onDelete. */
export function ConfirmDelete({ question, onDelete }: { question: string; onDelete(): void }) {
  const [asking, setAsking] = useState(false);
  if (!asking) return <button type="button" className="btn btn-danger" onClick={() => setAsking(true)}>Delete</button>;
  return (
    <div className="row-between">
      <span className="small">{question}</span>
      <span style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-secondary" onClick={() => setAsking(false)}>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={onDelete}>Yes, delete</button>
      </span>
    </div>
  );
}
