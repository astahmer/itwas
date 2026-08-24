# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: splitter.feature.spec.js >> Resizable splitter between list and detail panels >> Panels are side-by-side and resizable
- Location: .features-gen/splitter.feature.spec.js:6:3

# Error details

```
Error: expect(received).toBeLessThan(expected)

Expected: < 10
Received:   12
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]: itwas
    - generic [ref=e6]: jj history search
    - generic [ref=e7]: 16 matches
    - button "toggle light/dark theme" [ref=e8]: ☾ dark
  - generic [ref=e9]:
    - generic [ref=e11]:
      - generic [ref=e12]: query
      - textbox "query" [active] [ref=e14]:
        - /placeholder: type to search
    - generic [ref=e16]:
      - generic [ref=e17]: revset
      - combobox "revset" [ref=e19]
      - textbox [ref=e20]
    - generic [ref=e22]:
      - generic [ref=e23]: path
      - textbox "path" [ref=e25]:
        - /placeholder: any · glob:*.rs
    - generic [ref=e26]:
      - generic [ref=e27]: after
      - generic [ref=e29]:
        - textbox "after" [ref=e30]:
          - /placeholder: e.g. 2d · today
        - button "pick a date" [ref=e31] [cursor=pointer]: ▾
    - generic [ref=e32]:
      - generic [ref=e33]: until
      - generic [ref=e35]:
        - textbox "until" [ref=e36]:
          - /placeholder: e.g. 2d · today
        - button "pick a date" [ref=e37] [cursor=pointer]: ▾
    - group [ref=e38]:
      - button "metadata" [pressed] [ref=e39]
      - button "changes" [ref=e41]
      - button "snapshot" [ref=e42]
    - button "what do the lanes mean?" [ref=e43] [cursor=pointer]: "?"
    - group [ref=e44]:
      - button "literal" [pressed] [ref=e45]
      - button "regex" [ref=e47]
      - button "fuzzy" [ref=e48]
  - main [ref=e49]:
    - generic [ref=e50]:
      - table [ref=e53]:
        - rowgroup [ref=e54]:
          - row [ref=e55]:
            - columnheader [ref=e56]
            - columnheader "change" [ref=e57]
            - columnheader "date" [ref=e58]
            - columnheader "stats" [ref=e59]
            - columnheader "title" [ref=e60]
        - rowgroup [ref=e61]:
          - row [selected] [ref=e62] [cursor=pointer]:
            - cell "›" [ref=e63]
            - cell "urkm" [ref=e64]
            - cell "3 minutes ago" [ref=e65]
            - cell "+80 −0" [ref=e66]:
              - generic [ref=e67]: "+80"
              - generic [ref=e68]: −0
            - cell "wip" [ref=e69]
          - row [ref=e70] [cursor=pointer]:
            - cell [ref=e71]
            - cell "vyvq" [ref=e72]
            - cell "9 minutes ago" [ref=e73]
            - cell "+7361 −1754" [ref=e74]:
              - generic [ref=e75]: "+7361"
              - generic [ref=e76]: −1754
            - 'cell "web: fork @cloudflare/kumo sources shadcn-style into src/kumo" [ref=e77]'
          - row [ref=e78] [cursor=pointer]:
            - cell [ref=e79]
            - cell "pvsr" [ref=e80]
            - cell "17 minutes ago" [ref=e81]
            - cell "+3806 −1677" [ref=e82]:
              - generic [ref=e83]: "+3806"
              - generic [ref=e84]: −1677
            - 'cell "web: splitter styles, kumo-only controls, diff caching, playwright-bdd e2e suite" [ref=e85]'
          - row [ref=e86] [cursor=pointer]:
            - cell [ref=e87]
            - cell "smxy" [ref=e88]
            - cell "2 hours ago" [ref=e89]
            - cell "+2940 −1626" [ref=e90]:
              - generic [ref=e91]: "+2940"
              - generic [ref=e92]: −1626
            - 'cell "web: splitter, date pickers+presets, lane help, revset autocomplete, copy path, arrow-nav" [ref=e93]'
          - row [ref=e94] [cursor=pointer]:
            - cell [ref=e95]
            - cell "unok" [ref=e96]
            - cell "3 hours ago" [ref=e97]
            - cell "+2077 −2840" [ref=e98]:
              - generic [ref=e99]: "+2077"
              - generic [ref=e100]: −2840
            - 'cell "web: real @cloudflare/kumo components; fix q= search regression; UX round-2" [ref=e101]'
          - row [ref=e102] [cursor=pointer]:
            - cell [ref=e103]
            - cell "vrrz" [ref=e104]
            - cell "3 hours ago" [ref=e105]
            - cell "+1896 −1720" [ref=e106]:
              - generic [ref=e107]: "+1896"
              - generic [ref=e108]: −1720
            - 'cell "web: theme switch, keyboard nav, vendored kumo components, UX review fixes" [ref=e109]'
          - row [ref=e110] [cursor=pointer]:
            - cell [ref=e111]
            - cell "rvnq" [ref=e112]
            - cell "4 hours ago" [ref=e113]
            - cell "+2914 −301" [ref=e114]:
              - generic [ref=e115]: "+2914"
              - generic [ref=e116]: −301
            - 'cell "web: pierre diff rendering, kumo-only styling, aligned columns, auto-open browser" [ref=e117]'
          - row [ref=e118] [cursor=pointer]:
            - cell [ref=e119]
            - cell "mxsu" [ref=e120]
            - cell "17 hours ago" [ref=e121]
            - cell "+189 −82" [ref=e122]:
              - generic [ref=e123]: "+189"
              - generic [ref=e124]: −82
            - cell "url-synced web searches, find-within-diff" [ref=e125]
          - row [ref=e126] [cursor=pointer]:
            - cell [ref=e127]
            - cell "olpk" [ref=e128]
            - cell "20 hours ago" [ref=e129]
            - cell "+916 −92" [ref=e130]:
              - generic [ref=e131]: "+916"
              - generic [ref=e132]: −92
            - cell "web crash fix, enter->action menu, related changes" [ref=e133]
          - row [ref=e134] [cursor=pointer]:
            - cell [ref=e135]
            - cell "ptnp" [ref=e136]
            - cell "21 hours ago" [ref=e137]
            - cell "+3903 −32" [ref=e138]:
              - generic [ref=e139]: "+3903"
              - generic [ref=e140]: −32
            - cell "web command (embedded kumo-ui/vite app), date-format hints, jj-style change-id sections" [ref=e141]
          - row [ref=e142] [cursor=pointer]:
            - cell [ref=e143]
            - cell "oyzw" [ref=e144]
            - cell "21 hours ago" [ref=e145]
            - cell "+2104 −403" [ref=e146]:
              - generic [ref=e147]: "+2104"
              - generic [ref=e148]: −403
            - 'cell "search ux v2: jj-style TUI, dates, stats, scoping, actions" [ref=e149]'
          - row [ref=e150] [cursor=pointer]:
            - cell [ref=e151]
            - cell "tzwp" [ref=e152]
            - cell "21 hours ago" [ref=e153]
            - cell "+24 −12" [ref=e154]:
              - generic [ref=e155]: "+24"
              - generic [ref=e156]: −12
            - 'cell "docs: no-nix build instructions, local binary section, release profile tuning; add search UX v2 plan" [ref=e157]'
          - row [ref=e158] [cursor=pointer]:
            - cell [ref=e159]
            - cell "nuty" [ref=e160]
            - cell "21 hours ago" [ref=e161]
            - cell "+224 −2" [ref=e162]:
              - generic [ref=e163]: "+224"
              - generic [ref=e164]: −2
            - cell "next itwas work" [ref=e165]
          - row [ref=e166] [cursor=pointer]:
            - cell [ref=e167]
            - cell "uoqy" [ref=e168]
            - cell "21 hours ago" [ref=e169]
            - cell "+1044 −11" [ref=e170]:
              - generic [ref=e171]: "+1044"
              - generic [ref=e172]: −11
            - cell "build interactive jj history picker" [ref=e173]
          - row [ref=e174] [cursor=pointer]:
            - cell [ref=e175]
            - cell "yqzu" [ref=e176]
            - cell "21 hours ago" [ref=e177]
            - cell "+235 −31" [ref=e178]:
              - generic [ref=e179]: "+235"
              - generic [ref=e180]: −31
            - cell "add streaming change and snapshot search lanes" [ref=e181]
          - row [ref=e182] [cursor=pointer]:
            - cell [ref=e183]
            - cell "ptnu" [ref=e184]
            - cell "1 day ago" [ref=e185]
            - cell "+551 −0" [ref=e186]:
              - generic [ref=e187]: "+551"
              - generic [ref=e188]: −0
            - cell "scaffold Rust jj history search" [ref=e189]
      - separator "resize panes" [ref=e190]
      - complementary [ref=e192]:
        - generic [ref=e193]:
          - generic [ref=e194]: urkm
          - generic [ref=e195]:
            - text: urkm
            - button "Copy to clipboard" [ref=e196]
          - generic [ref=e204]: alexandre.stahmer@gmail.com
          - generic [ref=e205]: 2026-08-24 14:24
        - table [ref=e206]:
          - rowgroup [ref=e207]:
            - row [ref=e208]:
              - cell "[parent]" [ref=e209]
              - cell "vyvq" [ref=e210]
              - cell "9 minutes ago" [ref=e211]
              - 'cell "web: fork @cloudflare/kumo sources shadcn-style into src/kumo" [ref=e212]'
        - generic [ref=e213]:
          - generic [ref=e214]:
            - generic [ref=e215]: plans/ux-review-round3.md
            - generic [ref=e219]: "+80"
          - code [ref=e222]:
            - generic [ref=e223]:
              - generic [ref=e224]: "1"
              - generic [ref=e226]: "2"
              - generic [ref=e228]: "3"
              - generic [ref=e230]: "4"
              - generic [ref=e232]: "5"
              - generic [ref=e234]: "6"
              - generic [ref=e236]: "7"
              - generic [ref=e238]: "8"
              - generic [ref=e240]: "9"
              - generic [ref=e242]: "10"
              - generic [ref=e244]: "11"
              - generic [ref=e246]: "12"
              - generic [ref=e248]: "13"
              - generic [ref=e250]: "14"
              - generic [ref=e252]: "15"
              - generic [ref=e254]: "16"
              - generic [ref=e256]: "17"
              - generic [ref=e258]: "18"
              - generic [ref=e260]: "19"
              - generic [ref=e262]: "20"
              - generic [ref=e264]: "21"
              - generic [ref=e266]: "22"
              - generic [ref=e268]: "23"
              - generic [ref=e270]: "24"
              - generic [ref=e272]: "25"
              - generic [ref=e274]: "26"
              - generic [ref=e276]: "27"
              - generic [ref=e278]: "28"
              - generic [ref=e280]: "29"
              - generic [ref=e282]: "30"
              - generic [ref=e284]: "31"
              - generic [ref=e286]: "32"
              - generic [ref=e288]: "33"
              - generic [ref=e290]: "34"
              - generic [ref=e292]: "35"
              - generic [ref=e294]: "36"
              - generic [ref=e296]: "37"
              - generic [ref=e298]: "38"
              - generic [ref=e300]: "39"
              - generic [ref=e302]: "40"
              - generic [ref=e304]: "41"
              - generic [ref=e306]: "42"
              - generic [ref=e308]: "43"
              - generic [ref=e310]: "44"
              - generic [ref=e312]: "45"
              - generic [ref=e314]: "46"
              - generic [ref=e316]: "47"
              - generic [ref=e318]: "48"
              - generic [ref=e320]: "49"
              - generic [ref=e322]: "50"
              - generic [ref=e324]: "51"
              - generic [ref=e326]: "52"
              - generic [ref=e328]: "53"
              - generic [ref=e330]: "54"
              - generic [ref=e332]: "55"
              - generic [ref=e334]: "56"
              - generic [ref=e336]: "57"
              - generic [ref=e338]: "58"
              - generic [ref=e340]: "59"
              - generic [ref=e342]: "60"
              - generic [ref=e344]: "61"
              - generic [ref=e346]: "62"
              - generic [ref=e348]: "63"
              - generic [ref=e350]: "64"
              - generic [ref=e352]: "65"
              - generic [ref=e354]: "66"
              - generic [ref=e356]: "67"
              - generic [ref=e358]: "68"
              - generic [ref=e360]: "69"
              - generic [ref=e362]: "70"
              - generic [ref=e364]: "71"
              - generic [ref=e366]: "72"
              - generic [ref=e368]: "73"
              - generic [ref=e370]: "74"
              - generic [ref=e372]: "75"
              - generic [ref=e374]: "76"
              - generic [ref=e376]: "77"
              - generic [ref=e378]: "78"
              - generic [ref=e380]: "79"
              - generic [ref=e382]: "80"
            - generic [ref=e384]:
              - generic [ref=e385]: "# itwas web — UI/UX audit, round 3"
              - generic [ref=e387]: "Date: 2026-08-24. Method: playwright screenshots (5 states: dark filtered,"
              - generic [ref=e388]: light, changes lane w/ diff panel, date-picker popover open, lane-help popover
              - generic [ref=e389]: "open) analyzed via modlens vision + direct code review of `apps/web/src/App.tsx`"
              - generic [ref=e390]: "and `app.css`."
              - generic [ref=e392]: "## Working well"
              - generic [ref=e394]: "- Two-pane layout with resizable splitter; panels render side-by-side at 55/45."
              - generic [ref=e395]: "- Pierre diff rendering with syntax highlighting; related-changes block"
              - generic [ref=e396]: (parents/children) renders inline in the detail panel.
              - generic [ref=e397]: "- Date picker popover works end-to-end: calendar grid for the current month,"
              - generic [ref=e398]: navigation arrows, preset buttons (today / last week / last month /
              - generic [ref=e399]: last 90 days) — confirmed rendering in screenshot.
              - generic [ref=e400]: "- Lane-help popover opens from `?` and lists all three lanes with descriptions."
              - generic [ref=e401]: "- Change-ID per-commit hue coloring, green/red stats column, zebra rows."
              - generic [ref=e402]: "- Light and dark themes both fully styled; theme persists across reloads."
              - generic [ref=e404]: "## Defects + fixes"
              - generic [ref=e406]: 1. **[high] Low contrast on change-ID hash colors and muted text in light
              - generic [ref=e407]: "mode** — pastel HSL hues (~62% lightness) and `--text-muted: #59636e` sit"
              - generic [ref=e408]: "near/below WCAG AA 4.5:1 on white. *Fix*: darken light-theme hues to ~38%"
              - generic [ref=e409]: "lightness and raise muted to `#424a53`; add a contrast test to the e2e"
              - generic [ref=e410]: suite that samples computed styles.
              - generic [ref=e411]: 2. **[medium] Related-changes rows truncate without ellipsis or tooltip**
              - generic [ref=e412]: "(`[parent] smxy…` clipped at right edge). *Fix*: apply the same"
              - generic [ref=e413]: "`overflow:hidden; text-overflow:ellipsis; max-width` + `title` attr used on"
              - generic [ref=e414]: "result-title cells to `.related td:last-child`."
              - generic [ref=e415]: 3. **[medium] Segmented lane/match toggles lack group boundaries** — they read
              - generic [ref=e416]: "as loose floating buttons. *Fix*: wrap each Segmented in a bordered"
              - generic [ref=e417]: "container (`border: 1px solid var(--border); border-radius: 8px;"
              - generic [ref=e418]: "padding: 2px`) so the group reads as one control."
              - generic [ref=e419]: 4. **[medium] Filter bar inputs are visually undifferentiated from secondary
              - generic [ref=e420]: "filters** — query looks identical in weight to revset/path/date. *Fix*:"
              - generic [ref=e421]: give query a wider min-width (~260px), accent-colored focus ring, and place
              - generic [ref=e422]: it on its own row above the secondary filters.
              - generic [ref=e423]: 5. **[low] Input borders faint in light mode** — kumo standalone ring color is
              - generic [ref=e424]: "near-invisible on `--bg`. *Fix*: one-line override in app.css:"
              - generic [ref=e425]: "`.app input { box-shadow: inset 0 0 0 1px var(--border); }`."
              - generic [ref=e426]: 6. **[low] Detail-panel description bullets have no vertical rhythm** (dense
              - generic [ref=e427]: "wall of `-` lines). *Fix*: render description lines as a `<ul>` with"
              - generic [ref=e428]: "`margin-bottom: 4px` per item when the first char is `-`."
              - generic [ref=e429]: 7. **[low] Footer "refresh" is low-affordance** — outline variant reads as
              - generic [ref=e430]: "disabled. *Fix*: use `variant=\"secondary\"` and drop the redundant label"
              - generic [ref=e431]: next to it (keyboard hint stays).
              - generic [ref=e433]: "## Suggestions (impact-ranked)"
              - generic [ref=e435]: 1. **Column sorting + manual column resize** on the results table
              - generic [ref=e436]: (click-to-sort date/stats/title; drag handles). Highest-value table
              - generic [ref=e437]: upgrade now that alignment is solid.
              - generic [ref=e438]: 2. **Group repeated changes-lane rows by commit** — currently one row per
              - generic [ref=e439]: matching line repeats the same commit; collapsible per-commit groups with
              - generic [ref=e440]: match-count badges would cut noise dramatically on busy diffs.
              - generic [ref=e441]: "3. **Large-diff cutoff**: commits >~1500 changed lines render slowly through"
              - generic [ref=e442]: Pierre's virtualizer; show a notice + "open flat view" fallback beyond a
              - generic [ref=e443]: threshold.
              - generic [ref=e444]: "4. **Revset syntax cheat-sheet** inside the existing `?` popover (second tab):"
              - generic [ref=e445]: "common functions (`mine()`, `heads()`, `roots()`, `::from..to`) with"
              - generic [ref=e446]: click-to-insert.
              - generic [ref=e447]: "5. **Result-row actions on hover** (copy id / copy `jj new` inline per row)"
              - generic [ref=e448]: instead of only in the detail header.
              - generic [ref=e449]: 6. **Virtualize results list** if limits grow past ~500 (currently capped at
              - generic [ref=e450]: 200 by default; fine today).
              - generic [ref=e451]: "7. **Persist selected revision** in the URL (`&sel=changeid`) so permalinks"
              - generic [ref=e452]: restore the exact inspection state.
              - generic [ref=e454]: "## Screenshots-referenced"
              - generic [ref=e456]: "- `/tmp/ux3-dark.png` — dark, `?q=search` filtered"
              - generic [ref=e457]: "- `/tmp/ux3-light.png` — light theme unfiltered"
              - generic [ref=e458]: "- `/tmp/ux3-changes.png` — changes lane with diff panel"
              - generic [ref=e459]: "- `/tmp/ux3-date.png` — date-picker popover open (calendar + presets confirmed)"
              - generic [ref=e460]: "- `/tmp/ux3-help.png` — lane-help popover open"
              - generic [ref=e462]: "Vision-provider note: gemini-api quota was exhausted mid-audit; dark/light"
              - generic [ref=e463]: audits completed there, remaining shots verified via layout-region extraction
              - generic [ref=e464]: (calendar, presets, help content confirmed present and positioned correctly).
  - contentinfo [ref=e465]:
    - button "refresh" [ref=e466]
    - generic [ref=e467]: ↑↓ navigate
```

# Test source

```ts
  1  | import { expect } from "@playwright/test";
  2  | import { createBdd } from "playwright-bdd";
  3  | 
  4  | const { Given, When, Then } = createBdd();
  5  | 
  6  | async function panels(page: import("@playwright/test").Page) {
  7  |   // ark-ui renders panels as [data-part="panel"]; ours are in DOM order.
  8  |   const all = page.locator("[data-scope='splitter'][data-part='panel']");
  9  |   const count = await all.count();
  10 |   if (count < 2) throw new Error(`expected 2 splitter panels, found ${count}`);
  11 |   return {
  12 |     list: await all.nth(0).boundingBox(),
  13 |     detail: await all.nth(1).boundingBox(),
  14 |   };
  15 | }
  16 | 
  17 | Then("the list and detail panels are side-by-side", async ({ page }) => {
  18 |   const { list, detail } = await panels(page);
  19 |   expect(list).not.toBeNull();
  20 |   expect(detail).not.toBeNull();
  21 |   // Horizontally adjacent: detail starts where list ends (within tolerance).
> 22 |   expect(Math.abs((list!.x + list!.width) - detail!.x)).toBeLessThan(10);
     |                                                         ^ Error: expect(received).toBeLessThan(expected)
  23 |   // Same vertical range: NOT stacked.
  24 |   expect(Math.abs(list!.y - detail!.y)).toBeLessThan(10);
  25 |   expect(Math.abs(list!.height - detail!.height)).toBeLessThan(8);
  26 | });
  27 | 
  28 | Then("a resize trigger is visible between them", async ({ page }) => {
  29 |   const trigger = page.locator("[data-part='resize-trigger']");
  30 |   await expect(trigger).toBeVisible();
  31 | });
  32 | 
  33 | When("I drag the resize trigger left by {int} pixels", async ({ page }, pixels: number) => {
  34 |   const trigger = page.locator("[data-part='resize-trigger']");
  35 |   const box = await trigger.boundingBox();
  36 |   if (!box) throw new Error("resize trigger has no bounding box");
  37 |   await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  38 |   await page.mouse.down();
  39 |   await page.mouse.move(box.x + box.width / 2 - pixels, box.y + box.height / 2, {
  40 |     steps: 6,
  41 |   });
  42 |   await page.mouse.up();
  43 | });
  44 | 
  45 | Then("the detail panel width changed by at least {int} pixels", async ({ page }, minDelta: number) => {
  46 |   const { detail } = await panels(page);
  47 |   expect(detail!.width).toBeGreaterThan(minDelta / 2 + 300); // grew from ~45%
  48 | });
  49 | 
```