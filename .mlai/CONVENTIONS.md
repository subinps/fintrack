# Conventions

## Guards (added after a mistake repeated)
- Before calling UI work done, render it in the browser at 390px and 1280px and check overflow, clipped text, overlap and contrast.
- Report a test, build or fix as passing only after running it in the same task; quote the command and its result, and write "Not verified:" otherwise.
- Before finishing, stop the servers and background commands you started; long-lived work goes in a job or the preview.
- Fix overflow, clipped text, overlap and low contrast that the browser check reports before calling UI work done.

## Design system (Night Vault)
- One token file: `frontend/src/index.css` holds HSL triples for light (`:root`), dark (`.dark`), the semantic money hues (`--income`, `--expense`, `--assets`, `--liabilities`, `--equity`, `--investments`, `--savings`, `--info`), `--cat-1..12`, `--chart-1..8`, motion durations and five accent sets under `[data-accent]`. `tailwind.config.js` only exposes them (`text-income`, `bg-cat-7`, `border-liabilities/25`). No hex in a component.
- Dark is the default theme (`defaultTheme="dark"` in `App.tsx`); light is the same system on cool paper. The accent choice is saved in localStorage (`fintrack.accent`) and applied before first paint from `main.tsx`.
- The appearance panel in `ThemeToggle.tsx` is a Popover, not a DropdownMenu. Buttons nested inside a Radix menu never settle, so automation cannot click them and a real popover is the honest control.
- Shared primitives live in `frontend/src/components/system/`: `IconBadge` (the tinted icon square used for accounts, categories and guide topics), `Money` (Indian grouping, tabular figures, count-up that respects reduced motion), `AccentPicker`.
- Help Centre content is data, not JSX: add a guide to `frontend/src/lib/guides.ts` and the index, search and previous/next links pick it up.

## Browser checks (FinTrack)
- Sidebar nav buttons are named exactly by their page label ("Reports", "Shared"); inner panel tabs are named "<Panel> tab" ("Budget & Goals tab", "Automations tab"). On phones open the drawer first with "Open navigation".
- Seeds: demo@fintrack.app / demo1234. Tests use their own database and ports, so browser checks can run while `npm test` runs.
- A modal open over a list reports the covered rows as "overlaps"; that is the overlay, not a layout bug. The same goes for content under the sticky top bar after the page scrolls, and for a popover over sidebar rows.
- The appearance panel will not accept a click while Overview's charts and the net-value count-up are still animating (~1s after login). Assert one page string first to let the page settle.

## Dense mobile rows
- Account/category chips must be `shrink-0 whitespace-nowrap`; without it the flex row squeezes them and the text overflows.
- On phones, per-row quick actions collapse into a dropdown with a 44px trigger ("Actions for <description>"); the inline icon buttons are desktop-only (`hidden md:flex`).
