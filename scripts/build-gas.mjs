// Bundles the backend into one Apps Script file: gas/bundle.js defines `App`.
import { build } from "esbuild";

await build({
  entryPoints: ["src/backend/main.ts"],
  bundle: true,
  format: "iife",
  globalName: "App",
  target: "es2019",
  outfile: "gas/bundle.js",
  logLevel: "info",
});
