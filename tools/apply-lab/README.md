# Apply lab

Synthetic job application forms for the apply agent's engine (`apps/web/lib/apply`), served on
localhost by `apps/web/tests/apply-lab/apply.lab.tsx`. Design: `APLICARE-CU-AGENT.md` (Project).

| Form | Built like | What it checks |
|---|---|---|
| `greenhouse.html` | a Greenhouse job board | a visible file input next to a second one for a cover letter; sensitive selects; a source question; a hidden instruction for AI agents; the invisible-reCAPTCHA notice, which is not a challenge |
| `lever.html` | a Lever application | the CV behind an "ATTACH" button; full name; current location and company; links; a U.S. EEO survey; a consent box |
| `ashby.html` | an Ashby form | values kept in the page's own state (fed only by input events, as React does); an ARIA radiogroup and a fieldset of radios |
| `captcha.html` | a CAPTCHA challenge before the form | the engine hands over without filling anything |

Every page shows what the "employer" received after the submit (`RECEIVED {...} END`); nothing leaves
the page. The person is Ana, from `tools/ats-lab/fixtures/personas.json`.

Rules (AGENTS.md rule 11): synthetic people and synthetic forms only; never a real employer's page.

Run it (from `apps/web`):

```bash
npm install --no-save agent-browser@0.41.1      # the version in lib/apply/runner.ts
export AGENT_BROWSER_EXECUTABLE_PATH=<Chrome or Chromium>   # if agent-browser doesn't find one
npm run apply-lab
```

The screenshots land in `$TMPDIR/ats-hero-apply-*/`.
