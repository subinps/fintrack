# Conventions

## Guards (added after a mistake repeated)
- Before calling UI work done, render it in the browser at 390px and 1280px and check overflow, clipped text, overlap and contrast.
- Report a test, build or fix as passing only after running it in the same task; quote the command and its result, and write "Not verified:" otherwise.
- Before finishing, stop the servers and background commands you started; long-lived work goes in a job or the preview.
- Fix overflow, clipped text, overlap and low contrast that the browser check reports before calling UI work done.

## Browser checks (FinTrack)
- Sidebar nav buttons are named exactly by their page label ("Reports", "Shared"); inner panel tabs are named "<Panel> tab" ("Budget & Goals tab", "Automations tab"). On phones open the drawer first with "Open navigation".
- Seeds: demo@fintrack.app / demo1234. Tests use their own database and ports, so browser checks can run while `npm test` runs.
- A modal open over a list reports the covered rows as "overlaps"; that is the overlay, not a layout bug.

## Dense mobile rows
- Account/category chips must be `shrink-0 whitespace-nowrap`; without it the flex row squeezes them and the text overflows.
- On phones, per-row quick actions collapse into a dropdown with a 44px trigger ("Actions for <description>"); the inline icon buttons are desktop-only (`hidden md:flex`).
