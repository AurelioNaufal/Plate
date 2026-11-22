// @vitest-environment jsdom
import { shareOrDownload } from "../../src/app/download";

const files = [{ name: "plate-body-all.csv", text: "﻿ID\r\n" }];

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as { canShare?: unknown }).canShare;
  delete (navigator as { share?: unknown }).share;
});

test("shares the files in one sheet when the phone can", async () => {
  const shareFn = vi.fn(async () => {});
  Object.assign(navigator, { canShare: () => true, share: shareFn });
  await shareOrDownload(files);
  expect(shareFn).toHaveBeenCalledTimes(1);
  expect((shareFn.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0].name).toBe("plate-body-all.csv");
});

test("a cancelled share does nothing else", async () => {
  Object.assign(navigator, { canShare: () => true, share: async () => { throw new DOMException("cancelled", "AbortError"); } });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  await shareOrDownload(files);
  expect(click).not.toHaveBeenCalled();
});

test("without sharing it downloads each file", async () => {
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  const names: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { names.push(this.download); });
  await shareOrDownload([...files, { name: "plate-meals-all.csv", text: "x" }]);
  expect(names).toEqual(["plate-body-all.csv", "plate-meals-all.csv"]);
});
