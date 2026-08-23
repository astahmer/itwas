import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

// Only kumo-ui's stylesheet is used (its JS embeds a second React); the
// exports map doesn't resolve for bundlers, so alias the real css file.
const kumoUiCss = path.resolve(
  __dirname,
  "node_modules/kumo-ui/dist/style.css",
);


// Built output is embedded into the itwas binary (see src/web.rs).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{ find: /^kumo-ui\/styles\.css$/, replacement: kumoUiCss }],
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
