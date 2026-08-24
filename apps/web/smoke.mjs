// Headless render check: boot the built bundle in jsdom and assert the app
// mounted (no dual-React hooks crash, results list renders from /api mock).
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const dist = "../../assets/web";
const html = readFileSync(`${dist}/index.html`, "utf8");
const entry = html.match(/src="\.\/(assets\/[^"]+\.js)"/)?.[1];
if (!entry) throw new Error("entry script not found in index.html");
// The built entry is an ES module with dynamic imports; flatten to an IIFE
// so jsdom can eval it as a classic script.
execSync(
  `node_modules/.bin/esbuild ${dist}/${entry} --bundle --format=iife --platform=browser --outfile=/tmp/itwas-smoke-bundle.js`,
  { stdio: "inherit" },
);
const bundlePath = "/tmp/itwas-smoke-bundle.js";

const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/, ""), {
  url: "http://127.0.0.1:7878/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;
window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
const url = String(window.location);
window.fetch = async (input) => {
  const target = String(input);
  if (target.includes("/api/stats")) return { ok: true, json: async () => ({}) };
  if (target.includes("/api/related")) return { ok: true, json: async () => [] };
  if (target.includes("/api/diff"))
    return {
      ok: true,
      statusText: "OK",
      text: async () =>
        [
          "diff --git a/src/a.rs b/src/a.rs",
          "index 1111111..2222222 100644",
          "--- a/src/a.rs",
          "+++ b/src/a.rs",
          "@@ -1,2 +1,3 @@",
          " fn main() {}",
          "+added line",
          " context",
          "diff --git a/src/b.rs b/src/b.rs",
          "index 3333333..4444444 100644",
          "--- a/src/b.rs",
          "+++ b/src/b.rs",
          "@@ -1 +1,2 @@",
          "-old",
          "+new",
        ].join("\n"),
    };
  return {
    ok: true,
    statusText: "OK",
    json: async () => ({
      truncated: false,
      matches: 1,
      results: [{
        commit_id: "abc123", change_id: "oyzw", title: "smoke title", detail: "smoke title\nbody",
        bookmarks: ["main"], tags: [], author: "a@b.c", timestamp: Math.floor(Date.now()/1000),
        file: null, line: null,
      }],
    }),
  };
};

const bundle = readFileSync(bundlePath, "utf8");
window.addEventListener("error", (e) => console.log("WINDOW ERROR:", String(e.message).slice(0, 300)));
window.addEventListener("unhandledrejection", (e) => console.log("REJECTION:", String(e.reason).slice(0, 300)));
try {
  window.eval(bundle);
} catch (error) {
  console.log("EVAL CRASH:", String(error).slice(0, 300));
  process.exit(1);
}
await new Promise((resolve) => setTimeout(resolve, 2000));
const root = window.document.getElementById("root");
const html2 = root?.innerHTML ?? "";
console.log("mounted:", html2.length > 100);
console.log("brand present:", html2.includes("itwas"));
console.log("result row rendered:", html2.includes("smoke title"));
console.log("change id rendered:", html2.includes("oyzw"));
console.log("count rendered:", html2.includes("1 match"));
console.log("pierre diff rendered:", html2.includes("diff --git") || html2.includes("added line"));
console.log("pierre container:", html2.includes("diffs-container"));
const aside = window.document.querySelector(".detail");
console.log("detail html sample:", (aside?.innerHTML ?? "").slice(0, 600));
