# Apply lab

Synthetic job application forms for the apply agent's engine (`apps/web/lib/apply`), served on
localhost by `apps/web/tests/apply-lab/apply.lab.tsx`. Design: `APLICARE-CU-AGENT.md` (Project).

| Form | Built like | What it checks |
|---|---|---|
| `greenhouse.html` | a Greenhouse job board | a visible file input next to a second one for a cover letter; sensitive selects; a source question; a hidden instruction for AI agents; the invisible-reCAPTCHA notice, which is not a challenge |
| `lever.html` | a Lever application | the CV behind an "ATTACH" button; full name; current location and company; links; a custom question whose radios sit in a list under it; a U.S. EEO survey; a consent box |
| `ashby.html` | an Ashby form | values kept in the page's own state (fed only by input events, as React does); an ARIA radiogroup and a fieldset of radios |
| `captcha.html` | a CAPTCHA challenge before the form | the engine hands over without filling anything |
| `tricky.html` | traps a real form can hold | "Country of birth" and "Referrer's email" (never filled from the CV); the cover-letter input first and the CV input named only by its own label; a box checked and an answer chosen before the person sees them; a paragraph telling AI agents what to type in the unlabeled box under it; a posting that already says "thank you for applying"; a submit that fails |
| `date.html` | a form with a date field | the engine doesn't set dates: it hands the form to the person before filling anything |

Every page shows what the "employer" received after the submit (`RECEIVED {...} END`; `tricky.html`
shows it under its error); nothing leaves the page. The person is Ana, from `tools/ats-lab/fixtures/personas.json`.

Rules (AGENTS.md rule 11): synthetic people and synthetic forms only; never a real employer's page.

Run it (from `apps/web`):

```bash
npm install --no-save agent-browser@0.41.1      # the version in lib/apply/runner.ts
export AGENT_BROWSER_EXECUTABLE_PATH=<Chrome or Chromium>   # if agent-browser doesn't find one
npm run apply-lab
```

The screenshots land in `$TMPDIR/ats-hero-apply-*/`.
