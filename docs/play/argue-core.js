/* argue-core — the engine behind Argue.
 * SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
 * (c) 2026 Dr Sohil Momin
 *
 * ONE JOB: practise being pushed back on. Both specs are that job seen from opposite
 * sides of the table:
 *
 *   rehearsal   you sit across from a counterparty who has a HIDDEN GOAL and a script.
 *               It asks its pack's questions, pushes back when the difficulty is up,
 *               and afterwards quotes what you actually said and names what you missed.
 *   steelman    the counterparty is your own position: the app builds the strongest
 *               honest case against it, records how confident you were before and after,
 *               and keeps a changelog of how your mind moved.
 *
 * Everything is a bundled pack and a rule. There is NO model, no key and no network:
 * the "adaptive counterparty" is a state machine with a hidden goal, and the app says so
 * rather than pretending a language model is in the room.
 *
 * Pure functions: no DOM, no network, no storage. The page does the wiring.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.ArgueCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var VERSION = "1.0.0";
  var DIFFICULTY = { 1: "moves on", 2: "probes", 3: "pushes back" };

  /* ------------------------------------------------------------- the packs
   * India-first, because the spec asks for it: campus placement and a rent
   * negotiation before anything imported.
   */
  var PACKS = [
    {
      id: "visa",
      name: "US student visa interview",
      counterpart: "a visa officer at the consulate counter",
      hiddenGoal: "to find out whether you intend to come back",
      questions: [
        "Which university, and why that one?",
        "Who is paying for your studies?",
        "What will you do when you finish?",
        "Why not study the same course in India?",
        "Have you travelled abroad before?"
      ],
      openings: [
        { id: "return", label: "the plan back home", keywords: ["return", "come back", "back home", "india", "family business", "job in india"] },
        { id: "funding-docs", label: "the funding documents", keywords: ["loan", "sanction", "bank", "sponsor", "funds", "documents", "i-20"] },
        { id: "ties", label: "your ties here", keywords: ["property", "family", "parents", "obligation", "dependent"] }
      ],
      strongest: "the answer that names a specific reason to come back, not a feeling"
    },
    {
      id: "placement",
      name: "Campus placement interview",
      counterpart: "a hiring manager with a fixed headcount",
      hiddenGoal: "to fill the role at the lowest CTC the band allows",
      questions: [
        "Walk me through your final-year project.",
        "Why this company, and not the one next door?",
        "Tell me about a time you failed.",
        "What are your salary expectations?",
        "Where do you see yourself in three years?"
      ],
      openings: [
        { id: "evidence", label: "a number you could have quoted", keywords: ["percent", "users", "days", "cost", "reduced", "increased", "latency", "marks"] },
        { id: "role-fit", label: "the part of the role you actually know", keywords: ["role", "jd", "responsibility", "team", "stack", "product"] },
        { id: "questions-back", label: "a question you could have asked back", keywords: ["could i ask", "what does", "how does the team"] }
      ],
      strongest: "the answer that puts a number on what you did, instead of describing it"
    },
    {
      id: "rent",
      name: "Rent negotiation",
      counterpart: "a landlord who wants the tenancy signed today",
      hiddenGoal: "to hold the rent at or above his floor",
      questions: [
        "The rent is twenty-two thousand a month.",
        "Why should I come down?",
        "How long will you stay?",
        "The last tenant paid this much.",
        "Shall I draw up the agreement today?"
      ],
      openings: [
        { id: "comparable", label: "a comparable flat's rent", keywords: ["next building", "same building", "comparable", "nearby", "similar flat", "market"] },
        { id: "commitment", label: "a longer commitment in exchange", keywords: ["two years", "eleven months", "long term", "advance", "deposit"] },
        { id: "condition", label: "a condition you noticed", keywords: ["leak", "paint", "water", "repair", "furniture", "meter"] }
      ],
      strongest: "the answer that trades something you have (time, certainty) for the rent"
    }
  ];

  var FILLERS = ["um", "uh", "like", "you know", "basically", "actually", "sort of", "kind of", "i mean", "right", "literally"];

  function packById(id) {
    for (var i = 0; i < PACKS.length; i++) if (PACKS[i].id === id) return PACKS[i];
    return null;
  }

  /* --------------------------------------------------------------- session */

  /* A rehearsal with no counterpart is refused: practising against nobody teaches
   * nothing, and a blank opponent would be the app pretending to be one. */
  function startSession(opts) {
    var pack = packById(opts && opts.scenarioId);
    if (!pack) return { ok: false, reason: "there is no scenario called \u201c" + (opts && opts.scenarioId) + "\u201d" };
    var difficulty = Number((opts && opts.difficulty) || 1);
    if (!DIFFICULTY[difficulty]) return { ok: false, reason: "difficulty is 1, 2 or 3 \u2014 not " + (opts && opts.difficulty) };
    /* only fall back to the pack's own description when no key was given at all: a
     * blank string is the person clearing the field, which is exactly what is refused */
    var raw = opts && opts.counterpart != null ? opts.counterpart : pack.counterpart;
    var counterpart = String(raw == null ? "" : raw).trim();
    if (!counterpart) {
      return { ok: false, field: "counterpart", reason: "a rehearsal with no stated counterpart is refused: practising against nobody teaches nothing" };
    }
    return {
      ok: true,
      session: {
        packId: pack.id,
        scenario: pack.name,
        counterpart: counterpart,
        hiddenGoal: pack.hiddenGoal,
        difficulty: difficulty,
        asked: 0,
        turns: [],
        pushedBack: 0,
        startedAt: (opts && opts.now) || 0
      },
      question: pack.questions[0],
      says: "You are across from " + counterpart + " at difficulty " + difficulty + " (" + DIFFICULTY[difficulty] + "). " +
        "Their goal is hidden from the room, not from you: " + pack.hiddenGoal + "."
    };
  }

  function words(s) {
    return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\u20b9]+/gu, " ").split(" ").filter(Boolean);
  }

  /* The turn. An empty answer is refused rather than scored, and at difficulty 2 and
   * above the counterparty PUSHES BACK on the previous answer instead of moving on. */
  function answer(session, text, now) {
    var pack = packById(session && session.packId);
    if (!pack) return { ok: false, reason: "this session has no scenario" };
    var said = String(text == null ? "" : text).trim();
    if (!said) {
      return { ok: false, refused: true, reason: "an empty turn is refused rather than scored \u2014 say something, even \u201cI do not know\u201d" };
    }

    var turns = session.turns.concat([{ who: "you", text: said, at: now || 0 }]);
    var next = {
      packId: session.packId, scenario: session.scenario, counterpart: session.counterpart,
      hiddenGoal: session.hiddenGoal, difficulty: session.difficulty,
      asked: session.asked, turns: turns, pushedBack: session.pushedBack, startedAt: session.startedAt
    };

    /* Pushback: the same question, tightened, quoting a word the person actually used. */
    var wantsPushback = session.difficulty >= 2 && session.turns.length > 0 &&
      (session.difficulty === 3 || session.asked % 2 === 0);
    if (wantsPushback) {
      var last = turns[turns.length - 1].text;
      var key = words(last).filter(function (w) { return w.length > 4; }).slice(0, 1)[0] || "";
      var push = {
        who: "them",
        text: "You said \u201c" + (key ? key : last.split(" ").slice(0, 4).join(" ")) + "\u201d \u2014 that is not an answer I can act on. " +
          "Say it again with something I can check: a number, a name, or a document.",
        kind: "pushback",
        at: now || 0
      };
      next.turns = turns.concat([push]);
      next.pushedBack = session.pushedBack + 1;
      return { ok: true, session: next, pushback: true, question: push.text, says: "They pushed back instead of moving on." };
    }

    var asked = Math.min(session.asked + 1, pack.questions.length);
    next.asked = asked;
    if (asked >= pack.questions.length) {
      next.turns = turns.concat([{ who: "them", text: "Thank you. That is all from me.", kind: "close", at: now || 0 }]);
      return { ok: true, session: next, pushback: false, done: true, question: null, says: "The counterparty is finished. End the session for the scorecard." };
    }
    var q = pack.questions[asked];
    next.turns = turns.concat([{ who: "them", text: q, kind: "question", at: now || 0 }]);
    return { ok: true, session: next, pushback: false, question: q, says: "Next question." };
  }

  /* ------------------------------------------------------------ the scorecard
   * Everything here is counted from the transcript. No grade is invented: it quotes a
   * sentence the person actually said, names one opening the pack knows about that they
   * did not take, and rewrites the weakest answer with the filler taken out.
   */
  function fillerCount(text) {
    var low = " " + String(text || "").toLowerCase() + " ";
    var n = 0;
    var hits = [];
    FILLERS.forEach(function (f) {
      var re = new RegExp("\\b" + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "g");
      var m = low.match(re);
      if (m) { n += m.length; hits.push(f + " \u00d7" + m.length); }
    });
    return { count: n, hits: hits };
  }

  function userTurns(session) {
    return (session.turns || []).filter(function (t) { return t.who === "you"; });
  }

  /* The sentence to quote: the longest thing they said, because that is the one with
   * the most of them in it. */
  function quoteTurn(session) {
    var turns = userTurns(session);
    if (!turns.length) return null;
    return turns.slice().sort(function (a, b) { return b.text.length - a.text.length; })[0];
  }

  function scorecard(session) {
    var pack = packById(session && session.packId);
    if (!pack) return { ok: false, reason: "this session has no scenario" };
    var turns = userTurns(session);
    if (!turns.length) {
      return { ok: false, reason: "there is nothing to score: no answer was given, and an empty turn is not scored" };
    }
    var quoted = quoteTurn(session);
    var said = turns.map(function (t) { return t.text; }).join(" ").toLowerCase();

    var taken = [];
    var missed = [];
    pack.openings.forEach(function (o) {
      var hit = o.keywords.some(function (k) { return said.indexOf(k) >= 0; });
      if (hit) taken.push(o); else missed.push(o);
    });

    var fillers = fillerCount(turns.map(function (t) { return t.text; }).join(" "));
    var weakest = turns.slice().sort(function (a, b) { return a.text.length - b.text.length; })[0];
    var stronger = rewrite(weakest.text);

    return {
      ok: true,
      scenario: pack.name,
      counterpart: session.counterpart,
      difficulty: session.difficulty,
      answers: turns.length,
      pushbacks: session.pushedBack,
      quote: quoted.text,
      says: "You said \u201c" + quoted.text + "\u201d \u2014 that is the sentence this session turned on.",
      took: taken.map(function (o) { return o.label; }),
      missed: missed.map(function (o) { return o.label; }),
      missedOpening: missed.length ? missed[0].label : "",
      missedSays: missed.length
        ? "One opening you did not take: " + missed[0].label + ". " + pack.strongest + "."
        : "You took every opening this pack knows about. " + pack.strongest + ".",
      fillers: fillers,
      weakest: weakest.text,
      stronger: stronger,
      strongerSays: "A stronger phrasing of your shortest answer: \u201c" + stronger + "\u201d"
    };
  }

  /* Take the filler out and put the sentence in order. Deliberately mechanical: this is
   * a rewrite rule, not a model, and it says so. */
  function rewrite(text) {
    var s = String(text || "").trim().replace(/\s+/g, " ");
    FILLERS.forEach(function (f) {
      s = s.replace(new RegExp("(^|\\s)" + f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b\\s*,?", "gi"), "$1");
    });
    s = s.replace(/\s+/g, " ").replace(/\s+([,.;!?])/g, "$1").replace(/^[,.;\s]+/, "").trim();
    if (s && !/[.!?]$/.test(s)) s += ".";
    if (s) s = s.charAt(0).toUpperCase() + s.slice(1);
    return s || "(nothing left once the filler was removed \u2014 say the thing itself)";
  }

  /* -------------------------------------------------------------- steelman */

  /* The case against a claim, from a bundled bank. Each entry is the reasoning a
   * thoughtful opponent would give, not a slogan. */
  var ARGUMENT_BANK = [
    {
      id: "base-rate",
      when: ["always", "never", "everyone", "nobody", "all", "none"],
      move: "the base rate",
      case: "The strongest objection is about frequency: how often has this actually happened, to people like the ones involved? If the answer is \u201crarely\u201d, then a single vivid case is doing the work of an argument, and vivid cases are cheap."
    },
    {
      id: "cost",
      when: ["should", "must", "ought", "need to", "have to"],
      move: "the cost you are not counting",
      case: "A thoughtful opponent would ask what this costs the people who are not in the room: the money, the time, the option given up. A decision that looks free is usually paid for by someone whose preference was not asked for."
    },
    {
      id: "selection",
      when: ["because", "proves", "shows", "evidence", "data"],
      move: "how the evidence was selected",
      case: "The evidence you are citing was produced by someone who chose what to measure. Ask what was left out: the failed cases, the people who stopped, the period that was excluded. Selection is the most common way a true number supports a false conclusion."
    },
    {
      id: "incentive",
      when: ["they", "company", "government", "market", "management", "landlord", "recruiter"],
      move: "whose incentive this serves",
      case: "Who benefits if you believe this? Not as a conspiracy \u2014 as an incentive. The person or institution making the claim is usually paid, promoted or protected by it, and that does not make them wrong; it makes their confidence worth less than their evidence."
    },
    {
      id: "reversibility",
      when: ["decide", "decision", "now", "immediately", "commit"],
      move: "whether it can be undone",
      case: "Ask whether this is reversible. If it can be undone cheaply, the case for waiting is weak and you should decide. If it cannot, the burden is on the decision, not on the doubt \u2014 and \u201cwe have come this far\u201d is not a reason, it is a sunk cost wearing a reason's clothes."
    },
    {
      id: "counterfactual",
      when: ["better", "worse", "best", "worst", "than"],
      move: "the comparison you did not make",
      case: "Better than what, exactly? The comparison in the claim is usually against the wrong alternative \u2014 the status quo, or nothing at all. The honest comparison is against the second-best thing you could do with the same money and the same weeks."
    },
    {
      id: "definition",
      when: ["is", "means", "counts", "success", "fair", "honest"],
      move: "the definition doing the work",
      case: "The claim rests on a word that has been defined conveniently. Try the definition that would make the claim false, and see whether the argument still runs. If it only works with one definition, the definition is the argument."
    }
  ];

  function steelman(opts) {
    var claim = String((opts && opts.claim) || "").trim();
    if (!claim) {
      return { ok: false, field: "claim", reason: "a position with no stated claim is refused: there is nothing to steelman" };
    }
    var low = claim.toLowerCase();
    var picked = ARGUMENT_BANK.filter(function (a) {
      return a.when.some(function (w) { return low.indexOf(w) >= 0; });
    });
    if (picked.length < 2) {
      /* no signal in the wording: use the three that apply to any claim */
      picked = ARGUMENT_BANK.filter(function (a) { return ["cost", "selection", "counterfactual"].indexOf(a.id) >= 0; });
    }
    picked = picked.slice(0, 3);

    var restated = isRestatement(claim, picked);
    return {
      ok: true,
      claim: claim,
      moves: picked.map(function (a) { return { id: a.id, move: a.move, case: a.case }; }),
      restatement: restated,
      says: restated
        ? "This case repeats your own position back to you, so it is flagged as a restatement rather than a counter-case. Say the claim more narrowly and try again."
        : "Three lines of attack, each the reasoning a thoughtful opponent would actually give. None of them says you are wrong; they say what would have to be true for you to be."
    };
  }

  /* A counter-case that shares almost all of its content with the claim is a
   * restatement, and the app says so rather than counting it as opposition. */
  function isRestatement(claim, moves) {
    var cw = words(claim);
    if (cw.length < 3) return false;
    var caseWords = {};
    moves.forEach(function (m) { words(m.case).forEach(function (w) { caseWords[w] = 1; }); });
    var shared = cw.filter(function (w) { return caseWords[w] && w.length > 3; });
    return shared.length / Math.max(1, cw.filter(function (w) { return w.length > 3; }).length) > 0.6;
  }

  /* --------------------------------------------------------- the changelog */

  /* Confidence before, confidence after, and whether the position moved. That record is
   * the whole point of Steelman: it remembers how your mind changed, not just what you
   * currently think. */
  function recordPosition(entries, entry) {
    var claim = String((entry && entry.claim) || "").trim();
    if (!claim) return { ok: false, field: "claim", reason: "a position with no stated claim cannot be recorded" };
    var before = Number(entry.before);
    var after = Number(entry.after);
    if (isNaN(before) || isNaN(after)) return { ok: false, field: "confidence", reason: "confidence has to be a number before and after" };
    if (before < 0 || before > 100 || after < 0 || after > 100) return { ok: false, field: "confidence", reason: "confidence runs from 0 to 100" };
    var row = {
      id: "p" + ((entries || []).length + 1) + "-" + (entry.at || 0),
      claim: claim,
      before: before,
      after: after,
      moved: after - before,
      why: String(entry.why || "").trim(),
      at: entry.at || 0
    };
    return {
      ok: true,
      entry: row,
      says: row.moved === 0
        ? "Recorded: your confidence did not move. That is a result too \u2014 it means the case did not reach you, or you already held it."
        : "Recorded: confidence " + (row.moved > 0 ? "rose" : "fell") + " by " + Math.abs(row.moved) + " points" +
          (row.why ? " because \u201c" + row.why + "\u201d" : " (no reason given)") + "."
    };
  }

  function drift(entries) {
    var rows = (entries || []).slice().sort(function (a, b) { return a.at - b.at; });
    var moved = rows.filter(function (r) { return r.moved !== 0; });
    return {
      total: rows.length,
      moved: moved.length,
      fell: moved.filter(function (r) { return r.moved < 0; }).length,
      rose: moved.filter(function (r) { return r.moved > 0; }).length,
      net: rows.reduce(function (s, r) { return s + r.moved; }, 0),
      says: rows.length
        ? rows.length + " position(s) recorded; confidence moved on " + moved.length +
          " of them (" + moved.filter(function (r) { return r.moved < 0; }).length + " down, " +
          moved.filter(function (r) { return r.moved > 0; }).length + " up)."
        : "No positions recorded yet."
    };
  }

  /* --------------------------------------------------------------- storage */

  function serializeState(state) {
    return JSON.stringify({
      version: VERSION,
      savedOn: (state && state.savedOn) || 0,
      sessions: ((state && state.sessions) || []).map(function (s) {
        return {
          packId: s.packId, scenario: s.scenario, counterpart: s.counterpart, difficulty: s.difficulty,
          asked: s.asked, pushedBack: s.pushedBack, startedAt: s.startedAt,
          turns: (s.turns || []).map(function (t) { return { who: t.who, text: t.text, kind: t.kind || "", at: t.at || 0 }; })
        };
      }),
      positions: ((state && state.positions) || []).slice()
    }, null, 2);
  }

  /* An unreadable session file is REPORTED. The app never opens a blank session in its
   * place, which would look like a lost rehearsal. */
  function parseState(text) {
    var raw = String(text == null ? "" : text);
    if (!raw.trim()) return { ok: false, reason: "there is nothing saved yet", raw: raw };
    var data;
    try { data = JSON.parse(raw); }
    catch (e) {
      return { ok: false, reason: "the saved rehearsals are not readable JSON. They were not replaced with a blank session \u2014 export them to keep them, or start again deliberately.", raw: raw };
    }
    if (!data || (!Array.isArray(data.sessions) && !Array.isArray(data.positions))) {
      return { ok: false, reason: "the saved file has no sessions and no positions in it, so it was not used \u2014 and it was not replaced with a blank one.", raw: raw };
    }
    return {
      ok: true,
      state: {
        version: data.version || VERSION,
        savedOn: Number(data.savedOn) || 0,
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        positions: Array.isArray(data.positions) ? data.positions : []
      },
      raw: raw
    };
  }

  /* ---------------------------------------------------------------- export */

  function stamp(when) {
    var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(when || ""));
    return m ? m[3] + "-" + m[2] + "-" + m[1] : "undated";
  }

  function sessionMarkdown(session, card, when) {
    var lines = ["# Rehearsal \u2014 " + session.scenario, ""];
    if (when) lines.push("Practised " + when + ", against " + session.counterpart + " at difficulty " + session.difficulty + ".");
    lines.push("");
    lines.push("**Their hidden goal:** " + session.hiddenGoal);
    lines.push("");
    lines.push("## The transcript");
    lines.push("");
    (session.turns || []).forEach(function (t) {
      lines.push("**" + (t.who === "you" ? "You" : "Them") + ":** " + t.text);
      lines.push("");
    });
    if (card && card.ok) {
      lines.push("## Scorecard");
      lines.push("");
      lines.push("- Answers: " + card.answers + " \u00b7 pushbacks: " + card.pushbacks);
      lines.push("- The sentence it turned on: \u201c" + card.quote + "\u201d");
      lines.push("- " + card.missedSays);
      lines.push("- Filler words: " + card.fillers.count + (card.fillers.hits.length ? " (" + card.fillers.hits.join(", ") + ")" : ""));
      lines.push("- " + card.strongerSays);
      lines.push("");
      lines.push("Every line above is counted from the transcript. No model wrote any of it.");
    }
    return lines.join("\n");
  }

  function positionsMarkdown(positions, when) {
    var lines = ["# Positions and how they moved", ""];
    if (when) lines.push("Exported " + when + ".");
    lines.push("");
    if (!(positions || []).length) lines.push("No positions recorded yet.");
    lines.push("| Claim | Before | After | Moved | Why |");
    lines.push("|---|---|---|---|---|");
    (positions || []).forEach(function (p) {
      lines.push("| " + p.claim.replace(/\|/g, "\\|") + " | " + p.before + " | " + p.after + " | " + (p.moved > 0 ? "+" : "") + p.moved + " | " + String(p.why || "\u2014").replace(/\|/g, "\\|") + " |");
    });
    return lines.join("\n");
  }

  function exportFile(what, payload, meta, writer) {
    meta = meta || {};
    if (typeof writer !== "function") return { ok: false, reason: "the file was not written: no writer is available in this browser" };
    var name, body, mime = "text/plain;charset=utf-8";
    if (what === "session") { name = "rehearsal-" + stamp(meta.when) + ".md"; body = sessionMarkdown(payload.session, payload.card, meta.when); mime = "text/markdown;charset=utf-8"; }
    else if (what === "positions") { name = "positions-" + stamp(meta.when) + ".md"; body = positionsMarkdown(payload.positions, meta.when); mime = "text/markdown;charset=utf-8"; }
    else if (what === "raw") { name = "argue-unreadable-" + stamp(meta.when) + ".txt"; body = String(payload.raw || ""); }
    else return { ok: false, reason: "nothing was written: unknown export \u201c" + what + "\u201d" };
    try {
      var wrote = writer(name, body, mime);
      if (wrote === false) return { ok: false, filename: name, reason: "the file was not written: the browser refused the save" };
      return { ok: true, filename: name, bytes: body.length };
    } catch (e) {
      var why = e && e.name === "QuotaExceededError" ? "storage is full" : (e && e.message ? e.message : "storage is unavailable");
      return { ok: false, filename: name, reason: "the file was not written: " + why };
    }
  }

  return {
    version: VERSION,
    PACKS: PACKS,
    ARGUMENT_BANK: ARGUMENT_BANK,
    FILLERS: FILLERS,
    DIFFICULTY: DIFFICULTY,
    packById: packById,
    startSession: startSession,
    answer: answer,
    scorecard: scorecard,
    fillerCount: fillerCount,
    rewrite: rewrite,
    steelman: steelman,
    isRestatement: isRestatement,
    recordPosition: recordPosition,
    drift: drift,
    serializeState: serializeState,
    parseState: parseState,
    sessionMarkdown: sessionMarkdown,
    positionsMarkdown: positionsMarkdown,
    exportFile: exportFile
  };
});
