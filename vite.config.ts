import { defineConfig } from "vite";
import { useEffect, useMemo, useRef, useState } from "react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
