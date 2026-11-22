import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./theme.css";
import { applyTheme, initialTheme } from "./theme";

// Before the first paint, so a chosen theme never flashes the other one.
applyTheme(initialTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
