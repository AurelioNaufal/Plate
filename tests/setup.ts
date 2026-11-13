// Register jest-dom matchers on both expects. With `globals: true`, Vitest 5
// hands test files a global `expect` that is not the same object as the one
// imported from "vitest", so extending only the import left the global one
// without toBeInTheDocument and friends. The "/vitest" import also brings in
// the matcher types.
import "@testing-library/jest-dom/vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

expect.extend(matchers);
const globalExpect = (globalThis as { expect?: typeof expect }).expect;
if (globalExpect && globalExpect !== expect) globalExpect.extend(matchers);
