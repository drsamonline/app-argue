/* app — the Argue page. SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * Wiring only: the packs, the pushback rule, the scorecard, the argument bank and the
 * changelog all live in argue-core.js, which the tests exercise directly.
 */
(function () {
  "use strict";

  var A = window.ArgueCore;
  var $ = function (id) { return document.getElementById(id); };

  var K_STATE = "argue:state";

  var els = {
    status: $("status"),
    scenario: $("scenario"), difficulty: $("difficulty"), counterpart: $("counterpart"),
    start: $("start"), endSession: $("endSession"), exportSession: $("exportSession"), roomNote: $("roomNote"),
    talkCard: $("talkCard"), transcript: $("transcript"), say: $("say"), send: $("send"), turnNote: $("turnNote"),
    scoreCard: $("scoreCard"), scoreOut: $("scoreOut"), talkEmpty: $("talkEmpty"),
    claim: $("claim"), before: $("before"), beforeVal: $("beforeVal"), buildCase: $("buildCase"), caseNote: $("caseNote"),
    caseCard: $("caseCard"), moves: $("moves"), caseSays: $("caseSays"),
    after: $("after"), afterVal: $("afterVal"), why: $("why"), record: $("record"), recordNote: $("recordNote"),
    posTable: $("posTable"), driftNote: $("driftNote"), exportPositions: $("exportPositions"), posNote: $("posNote")
  };

  var state = { session: null, card: null, caseFor: null, sessions: [], positions: [], when: "" };

  /* ------------------------------------------------------------- helpers */

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear();
  }

  function setStatus(kind, msg) {
    els.status.className = "status show " + kind;
    els.status.textContent = msg;
  }
  function clearStatus() { els.status.className = "status"; els.status.textContent = ""; }

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function persist() {
    try {
      window.localStorage.setItem(K_STATE, A.serializeState({ savedOn: Date.now(), sessions: state.sessions, positions: state.positions }));
      return true;
    } catch (e) {
      setStatus("warn", "This session will not be kept: " +
        (e && e.name === "QuotaExceededError" ? "storage is full" : "storage is unavailable") +
        ". The rehearsal continues in memory.");
      return false;
    }
  }

  /* ---------------------------------------------------------- rehearsal */

  function fillScenarios() {
    A.PACKS.forEach(function (p) {
      var o = node("option", null, p.name);
      o.value = p.id;
      els.scenario.appendChild(o);
    });
  }

  function start() {
    clearStatus();
    var pack = A.packById(els.scenario.value);
    var out = A.startSession({
      scenarioId: els.scenario.value,
      difficulty: els.difficulty.value,
      counterpart: els.counterpart.value.trim(),
      now: Date.now()
    });
    if (!out.ok) {
      setStatus("bad", out.reason);
      if (out.field === "counterpart") els.counterpart.focus();
      return;
    }
    state.session = out.session;
    state.card = null;
    els.counterpart.value = out.session.counterpart;
    els.talkCard.hidden = false;
    els.scoreCard.hidden = true;
    els.talkEmpty.hidden = true;
    els.endSession.hidden = false;
    els.exportSession.hidden = true;
    els.transcript.textContent = "";
    els.transcript.appendChild(turn("them", out.question));
    els.turnNote.textContent = "Question 1 of " + A.packById(out.session.packId).questions.length +
      (out.session.difficulty > 1 ? " · at this difficulty it may push back instead of moving on." : ".");
    els.say.value = "";
    els.say.focus();
    setStatus("ok", out.says);
    persist();
  }

  function turn(who, text, kind) {
    var box = node("div", "turn " + (kind === "pushback" ? "pushback" : who));
    box.appendChild(node("span", "who", who === "you" ? "you" : "them"));
    box.appendChild(document.createTextNode(text));
    return box;
  }

  function send() {
    if (!state.session) return;
    var out = A.answer(state.session, els.say.value, Date.now());
    if (!out.ok) {
      setStatus("bad", out.reason);
      return;
    }
    els.transcript.appendChild(turn("you", els.say.value.trim()));
    els.say.value = "";
    state.session = out.session;

    if (out.done) {
      els.transcript.appendChild(turn("them", "Thank you. That is all from me."));
      els.say.value = "";
      setStatus("ok", out.says);
      endSession();
      return;
    }
    els.transcript.appendChild(turn("them", out.question, out.pushback ? "pushback" : ""));
    els.turnNote.textContent = out.pushback
      ? "They pushed back instead of moving on — that is difficulty " + state.session.difficulty + " doing its job."
      : "Next question.";
    setStatus(out.pushback ? "warn" : "ok", out.pushback
      ? "Pushback: answer the challenge, not the question you prepared for."
      : "Next question.");
    persist();
  }

  function endSession() {
    if (!state.session) return;
    var card = A.scorecard(state.session);
    if (!card.ok) { setStatus("bad", card.reason); return; }
    state.card = card;
    state.sessions.push(state.session);
    var saved = persist();
    els.scoreCard.hidden = false;
    els.exportSession.hidden = false;
    els.say.disabled = true;
    els.send.disabled = true;
    renderScore(card);if (saved) 
    setStatus("ok", "Session scored. Every line of this scorecard is counted from your transcript.");
  }

  function renderScore(card) {
    els.scoreOut.textContent = "";
    els.scoreOut.appendChild(node("div", null, card.says));
    var q = node("span", "q", "\u201c" + card.quote + "\u201d");
    els.scoreOut.appendChild(q);
    var list = node("ul");
    list.style.margin = "8px 0 0";
    list.appendChild(node("li", null, card.answers + " answer(s), " + card.pushbacks + " pushback(s) at difficulty " + card.difficulty + "."));
    list.appendChild(node("li", null, card.missedSays));
    if (card.took.length) list.appendChild(node("li", null, "Openings you took: " + card.took.join(", ") + "."));
    list.appendChild(node("li", null, "Filler words: " + card.fillers.count + (card.fillers.hits.length ? " (" + card.fillers.hits.join(", ") + ")" : "")));
    list.appendChild(node("li", null, card.strongerSays));
    els.scoreOut.appendChild(list);
  }

  /* ----------------------------------------------------------- steelman */

  function buildCase() {
    clearStatus();
    var out = A.steelman({ claim: els.claim.value });
    if (!out.ok) {
      setStatus("bad", out.reason);
      els.claim.focus();
      return;
    }
    state.caseFor = out;
    els.caseCard.hidden = false;
    els.moves.textContent = "";
    out.moves.forEach(function (m) {
      var box = node("div", "move");
      box.appendChild(node("h4", null, m.move));
      box.appendChild(node("p", null, m.case));
      els.moves.appendChild(box);
    });
    els.caseSays.textContent = out.says;
    els.after.value = els.before.value;
    els.afterVal.textContent = els.after.value;
    setStatus(out.restatement ? "warn" : "ok", out.restatement
      ? "That case repeats your position back to you — flagged as a restatement, not a counter-case."
      : "Three lines of attack. Read them, then set your confidence again.");
  }

  function record() {
    if (!state.caseFor) { setStatus("bad", "Build the case first — there is nothing to record yet."); return; }
    var out = A.recordPosition(state.positions, {
      claim: state.caseFor.claim,
      before: els.before.value,
      after: els.after.value,
      why: els.why.value,
      at: Date.now()
    });
    if (!out.ok) { setStatus("bad", out.reason); return; }
    state.positions.push(out.entry);
    var saved = persist();
    renderPositions();
    els.recordNote.textContent = out.says;if (saved) 
    setStatus("ok", out.says);
  }

  function renderPositions() {
    var body = els.posTable.querySelector("tbody");
    body.textContent = "";
    state.positions.slice().reverse().forEach(function (p) {
      var tr = node("tr");
      tr.appendChild(node("td", null, p.claim));
      tr.appendChild(node("td", null, String(p.before)));
      tr.appendChild(node("td", null, String(p.after)));
      tr.appendChild(node("td", null, (p.moved > 0 ? "+" : "") + p.moved));
      tr.appendChild(node("td", null, p.why || "—"));
      body.appendChild(tr);
    });
    els.driftNote.textContent = "· " + A.drift(state.positions).says;
  }

  /* ------------------------------------------------------------- export */

  function writer(name, text, mime) {
    if (!window.Export || typeof window.Export.save !== "function") throw new Error("the export kit did not load");
    window.Export.save(name, text, mime);
    return true;
  }

  function doExport(what, payload, noteEl) {
    var out = A.exportFile(what, payload, { when: state.when || today() }, writer);
    if (out.ok) {
      noteEl.textContent = "Wrote " + out.filename + " (" + out.bytes + " bytes).";
      setStatus("ok", "Wrote " + out.filename + ".");
    } else {
      setStatus("bad", out.reason + ".");
    }
  }

  /* ---------------------------------------------------------------- tabs */

  ["rehearsal", "steelman"].forEach(function (name) {
    $("tab-" + name).addEventListener("click", function () {
      ["rehearsal", "steelman"].forEach(function (other) {
        var on = other === name;
        $("tab-" + other).setAttribute("aria-selected", on ? "true" : "false");
        $("panel-" + other).hidden = !on;
      });
    });
  });

  /* ---------------------------------------------------------------- wire */

  els.start.addEventListener("click", start);
  els.send.addEventListener("click", send);
  els.endSession.addEventListener("click", endSession);
  els.exportSession.addEventListener("click", function () {
    if (!state.session || !state.card) { setStatus("bad", "There is no scored session to export yet."); return; }
    doExport("session", { session: state.session, card: state.card }, els.roomNote);
  });
  els.buildCase.addEventListener("click", buildCase);
  els.record.addEventListener("click", record);
  els.exportPositions.addEventListener("click", function () {
    if (!state.positions.length) { setStatus("bad", "No positions recorded yet."); return; }
    doExport("positions", { positions: state.positions }, els.posNote);
  });
  els.before.addEventListener("input", function () { els.beforeVal.textContent = els.before.value; });
  els.after.addEventListener("input", function () { els.afterVal.textContent = els.after.value; });
  function prefillCounterpart() {
    var pack = A.packById(els.scenario.value);
    if (pack) {
      els.counterpart.value = pack.counterpart;
      els.counterpart.placeholder = "e.g. " + pack.counterpart;
    }
  }
  els.scenario.addEventListener("change", prefillCounterpart);

  /* ------------------------------------------------------------ start up */

  fillScenarios();
  prefillCounterpart();
  var raw = null;
  try { raw = window.localStorage.getItem(K_STATE); } catch (e) { raw = null; }
  if (raw) {
    var parsed = A.parseState(raw);
    if (parsed.ok) {
      state.sessions = parsed.state.sessions;
      state.positions = parsed.state.positions;
    } else {
      /* Reported, offered for export, never replaced with a blank session. */
      setStatus("bad", parsed.reason);
      var keep = node("button", "small", "Export the unreadable file");
      keep.addEventListener("click", function () {
        var out = A.exportFile("raw", parsed, { when: today() }, writer);
        setStatus(out.ok ? "ok" : "bad", out.ok ? "Wrote " + out.filename + "." : out.reason);
      });
      els.posNote.parentNode.insertBefore(keep, els.posNote);
      var fresh = node("button", "small", "Start again, deliberately");
      fresh.addEventListener("click", function () {
        try { window.localStorage.removeItem(K_STATE); } catch (e) { /* nothing to remove */ }
        state.sessions = [];
        state.positions = [];
        renderPositions();
        setStatus("ok", "Starting again, deliberately. The unreadable file is gone.");
      });
      els.posNote.parentNode.insertBefore(fresh, els.posNote);
    }
  }

  renderPositions();
  if (window.Loom && window.Loom.pwa) window.Loom.pwa.register("sw.js");
})();
