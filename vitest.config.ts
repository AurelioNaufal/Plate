import { defineConfig } from "vitest/config";

// App tests opt into jsdom with a `// @vitest-environment jsdom` docblock;
// everything else runs in node.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
  },
});
