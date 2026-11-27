# QA

Tests use the Playwright + Chromium already installed on the machine (no package.json, nothing to install).

```bash
python3 -m http.server 8765 &
export NODE_PATH=$(npm root -g)
node tools/verify-bank.mjs            # answer keys
node qa/tests/flows.cjs               # flows + regressions, exits 1 on failure
node qa/tests/sweep.cjs /tmp/shots    # defect sweep at 375x667 (VW=667 VH=375 for landscape)
```

`qa/logs/` holds raw logs of runs, `qa/media/` before/after screenshots.
