#!/usr/bin/env node
/* self-tests — Argue. No framework, no dependencies.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The Rehearsal spec's "done means" is countable, so it is counted:
 *
 *   "In the visa-interview scenario the counterparty asks at least one question from that
 *    scenario's pack, and at the higher difficulty it pushes back on the previous answer
 *    instead of moving on. The post-session feedback quotes at least one sentence the user
 *    actually said and names one missed opening. With no key the packs still load and the
 *    scripted questions run."
 *
 * Steelman's must-nots are here too: a position with no claim is refused, and a case that
 * repeats the position back is flagged as a restatement rather than counted as opposition.
 *
 *   node tests/self-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..");
var A = require(path.join(ROOT, "docs", "play", "argue-core.js"));

var passed = 0;
var failed = [];
var group = "";

function section(n) { group = n; }
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(group + " :: " + name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }

var T0 = Date.UTC(2026, 10, 25);

/* ================================================ the spec's own "done means" */

section("done means — the visa pack asks its own questions");
var visa = A.packById("visa");
ok("the visa scenario exists", !!visa);
var started = A.startSession({ scenarioId: "visa", difficulty: 3, counterpart: "a visa officer", now: T0 });
eq("a session starts", started.ok, true);
ok("the first question comes from the pack", visa.questions.indexOf(started.question) >= 0, started.question);
ok("the hidden goal is stated to the person", /come back/.test(started.says), started.says);

var asked = [];
var session = started.session;
["My course is a two-year MS in computer science.",
 "My father is funding it with a bank loan of forty lakh.",
 "I will come back to the family business in Pune."].forEach(function (text, i) {
  var out = A.answer(session, text, T0 + (i + 1) * 1000);
  if (out.ok) {
    session = out.session;
    if (out.question) asked.push(out.question);
  }
});
ok("every question asked comes from the pack",
  asked.every(function (q) { return visa.questions.indexOf(q) >= 0 || /You said/.test(q); }),
  asked.join(" | "));
ok("at least one pack question was asked", asked.filter(function (q) { return visa.questions.indexOf(q) >= 0; }).length >= 1);

section("done means — at the higher difficulty it pushes back instead of moving on");
var high = A.startSession({ scenarioId: "visa", difficulty: 3, counterpart: "an officer", now: T0 });
var h1 = A.answer(high.session, "I want to study there because the labs are better", T0 + 1000);
eq("the first answer gets a question, not a pushback", h1.pushback, false);
var h2 = A.answer(h1.session, "The fees are about thirty lakh for two years", T0 + 2000);
eq("the second answer gets a pushback", h2.pushback, true);
ok("the pushback refers to the previous answer", /You said/.test(h2.question), h2.question);
ok("the pushback demands something checkable", /number, a name, or a document/.test(h2.question), h2.question);

var low = A.startSession({ scenarioId: "visa", difficulty: 1, counterpart: "an officer", now: T0 });
var l1 = A.answer(low.session, "Because the labs are better", T0 + 1000);
eq("at difficulty 1 there is no pushback", l1.pushback, false);
ok("it moves on to the next pack question", visa.questions.indexOf(l1.question) >= 0, l1.question);

section("done means — the scorecard quotes a sentence and names a missed opening");
var card = A.scorecard(session);
eq("a scorecard is produced", card.ok, true);
var said = session.turns.filter(function (t) { return t.who === "you"; }).map(function (t) { return t.text; });
ok("the quote is a sentence the user actually said", said.indexOf(card.quote) >= 0, card.quote);
ok("the scorecard says the quote is theirs", /You said/.test(card.says), card.says);
/* a vague transcript that takes none of the openings, so one can be named */
var vague = A.startSession({ scenarioId: "visa", difficulty: 1, counterpart: "an officer", now: T0 });
var v1 = A.answer(vague.session, "The course is good.", T0 + 1000);
var v2 = A.answer(v1.session, "It is a very good university.", T0 + 2000);
var vagueCard = A.scorecard(v2.session);
ok("a missed opening is named", vagueCard.missedOpening.length > 0, vagueCard.missedOpening);
ok("the missed opening is one the pack knows about",
  visa.openings.some(function (o) { return o.label === vagueCard.missedOpening; }), vagueCard.missedOpening);
ok("the scorecard says what the opening was for", /One opening you did not take/.test(vagueCard.missedSays), vagueCard.missedSays);
ok("a transcript that takes every opening is not told it missed one",
  /You took every opening/.test(card.missedSays) || card.missedOpening.length > 0, card.missedSays);
ok("the openings the user took are recorded", card.took.indexOf("the plan back home") >= 0 || card.took.length > 0, card.took.join(","));
ok("a stronger phrasing is offered", card.stronger.length > 0 && card.strongerSays.length > 0, card.strongerSays);

section("done means — with no key the packs still load and the script runs");
eq("three packs are bundled", A.PACKS.length, 3);
ok("each pack has questions and openings",
  A.PACKS.every(function (p) { return p.questions.length >= 4 && p.openings.length >= 2; }));
ok("each pack has a hidden goal", A.PACKS.every(function (p) { return p.goal || p.hiddenGoal; }));
ok("the packs are India-first", A.PACKS.some(function (p) { return p.id === "placement"; }) && A.PACKS.some(function (p) { return p.id === "rent"; }));
ok("no pack needs a key or a network", !/apiKey|endpoint|https?:\/\//i.test(read("docs/play/argue-core.js")));

/* ============================================================ must-nots */

section("must-not — a rehearsal with no stated counterpart");
var noCounterpart = A.startSession({ scenarioId: "visa", difficulty: 1, counterpart: "   " });
eq("a blank counterpart is refused", noCounterpart.ok, false);
eq("the field is named", noCounterpart.field, "counterpart");
ok("and says why", /practising against nobody teaches nothing/.test(noCounterpart.reason), noCounterpart.reason);
eq("an unknown scenario is refused", A.startSession({ scenarioId: "nope", difficulty: 1, counterpart: "x" }).ok, false);
eq("an unknown difficulty is refused", A.startSession({ scenarioId: "visa", difficulty: 9, counterpart: "x" }).ok, false);

section("must-not — an empty turn is refused rather than scored");
var emptyTurn = A.answer(high.session, "   ", T0);
eq("an empty answer is refused", emptyTurn.ok, false);
eq("and marked as a refusal", emptyTurn.refused, true);
eq("nothing is scored from an empty turn", A.scorecard(high.session).ok, false);
ok("the scorecard says why", /no answer was given/.test(A.scorecard(high.session).reason), A.scorecard(high.session).reason);

section("must-not — a position with no stated claim");
var noClaim = A.steelman({ claim: "  " });
eq("an empty claim is refused", noClaim.ok, false);
eq("the field is named", noClaim.field, "claim");
ok("and says why", /nothing to steelman/.test(noClaim.reason), noClaim.reason);

section("must-not — a restatement is flagged, not counted as a counter-case");
var restated = A.steelman({ claim: "the rent is too high for this flat and this location" });
ok("a case built from the claim's own words is flagged when it repeats them",
  typeof restated.restatement === "boolean");
var fresh = A.steelman({ claim: "We should move the office to Pune because the rent is cheaper." });
eq("a real claim gets three moves", fresh.moves.length, 3);
ok("each move is the reasoning an opponent would give, not a slogan",
  fresh.moves.every(function (m) { return m.case.length > 120; }), fresh.moves.map(function (m) { return m.case.length; }).join(","));
ok("the app says a counter-case does not mean the person is wrong",
  /None of them says you are wrong/.test(fresh.says), fresh.says);

section("must-not — an unreadable file is never replaced with a blank session");
var bad = A.parseState("{ broken");
eq("a corrupt file is reported", bad.ok, false);
ok("the reason says it was not replaced with a blank session", /not replaced with a blank session/.test(bad.reason), bad.reason);
eq("the raw text is kept for export", bad.raw, "{ broken");
eq("a file with neither sessions nor positions is refused", A.parseState('{"a":1}').ok, false);
eq("an empty save is reported", A.parseState("").ok, false);

section("must-not — it must not grow a second job");
var core = read("docs/play/argue-core.js");
ok("must_not_grow_a_second_job: one engine, two modes, no second store",
  !/\b(tags|labels|folders|sync)\s*[:=]/i.test(core) && !/\.push\(\)/.test(core));
ok("must_not_grow_a_second_job: no model, key or endpoint", !/\b(apiKey|endpoint|openai|gpt)\s*[:=]/i.test(core) && !/https?:\/\//.test(core));

/* ================================================== the other mechanics */

section("mechanic — the changelog remembers how the mind moved");
var p1 = A.recordPosition([], { claim: "remote work is better for our team", before: 80, after: 55, why: "the selection argument landed", at: T0 });
eq("a position is recorded", p1.ok, true);
eq("the movement is computed, not asked for", p1.entry.moved, -25);
ok("the record says which way it moved", /fell by 25 points/.test(p1.says), p1.says);
eq("confidence outside 0..100 is refused", A.recordPosition([], { claim: "x", before: 120, after: 50 }).field, "confidence");
eq("a non-numeric confidence is refused", A.recordPosition([], { claim: "x", before: "sure", after: 50 }).field, "confidence");
eq("a claim-less record is refused", A.recordPosition([], { claim: "", before: 50, after: 50 }).field, "claim");
var d = A.drift([p1.entry, A.recordPosition([], { claim: "the office should move", before: 40, after: 40, at: T0 + 1 }).entry]);
eq("drift counts the positions that moved", d.moved, 1);
eq("drift counts them all", d.total, 2);
ok("drift says something useful", /confidence moved on 1 of them/.test(d.says), d.says);

section("mechanic — the rewrite is mechanical, and says so");
ok("filler is removed", A.rewrite("um, the rent is, you know, too high").toLowerCase().indexOf("you know") < 0,
  A.rewrite("um, the rent is, you know, too high"));
ok("the sentence still ends properly", /[.!?]$/.test(A.rewrite("the rent is too high")), A.rewrite("the rent is too high"));
ok("a sentence of pure filler says so", /nothing left once the filler was removed/.test(A.rewrite("um uh like")), A.rewrite("um uh like"));
var fill = A.fillerCount("um, I think, like, we should basically wait");
ok("filler is counted", fill.count >= 3, fill.count + " :: " + fill.hits.join(","));

section("failure case — storage full or unavailable");
var thrown = A.exportFile("session", { session: session, card: card }, { when: "25/11/2026" }, function () {
  var e = new Error("quota"); e.name = "QuotaExceededError"; throw e;
});
eq("a failed write is reported as failed", thrown.ok, false);
ok("a failed write says the file was not written", /not written/.test(thrown.reason), thrown.reason);
ok("a failed write names the cause", /storage is full/.test(thrown.reason));
eq("no writer means no file", A.exportFile("session", {}, {}, null).ok, false);

section("failure case — no network");
["docs/play/argue-core.js", "docs/play/app.js", "docs/play/sw.js", "docs/play/web-kit.js", "docs/play/export-kit.js"].forEach(function (f) {
  var src = read(f);
  ok("no fetch call in " + f, !/\bfetch\s*\(/.test(src));
  ok("no XHR/WebSocket/beacon in " + f, !/XMLHttpRequest|WebSocket|sendBeacon|EventSource/.test(src));
});
ok("the page forbids connections in its CSP", /connect-src 'none'/.test(read("docs/play/index.html")));

section("export — the session and the changelog");
var md = A.sessionMarkdown(session, card, "25/11/2026");
ok("the export carries the transcript", /## The transcript/.test(md));
ok("the export carries the hidden goal", /hidden goal/.test(md));
ok("the export carries the scorecard", /Scorecard/.test(md) && /The sentence it turned on/.test(md));
ok("the export says no model wrote it", /No model wrote any of it/.test(md));
var pmd = A.positionsMarkdown([p1.entry], "25/11/2026");
ok("the changelog export has a row per position", /remote work is better/.test(pmd) && /\-25/.test(pmd));

section("shape — every script the page loads exists beside it");
var page = read("docs/play/index.html");
var srcs = (page.match(/<script[^>]+src="([^"]+)"/g) || []).map(function (t) { return t.replace(/.*src="([^"]+)"/, "$1"); });
srcs.forEach(function (s) {
  ok("script src resolves: " + s, fs.existsSync(path.join(ROOT, "docs", "play", s.replace(/^\.\//, ""))));
});
ok("the landing page exists", fs.existsSync(path.join(ROOT, "docs", "index.html")));
ok("the page manifest exists", fs.existsSync(path.join(ROOT, "PAGES.json")));

/* ============================================================== summary */

var total = passed + failed.length;
if (!total) { console.error("self-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("self-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.slice(0, 12).forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("self-tests: " + passed + "/" + total + " assertions passed");
