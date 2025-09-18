// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],                         // ✅ ต้องมี
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // ❌ ห้ามมี 'react' หรือ 'react-dom' มา alias เป็นอย่างอื่น
    },
  },
  build: {
    rollupOptions: {
      external: [],                          // ✅ ห้ามใส่ ['react','react-dom']
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom"],         // ✅ บังคับให้ bundle
    exclude: [],                             // ❌ ห้าม exclude react/react-dom
  },
});
