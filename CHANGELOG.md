# Changelog

All notable changes to Argue are recorded here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Dates: dd/mm/yyyy.

## [Unreleased]

## [1.0.0] — 25/11/2026

### Added
- Three scenario packs with a hidden goal each: US student visa, campus placement, rent
  negotiation. The pack's questions are the script; nothing is improvised.
- Difficulty 1–3. At 2 and 3 the counterparty pushes back on the previous answer instead of
  moving on, quoting a word the person actually used and demanding something checkable.
- A scorecard counted from the transcript: a sentence the person said, the openings they took
  and the first one they missed, filler words with counts, and a mechanical rewrite of their
  shortest answer with the filler removed.
- Steelman: the strongest honest case against a claim from a bundled bank of seven argument
  moves, with a restatement check so a case that repeats the position is flagged rather than
  counted as opposition.
- A confidence changelog: before, after, the movement, and why — plus a drift summary.
- Refusals: a rehearsal with no stated counterpart, an empty turn, a position with no claim,
  confidence outside 0–100.
- Corruption handling: an unreadable file is reported, offered for export, and never replaced
  with a blank session.
- PWA shell, CI (88 engine assertions + 43 in jsdom + page smoke), and the app-builder pipeline
  pinned to the canonical SHA for the EXE/APK/Linux release.

### Not built
- The adaptive AI counterparty and the LLM-written counter-case: no model and no key here, and
  the app says so on the page rather than pretending otherwise.
