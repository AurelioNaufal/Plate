export type OutFile = { name: string; text: string };

/**
 * On a phone, opens one share sheet with every file (a second sheet in a row is refused,
 * since a tap allows only one). Elsewhere, or if sharing fails, downloads each file.
 * A share the owner cancels does nothing more.
 */
export async function shareOrDownload(files: OutFile[]): Promise<void> {
  const out = files.map((f) => new File([f.text], f.name, { type: "text/csv" }));
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: out })) {
    try {
      await navigator.share({ files: out });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Any other refusal: fall through to downloading.
    }
  }
  for (const f of out) {
    const url = URL.createObjectURL(f);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
