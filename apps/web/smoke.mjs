// Headless render check: boot the built bundle in jsdom and assert the app
// mounted (no dual-React hooks crash, results list renders from /api mock).
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";

const dist = "../../assets/web";
const jsFile = readdirSync(`${dist}/assets`).find((f) => f.endsWith(".js"));
const html = readFileSync(`${dist}/index.html`, "utf8");

const dom = new JSDOM(html.replace(/<script[^>]*><\/script>/, ""), {
  url: "http://127.0.0.1:7878/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;
window.matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
const url = String(window.location);
window.fetch = async (input) => {
  const target = String(input);
  if (target.includes("/api/stats")) return { ok: true, json: async () => ({}) };
  if (target.includes("/api/related")) return { ok: true, json: async () => [] };
  if (target.includes("/api/diff"))
    return { ok: true, statusText: "OK", text: async () => "+ added line" };
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

const bundle = readFileSync(`${dist}/assets/${jsFile}`, "utf8");
try {
  window.eval(bundle);
} catch (error) {
  console.log("EVAL CRASH:", String(error).slice(0, 200));
  process.exit(1);
}
await new Promise((resolve) => setTimeout(resolve, 600));
const root = window.document.getElementById("root");
const html2 = root?.innerHTML ?? "";
console.log("mounted:", html2.length > 100);
console.log("brand present:", html2.includes("itwas"));
console.log("result row rendered:", html2.includes("smoke title"));
console.log("change id rendered:", html2.includes("oyzw"));
console.log("count rendered:", html2.includes("1 match"));
