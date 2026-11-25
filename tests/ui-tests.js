#!/usr/bin/env node
/* ui-tests — the Argue page in a real DOM (jsdom).
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * The engine has its own suite, including the countable done-means. This one proves the page
 * is wired to it: a session needs a counterpart, the pack's questions arrive in the transcript,
 * a higher difficulty pushes back, the scorecard quotes what was typed and names a missed
 * opening, the changelog records a movement, and a corrupt file is reported, not blanked.
 *
 *   npm install --no-save jsdom && node tests/ui-tests.js
 */
"use strict";

var fs = require("fs");
var path = require("path");
var { JSDOM } = require("jsdom");

var ROOT = path.join(__dirname, "..");
var PLAY = path.join(ROOT, "docs", "play");
var PAGE = path.join(PLAY, "index.html");

var passed = 0;
var failed = [];
function ok(name, cond, detail) { if (cond) { passed++; return; } failed.push(name + (detail ? " — " + detail : "")); }
function eq(name, a, b) { ok(name, a === b, "expected " + JSON.stringify(b) + ", got " + JSON.stringify(a)); }

function build(seed) {
  var html = fs.readFileSync(PAGE, "utf8");
  var dom = new JSDOM(html, { url: "https://example.test/play/index.html", runScripts: "outside-only", pretendToBeVisual: true });
  var w = dom.window;
  if (seed) Object.keys(seed).forEach(function (k) { w.localStorage.setItem(k, seed[k]); });
  w.URL.createObjectURL = function () { return "blob:x"; };
  w.URL.revokeObjectURL = function () {};
  w.HTMLAnchorElement.prototype.click = function () {};
  ["web-kit.js", "export-kit.js", "argue-core.js", "app.js"].forEach(function (f) {
    w.eval(fs.readFileSync(path.join(PLAY, f), "utf8"));
  });
  return dom;
}

var dom = build(null);
var w = dom.window;
var d = w.document;
var $ = function (id) { return d.getElementById(id); };

ok("the engine loaded into the page", !!w.ArgueCore);
eq("three scenarios are offered", $("scenario").options.length, 3);

/* ------------------------------------------------------------ the room */

$("scenario").value = "visa";
$("difficulty").value = "3";
$("counterpart").value = "   ";
$("start").click();
ok("a blank counterpart is refused on the page", /practising against nobody/.test($("status").textContent), $("status").textContent);
eq("no transcript is started", $("talkCard").hidden, true);

$("counterpart").value = "a visa officer at counter 4";
$("start").click();
eq("the conversation opens", $("talkCard").hidden, false);
eq("the first question is in the transcript", d.querySelectorAll("#transcript .turn.them").length, 1);
ok("the question is from the pack",
  w.ArgueCore.packById("visa").questions.some(function (q) { return $("transcript").textContent.indexOf(q) >= 0; }),
  $("transcript").textContent);
ok("the hidden goal is announced", /goal is hidden from the room, not from you/.test($("status").textContent), $("status").textContent);

/* --------------------------------------------------------------- turns */

$("say").value = "   ";
$("send").click();
ok("an empty turn is refused", /empty turn is refused/.test($("status").textContent), $("status").textContent);
eq("nothing was added to the transcript for it", d.querySelectorAll("#transcript .turn.you").length, 0);

$("say").value = "I am doing an MS in computer science because the labs are better.";
$("send").click();
eq("the answer is in the transcript", d.querySelectorAll("#transcript .turn.you").length, 1);
eq("no pushback on the first answer", d.querySelectorAll("#transcript .turn.pushback").length, 0);

$("say").value = "The fees are about thirty lakh for two years.";
$("send").click();
eq("the second answer gets a pushback", d.querySelectorAll("#transcript .turn.pushback").length, 1);
ok("the pushback quotes what was said", /You said/.test($("transcript").textContent), $("transcript").textContent);
ok("the app names the difficulty doing its job", /difficulty 3 doing its job/.test($("turnNote").textContent), $("turnNote").textContent);

/* ----------------------------------------------------------- the scorecard */

$("endSession").click();
eq("the scorecard appears", $("scoreCard").hidden, false);
ok("it quotes a sentence the person typed", /The fees are about thirty lakh/.test($("scoreOut").textContent),
  $("scoreOut").textContent);
ok("it names a missed opening or says all were taken", /opening/.test($("scoreOut").textContent), $("scoreOut").textContent);
ok("it offers a stronger phrasing", /stronger phrasing/.test($("scoreOut").textContent));
ok("it counts the pushbacks", /pushback\(s\)/.test($("scoreOut").textContent));
eq("the input is closed after scoring", $("say").disabled, true);
eq("the session is offered for export", $("exportSession").hidden, false);

$("exportSession").click();
ok("the export names the file it wrote", /Wrote rehearsal-\d{4}-\d\d-\d\d\.md/.test($("roomNote").textContent), $("roomNote").textContent);

/* ------------------------------------------------------------- steelman */

$("tab-steelman").click();
eq("the steelman panel shows", $("panel-steelman").hidden, false);

$("claim").value = "   ";
$("buildCase").click();
ok("an empty claim is refused", /nothing to steelman/.test($("status").textContent), $("status").textContent);
eq("no case is shown", $("caseCard").hidden, true);

$("claim").value = "We should move the office to Pune because the rent is cheaper.";
$("before").value = "80";
$("buildCase").click();
eq("the case appears", $("caseCard").hidden, false);
eq("three moves are shown", d.querySelectorAll("#moves .move").length, 3);
ok("each move is named", d.querySelectorAll("#moves .move h4").length === 3);
ok("the app says it is not calling the person wrong", /None of them says you are wrong/.test($("caseSays").textContent),
  $("caseSays").textContent);

$("after").value = "55";
$("why").value = "the cost I was not counting";
$("record").click();
eq("the changelog gets a row", d.querySelectorAll("#posTable tbody tr").length, 1);
ok("the row shows the movement", /-25/.test(d.querySelectorAll("#posTable tbody tr")[0].textContent),
  d.querySelectorAll("#posTable tbody tr")[0].textContent);
ok("the app says which way confidence moved", /fell by 25 points/.test($("status").textContent), $("status").textContent);
ok("drift is summarised", /confidence moved on 1 of them/.test($("driftNote").textContent), $("driftNote").textContent);

$("exportPositions").click();
ok("the changelog exports", /Wrote positions-/.test($("posNote").textContent), $("posNote").textContent);

/* --------------------------------------------------------------- reload */

var saved = w.localStorage.getItem("argue:state");
ok("the state was written to the device", !!saved);
var dom2 = build({ "argue:state": saved });
var d2 = dom2.window.document;
eq("the reload keeps the changelog", d2.querySelectorAll("#posTable tbody tr").length, 1);

/* ------------------------------------------- a corrupt file on reload */

var dom3 = build({ "argue:state": "{ broken" });
var d3 = dom3.window.document;
ok("a corrupt file is reported", /not readable JSON/.test(d3.getElementById("status").textContent),
  d3.getElementById("status").textContent);
ok("it says it was not replaced with a blank session", /not replaced with a blank session/.test(d3.getElementById("status").textContent));
ok("it offers an export of the unreadable file",
  Array.prototype.some.call(d3.querySelectorAll("button"), function (b) { return /Export the unreadable file/.test(b.textContent); }));
ok("and a deliberate restart",
  Array.prototype.some.call(d3.querySelectorAll("button"), function (b) { return /Start again, deliberately/.test(b.textContent); }));
ok("the corrupt file is not overwritten", /broken/.test(dom3.window.localStorage.getItem("argue:state")),
  dom3.window.localStorage.getItem("argue:state"));
eq("no positions are shown from a corrupt file", d3.querySelectorAll("#posTable tbody tr").length, 0);

var total = passed + failed.length;
if (!total) { console.error("ui-tests: 0 assertions ran. That is a failure, not a pass."); process.exit(1); }
if (failed.length) {
  console.error("ui-tests: " + passed + "/" + total + " passed, " + failed.length + " FAILED");
  failed.forEach(function (f) { console.error("  FAIL " + f); });
  process.exit(1);
}
console.log("ui-tests: " + passed + "/" + total + " assertions passed");
dom.window.close(); dom2.window.close(); dom3.window.close();
