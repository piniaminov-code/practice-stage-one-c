# תרגול למבחן שלב א, כיתה ב

A static practice site for the gifted-test stage-one exam (grade 2), in Hebrew, built for phones.
No server, no accounts: everything a child does is saved in the browser on that device.

## What is where

| File | What it is |
| --- | --- |
| `index.html` | The page. Loads everything below. |
| `index-*.js`, `vendor-*.js`, `data-*.js`, `rolldown-runtime-*.js`, `index-*.css` | The original "סטים" page (7 sets, 98 questions). Built bundle, no source in this repo. Small edits were made in place. |
| `audio-*.js` | Voice clips (ElevenLabs) as base64 MP3, loaded after the page appears. |
| `bank.js` | Question bank for "אימון" and "מבחן": the 98 original questions, 6 new reading passages, and generated arithmetic / word problems / series. Readable source. |
| `tier2.js`, `tier2.css` | The "אימון", "מבחן" and "הורים" tabs: child profiles, practice, timed/untimed tests, review, parent report. Readable source. |
| `pwa.js`, `pwa.css`, `manifest.webmanifest`, `sw.js`, `icons/` | Add to home screen, fullscreen button, offline copy of the app. |
| `tools/verify-bank.mjs` | Checks every answer key. |

## Checking the questions

```bash
node tools/verify-bank.mjs
```

It re-solves every question from the text the child sees (not from the generator), checks each
explanation's arithmetic, rejects a number series that two different rules could continue, and lists
items marked for a parent to review (`FLAGS` in `bank.js`). It exits with an error if anything is wrong.

## Changing things safely

- **Generated questions** come from a fixed seed, so ids stay stable and saved progress keeps pointing at the
  same questions. Changing a generator changes the questions behind those ids; run the verifier afterwards.
- **Service worker**: after editing any shipped file, bump `VERSION` in `sw.js` so installed copies refresh
  their offline cache. Pages are fetched network-first, so online visitors always get the latest files anyway.
- **Data**: progress lives in `localStorage` (`stage1-family.v1` for the new tabs, `ilai-*` for the sets page).
  The parent area can save and restore a backup file.

## Running locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/ (the service worker only runs on localhost or https).
