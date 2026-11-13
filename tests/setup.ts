// Register jest-dom matchers on Vitest's global expect explicitly, so they
// load the same way whichever shell runs the tests. The "/vitest" import also
// brings in the matcher types.
import "@testing-library/jest-dom/vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

expect.extend(matchers);
