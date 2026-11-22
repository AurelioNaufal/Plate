// @vitest-environment jsdom
import { shareOrDownload } from "../../src/app/download";

const files = [{ name: "plate-body-all.csv", text: "﻿ID\r\n" }];

const pointer = (coarse: boolean) =>
  (window.matchMedia = ((q: string) => ({ matches: coarse && q === "(pointer: coarse)" })) as unknown as typeof window.matchMedia);

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { canShare?: unknown }).canShare;
  delete (navigator as { share?: unknown }).share;
});

test("shares the files in one sheet when the phone can", async () => {
  pointer(true);
  const shareFn = vi.fn(async () => {});
  Object.assign(navigator, { canShare: () => true, share: shareFn });
  expect(await shareOrDownload(files)).toBe("shared");
  expect(shareFn).toHaveBeenCalledTimes(1);
  expect((shareFn.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0].name).toBe("plate-body-all.csv");
});

test("a cancelled share does nothing else", async () => {
  pointer(true);
  Object.assign(navigator, { canShare: () => true, share: async () => { throw new DOMException("cancelled", "AbortError"); } });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  expect(await shareOrDownload(files)).toBe("cancelled");
  expect(click).not.toHaveBeenCalled();
});

test("without sharing it downloads each file", async () => {
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
  expect(await shareOrDownload([...files, { name: "plate-meals-all.csv", text: "x" }])).toBe("downloaded");
  expect(names).toEqual(["plate-body-all.csv", "plate-meals-all.csv"]);
});

test("a laptop downloads even when its browser could share", async () => {
  pointer(false);
  const shareFn = vi.fn(async () => {});
  Object.assign(navigator, { canShare: () => true, share: shareFn });
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await shareOrDownload(files);
  expect(shareFn).not.toHaveBeenCalled();
  expect(click).toHaveBeenCalledTimes(1);
});
