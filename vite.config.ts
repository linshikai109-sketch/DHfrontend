import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
export default defineConfig(({mode}) => ({
  base: loadEnv(mode, process.cwd(), "VITE_").VITE_BASE_PATH || "/mvp-ui/v2/",
  plugins: [react()],
  build: { outDir: "dist" },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
}));
