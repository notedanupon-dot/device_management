// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";          // ✅ ต้องมี
import { fileURLToPath, URL } from "node:url";     // (ถ้าจะตั้ง alias)

export default defineConfig({
  plugins: [react()],                              // ✅ เรียก react() จาก plugin ที่ import มา
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)), // ให้ตรงกับ tsconfig paths
    },
  },
});
