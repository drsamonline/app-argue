# Argue

Practise being pushed back on. One half is a **counterparty with a hidden goal** and a script; the
other is the **strongest honest case against your own position**, with a record of how your
confidence moved.

- **Demo (the app itself):** https://drsamonline.github.io/app-argue/play/index.html
- **Landing page:** https://drsamonline.github.io/app-argue/
- **Release:** https://github.com/drsamonline/app-argue/releases/tag/app-latest
- **Plan row:** #8 of 37 in `drsamonline/forge` → `QUEUE/PLAN.json`
- **Specs absorbed:** `app-rehearsal` (lead), `app-steelman`
- **Licence:** PolyForm Noncommercial 1.0.0

## Status

| | |
|---|---|
| **Built** | Three scenario packs with hidden goals; difficulty 1–3 with real pushback at 2 and 3; a scorecard counted from the transcript (your own sentence quoted, an opening you missed, filler counts, a mechanical rewrite); the steelman with a restatement check; a confidence changelog with drift; refusals for no counterpart, empty turns, no claim and out-of-range confidence. |
| **Release** | Windows EXE, Android APK and Linux binary, built from this source by `app-builder` in CI. |
| **Not built** | **The adaptive AI counterparty** and **the LLM-written counter-case**. Both prompts ask for a bring-your-own-key model; there is no model and no key here, so the counterparty is a bundled script and the counter-case is a bundled bank of moves. Said on the page, in the app and here. |
| **Untested** | Voice practice (the prompt asks for it; this is text only), the service worker and install prompt, and how the packs read to someone who has actually sat in a US visa interview — the scripts are plausible, not validated. |

## The Rehearsal spec's "done means", counted

> "In the visa-interview scenario the counterparty asks at least one question from that
> scenario's pack, and at the higher difficulty it pushes back on the previous answer instead of
> moving on. The post-session feedback quotes at least one sentence the user actually said and
> names one missed opening. With no key the packs still load and the scripted questions run."

| The spec says | The test |
|---|---|
| a question from the visa pack | every question asked is a pack question (or a pushback), and at least one is |
| higher difficulty pushes back on the previous answer | difficulty 3: first answer → question, second → pushback containing "You said"; difficulty 1 never pushes back |
| feedback quotes a sentence the user said | the quote is asserted to be one of the user's own turns |
| feedback names a missed opening | a vague transcript yields a named opening from the pack's own list |
| packs load with no key | three packs bundled, each with questions, openings and a hidden goal; no key or URL anywhere in the engine |

## Two specs, one job

Rehearsal is *practise the conversation*; Steelman is *build the case against yourself*. Both are
the same job from opposite sides of the table — **being pushed back on** — so there is one engine
with two modes and one store. Both specs' must-not ("don't grow a second job") is asserted.

## What it will not do

- **Pretend a model is in the room.** The counterparty is a script; the counter-case is a bank of seven moves.
- **Score an empty turn.** Say nothing and nothing is scored; the scorecard refuses to run on no answers.
- **Count a restatement as opposition.** A "counter-case" that repeats your own words is flagged as a restatement.
- **Invent a grade.** Every line of the scorecard is counted from the transcript; the rewrite is a filler-removal rule.
- **Use a key or a network.** No `fetch`, no endpoint; CSP `connect-src 'none'`.

## When things go wrong

| Case | Behaviour |
|---|---|
| **Bad input** | No stated counterpart → refused ("practising against nobody teaches nothing"). Empty turn → refused, not scored. No claim → refused. Confidence outside 0–100 → refused. |
| **No network** | Nothing changes; the packs, the moves and the transcript are on the device. |
| **Storage full or unavailable** | The session continues in memory and the app says the transcript will not be kept. |
| **Corrupt saved state** | Reported, offered for export, never replaced with a blank session. |

## The packs, and their hidden goals

| Pack | Who you are facing | Their hidden goal |
|---|---|---|
| US student visa | a visa officer at the consulate counter | to find out whether you intend to come back |
| Campus placement | a hiring manager with a fixed headcount | to fill the role at the lowest CTC the band allows |
| Rent negotiation | a landlord who wants the tenancy signed today | to hold the rent at or above his floor |

Each pack carries the **openings** it knows about — the plan back home, the funding documents, a
comparable flat's rent, a longer commitment in exchange — and the scorecard says which you took and
which you did not.

## Tests

```bash
npm test                      # all three suites
node tests/self-tests.js      # engine — 88 assertions, including the done-means
node tests/ui-tests.js        # the page in jsdom — 43 assertions (needs the dev-only jsdom)
node tests/page-smoke.js      # every local src/href resolves, nothing off-origin
```

Mutation-tested six ways on 25/11/2026: no pushback at any difficulty (3 failures), a scorecard
that stops quoting the user (1), a missed opening never named (2), a blank counterpart accepted (3),
an empty turn scored (2), and a corrupt file becoming a blank session (2) — each turned the suite
red; restored, 88/88.

## Layout

```
docs/index.html            landing page
docs/play/index.html       the app (Rehearsal and Steelman tabs)
docs/play/app.js           DOM wiring: the room, the turns, the scorecard, the changelog
docs/play/argue-core.js    the engine — packs, pushback, scorecard, argument bank, positions
docs/play/web-kit.js       vendored kit (unmodified)
docs/play/export-kit.js    vendored kit (unmodified)
tests/self-tests.js        engine suite (88)
tests/ui-tests.js          page suite (43, jsdom)
tests/page-smoke.js        shape on disk
PAGES.json                 landing = docs/index.html, app = docs/play/index.html
```

## Where the spec was silent, and what was chosen

- **Pushback is earned, not constant.** At difficulty 2 it happens on alternate answers; at 3, on every answer after the first. A counterparty that pushed back on the opening line would be a caricature, not practice.
- **The quote is the longest answer**, because that is the one with the most of the person in it.
- **The rewrite is mechanical.** It removes fillers and fixes the punctuation. A model would write a better sentence; a model would also be a claim this app cannot make.
- **Restatement detection is deliberately blunt** (shared content words over a threshold). It errs toward flagging, because a false "restatement" costs a retry and a false "counter-case" costs the whole point of the app.

## What is not built, and why

**The AI counterparty and the AI counter-case.** Both prompts specify a bring-your-own-key LLM. The
house rules forbid a runtime network call, and no on-device model exists in this estate — so the
script and the bank are the whole engine, not a fallback. The prompts' own offline-degradation
clause ("scenario scripts and rubrics work without a key") is therefore the only path here.

**Voice practice.** The prompt asks for voice or text. This is text: speech recognition in the
browser is a network service in most implementations, which the house rule forbids.
