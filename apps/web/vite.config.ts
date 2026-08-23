import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// kumo-ui 0.2 ships a UMD bundle but its exports map points at missing files,
// so alias the real entry (types come via tsconfig paths).
const kumoUiEntry = path.resolve(
  __dirname,
  "node_modules/kumo-ui/dist/index.js",
);
const kumoUiCss = path.resolve(
  __dirname,
  "node_modules/kumo-ui/dist/style.css",
);

// Built output is embedded into the itwas binary (see src/web.rs).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^kumo-ui$/, replacement: kumoUiEntry },
      { find: /^kumo-ui\/styles\.css$/, replacement: kumoUiCss },
    ],
  },
  base: "./",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:7878",
    },
  },
  build: {
    outDir: "../../assets/web",
    emptyOutDir: true,
  },
});
