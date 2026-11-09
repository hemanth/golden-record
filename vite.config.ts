import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
          vendor: ["react", "react-dom"]
        }
      }
    }
  }
});
