// src/main.tsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

function ensureRoot(): HTMLElement {
  let el = document.getElementById("root");
  if (!el) {
    el = document.createElement("div");
    el.id = "root";
    document.body.appendChild(el);
  }
  return el as HTMLElement;
}

const container = ensureRoot();
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
