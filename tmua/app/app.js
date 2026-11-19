/* TMUA Study Desk. Runs as a claude.ai artifact (data in the artifact's db,
   synced across devices) or locally via tools/serve.py (data in localStorage).
   No official question text lives here: only answer letters, own tags and
   original generated questions. */
"use strict";

const EXAM = new Date(2027, 0, 8);
const RESERVED = ["2021", "2022", "2023"];           // saved for timed mocks in late December
const PAPERS = ["specimen", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023"]
  .flatMap(y => [`${y}-P1`, `${y}-P2`]);
const PAPER_SEC = 75 * 60;
const PRACTICE_SEC_PER_Q = 210;                       // 3.5 minutes
const SLOW_SEC = 270;                                 // 4.5 minutes on one question counts as slow
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const REASONS = [
  ["topic", "Didn't know topic"],
  ["slip", "Algebra slip"],
  ["trick", "Didn't see trick"],
  ["time", "Ran out of time"],
  ["misread", "Misread"],
];
const REASON_NAME = Object.fromEntries(REASONS);
const WHY_NAME = { wrong: "Wrong", blank: "Blank", guessed: "Guessed", slow: "Slow" };

const S = {
  keys: {}, tags: {}, topics: {}, links: {}, bank: [], bankById: {},
  attempts: {}, errors: {}, mode: "loading", db: null, downloads: null, localPdfs: false,
  ui: { statSrc: "official", errFilter: "due", pTopics: null, pCount: 5, openSol: {} },
  armed: null, loadNote: "",
};

/* ---------- utilities ---------- */
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const addDays = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return isoDate(new Date(y, m - 1, d + n)); };
const fmtDay = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" }); };
const fmtClock = sec => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`; };
const fmtMin = sec => `${Math.round(sec / 6) / 10} min`;
const uid = p => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const clone = o => JSON.parse(JSON.stringify(o));
const paperName = id => { const [y, p] = id.split("-P"); return `${y === "specimen" ? "Specimen" : y} · Paper ${p}`; };
const paperShort = id => { const [y, p] = id.split("-P"); return `${y === "specimen" ? "Sp" : y.slice(2)}P${p}`; };
const isReserved = id => RESERVED.includes(id.split("-")[0]);
const topicName = code => S.topics[code]?.name || code;
const topicShort = code => (S.topics[code]?.name || code).replace(/^Paper [12]: /, "");
const daysLeft = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((EXAM - t) / 864e5); };
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2400); }
function lsGet(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }
function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } }

/* ---------- storage: artifact db when available, else localStorage ---------- */
const LS_KEY = "tmua.v1";
const Store = {
  async init() {
    let db = null, dl = null;
    if (window.claude && typeof window.claude.use === "function") {
      const timeout = new Promise(r => setTimeout(() => r(null), 10000));
      try { db = await Promise.race([window.claude.use("db"), timeout]); } catch { db = null; }
      try { dl = await Promise.race([window.claude.use("downloads"), new Promise(r => setTimeout(() => r(null), 3000))]); } catch { dl = null; }
    }
    S.downloads = dl;
    if (db) { S.db = db; S.mode = "cloud"; this.subscribe(); }
    else {
      S.mode = "local";
      const saved = lsGet(LS_KEY, { attempts: {}, errors: {} });
      S.attempts = saved.attempts || {}; S.errors = saved.errors || {};
      render();
    }
  },
  subscribe() {
    const got = { attempts: false, errors: false };
    const timer = setTimeout(() => { if (!got.attempts || !got.errors) { S.loadNote = "Can't reach your saved data yet. It will appear when the connection returns."; render(); } }, 10000);
    for (const coll of ["attempts", "errors"]) {
      S.db.collection(coll).onSnapshot(snap => {
        S[coll] = Object.fromEntries(snap.docs.map(d => [d.id, clone(d.data())]));
        if (!snap.metadata.fromCache) got[coll] = true;
        if (got.attempts && got.errors) { clearTimeout(timer); S.loadNote = ""; }
        render();
      }, err => { clearTimeout(timer); S.loadNote = `Saved data is unavailable (${err.code}).`; render(); });
    }
  },
  async put(coll, id, obj) {
    S[coll][id] = obj;
    if (S.mode === "cloud") {
      try { await S.db.doc(`${coll}/${id}`).set(obj); }
      catch (e) {
        if (e && e.code === "unavailable") { await new Promise(r => setTimeout(r, 600 + Math.random() * 600)); await S.db.doc(`${coll}/${id}`).set(obj); }
        else { toast(`Couldn't save (${e && e.code || "error"}). Export a backup.`); throw e; }
      }
    } else lsSet(LS_KEY, { attempts: S.attempts, errors: S.errors });
  },
  async del(coll, id) {
    delete S[coll][id];
    if (S.mode === "cloud") await S.db.doc(`${coll}/${id}`).delete();
    else lsSet(LS_KEY, { attempts: S.attempts, errors: S.errors });
  },
};

/* ---------- derived data ---------- */
const attemptsList = () => Object.values(S.attempts).sort((a, b) => a.started - b.started);
const paperAttempts = id => attemptsList().filter(a => a.kind === "paper" && a.paper === id);
function paperStatus(id) {
  const as = paperAttempts(id);
  if (as.some(a => a.mode === "timed")) return "timed";
  if (as.length) return "untimed";
  return "none";
}
const STATUS_LABEL = { none: "Not started", untimed: "Done untimed", timed: "Done timed" };
function questionTopic(a, i) {
  if (a.kind === "paper") return S.tags[a.paper]?.[i]?.topic;
  return S.bankById[a.qids[i]]?.topic;
}
function topicStats(src) {
  const acc = {};
  for (const a of attemptsList()) {
    if (a.mode === "status" || !a.answers) continue;
    if ((src === "official") !== (a.kind === "paper")) continue;
    a.answers.forEach((ans, i) => {
      const t = questionTopic(a, i); if (!t) return;
      const ok = ans && ans === correctAnswer(a, i);
      (acc[t] ||= { code: t, n: 0, ok: 0 }); acc[t].n++; if (ok) acc[t].ok++;
    });
  }
  return Object.values(acc).map(x => ({ ...x, pct: x.ok / x.n })).sort((a, b) => a.pct - b.pct || b.n - a.n);
}
function correctAnswer(a, i) {
  if (a.kind === "paper") return S.keys[a.paper]?.[i];
  return S.bankById[a.qids[i]]?.answer;
}
function weakestTopics(k = 3) {
  return topicStats("official").filter(t => t.n >= 3).slice(0, k).map(t => t.code);
}
function nextDue(e) { const r = (e.redo || []).find(r => !r.done); return r ? r.due : null; }
const dueErrors = () => Object.values(S.errors).filter(e => { const d = nextDue(e); return d && d <= today(); }).sort((a, b) => nextDue(a).localeCompare(nextDue(b)));
const needsReason = () => Object.values(S.errors).filter(e => !e.reason);

function pdfLinks(id) {
  const l = S.links[id]; if (!l) return { paper: "#", worked: "#" };
  return S.localPdfs ? { paper: `papers/${l.paper}`, worked: `papers/${l.worked}` } : { paper: l.paper_url, worked: l.worked_url };
}

/* ---------- sessions (timed paper, untimed entry, practice) ---------- */
let session = lsGet("tmua.session", null);
const saveSession = () => lsSet("tmua.session", session);
function startSession(opts) {
  const n = opts.kind === "paper" ? 20 : opts.qids.length;
  session = {
    kind: opts.kind, paper: opts.paper || null, qids: opts.qids || null, mode: opts.mode,
    started: Date.now(), limitSec: opts.mode === "timed" ? (opts.kind === "paper" ? PAPER_SEC : n * PRACTICE_SEC_PER_Q) : null,
    answers: Array(n).fill(null), flags: Array(n).fill(false), times: Array(n).fill(0), cur: 0, curSince: Date.now(),
  };
  saveSession(); location.hash = "#session";
}
function commitTime() {
  if (!session) return;
  const now = Date.now();
  session.times[session.cur] += (now - session.curSince) / 1000;
  session.curSince = now;
}
function setCur(i) { if (!session || i === session.cur) return; commitTime(); session.cur = i; saveSession(); }
function elapsed() { return (Date.now() - session.started) / 1000; }
function remaining() { return session.limitSec - elapsed(); }

async function finishSession() {
  if (!session) return;
  commitTime();
  const s = session; session = null; saveSession();
  const used = Math.min(s.limitSec || Infinity, (Date.now() - s.started) / 1000);
  const a = {
    id: uid("a"), kind: s.kind, paper: s.paper, qids: s.qids, mode: s.mode, date: today(), started: s.started,
    usedSec: Math.round(used), limitSec: s.limitSec, answers: s.answers, flags: s.flags,
    times: s.mode === "timed" ? s.times.map(t => Math.round(t)) : null,
  };
  a.total = a.answers.length;
  a.score = a.answers.filter((x, i) => x && x === correctAnswer(a, i)).length;
  await Store.put("attempts", a.id, a);
  for (let i = 0; i < a.total; i++) {
    const why = [];
    const key = correctAnswer(a, i);
    if (!a.answers[i]) why.push("blank"); else if (a.answers[i] !== key) why.push("wrong");
    if (a.flags[i]) why.push("guessed");
    if (a.times && a.times[i] > SLOW_SEC) why.push("slow");
    if (!why.length) continue;
    const e = {
      id: `e-${a.id}-${i + 1}`, src: a.kind === "paper" ? "official" : "generated", attempt: a.id,
      paper: a.paper, gid: a.qids ? a.qids[i] : null, q: i + 1, topic: questionTopic(a, i) || null,
      why, yours: a.answers[i], correct: key, sec: a.times ? a.times[i] : null, reason: why.includes("slow") && why.length === 1 ? "time" : null,
      created: a.date, redo: [{ due: addDays(a.date, 3), done: null, result: null }, { due: addDays(a.date, 10), done: null, result: null }],
    };
    await Store.put("errors", e.id, e);
  }
  location.hash = `#attempt-${a.id}`;
}
async function markDoneUntimed(id) {
  const a = { id: uid("a"), kind: "paper", paper: id, mode: "status", date: today(), started: Date.now(), answers: null, total: 20, score: null };
  await Store.put("attempts", a.id, a);
  toast(`${paperName(id)} marked done untimed`);
}

/* ---------- views ---------- */
function route() { return (location.hash || "#today").slice(1); }

function render() {
  const r = route();
  const top = r.startsWith("attempt-") ? "papers" : r === "session" ? (session?.kind === "practice" ? "practice" : "papers") : r;
  document.querySelectorAll("#tabs a").forEach(a => {
    if (a.getAttribute("href") === `#${top}`) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  const due = dueErrors().length;
  const errTab = document.querySelector('#tabs a[href="#errors"]');
  errTab.innerHTML = `Errors${due ? `<span class="dot">${due}</span>` : ""}`;
  const d = daysLeft();
  $("#days").innerHTML = d >= 0 ? `<b>${d}</b> days to the TMUA` : "TMUA done";
  if (S.mode === "loading") return;
  let html;
  if (r === "session" && session) html = viewSession();
  else if (r === "session") { location.hash = "#today"; return; }
  else if (r.startsWith("attempt-")) html = viewAttempt(r.slice(8));
  else html = ({ today: viewToday, papers: viewPapers, practice: viewPractice, errors: viewErrors, progress: viewProgress }[r] || viewToday)();
  $("#main").innerHTML = (S.loadNote ? `<div class="notice">${esc(S.loadNote)}</div>` : "") + html;
  typeset($("#main"));
}
function typeset(el) {
  if (window.renderMathInElement) {
    try { window.renderMathInElement(el, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false }); } catch { /* leave raw TeX */ }
  }
}

function storageNote() {
  return S.mode === "cloud"
    ? `<span class="pill good">✓ Synced on claude.ai</span>`
    : `<span class="pill warn">Saved in this browser only · export to back up</span>`;
}

function viewToday() {
  const due = dueErrors();
  const reasonless = needsReason().length;
  const official = attemptsList().filter(a => a.kind === "paper");
  const next = PAPERS.find(id => !isReserved(id) && paperStatus(id) !== "timed");
  const weak = weakestTopics();
  const bankWeak = S.bank.filter(q => weak.includes(q.topic)).length;
  const reservedLeft = PAPERS.filter(id => isReserved(id) && paperStatus(id) === "none").length;
  let out = `<section class="card hero">
      <div><div class="big num">${Math.max(0, daysLeft())}</div><div class="muted small">days to 8 January 2027</div></div>
      <div class="stack small" style="flex:1;min-width:200px">
        <div>${due.length ? `<b>${due.length}</b> question${due.length > 1 ? "s" : ""} due for redo today` : "No redos due today"}</div>
        <div>${reservedLeft} of 6 mock papers (2021–2023) still unopened</div>
        <div>${storageNote()}</div>
      </div></section>`;
  if (!official.length) {
    out += `<section class="card stack"><h2>Start by recording 2016–2020</h2>
      <p class="small" style="margin:0">You've done these untimed. Tap in your answers from those attempts (about 2 minutes per paper) so your topic stats start from real data. If you no longer have your answers, mark them done instead.</p>
      <div class="row"><a class="btn primary" href="#papers">Go to papers</a></div></section>`;
  }
  out += `<section class="card stack"><div class="spread"><h2>Due for redo today</h2><a href="#errors" class="small">Error log</a></div>`;
  out += due.length ? due.slice(0, 8).map(errorItem).join("") : `<p class="muted small" style="margin:0">Nothing due. New entries appear 3 and 10 days after a mistake.</p>`;
  if (due.length > 8) out += `<a class="small" href="#errors">${due.length - 8} more</a>`;
  out += `</section>`;
  if (reasonless) out += `<div class="notice">${reasonless} error-log ${reasonless > 1 ? "entries need" : "entry needs"} a reason. <a href="#errors" data-act="efilter" data-v="reason">Pick reasons</a></div>`;
  out += `<section class="grid2">`;
  if (next) {
    const st = paperStatus(next);
    out += `<div class="card stack"><div class="label">Next timed paper</div><div class="spread"><h3>${paperName(next)}</h3><span class="pill ${st}">${STATUS_LABEL[st]}</span></div>
      <p class="small muted" style="margin:0">${st === "untimed" ? "A timed redo trains speed: aim to beat 75 minutes with fewer flags." : "75 minutes, 20 questions."}</p>
      <div class="row"><button class="btn primary" data-act="start" data-paper="${next}" data-mode="timed">Start 75:00</button></div></div>`;
  }
  out += `<div class="card stack"><div class="label">Practice</div><h3>${weak.length ? `Weakest: ${weak.map(topicShort).map(esc).join(", ")}` : "Generated questions"}</h3>
    <p class="small muted" style="margin:0">${S.bank.length ? `${S.bank.length} questions in the bank${weak.length ? `, ${bankWeak} on these topics` : ""}.` : "The bank is empty. Ask Claude: “generate 10 questions on my 3 weakest topics”."}</p>
    <div class="row"><a class="btn" href="#practice">Open practice</a></div></div>`;
  out += `</section>`;
  return out;
}

function viewPapers() {
  const group = (title, ids, note) => `<section class="stack"><div class="spread"><h2>${title}</h2><span class="small muted">${note}</span></div><div class="papers">${ids.map(paperCard).join("")}</div></section>`;
  const practice = PAPERS.filter(id => !isReserved(id));
  const reserve = PAPERS.filter(isReserved);
  return group("Past papers", practice, `${practice.filter(id => paperStatus(id) !== "none").length}/${practice.length} done`) +
    group("Mock reserve", reserve, "Saved for timed mocks in late December") +
    `<p class="small muted">PDFs ${S.localPdfs ? "open from your local papers folder" : "open on the official ESAT/TMUA site"}.</p>`;
}
function paperCard(id) {
  const st = paperStatus(id), as = paperAttempts(id).filter(a => a.mode !== "status");
  const links = pdfLinks(id), res = isReserved(id);
  const hist = as.slice(-3).map(a => `<a href="#attempt-${a.id}">${a.score}/20${a.mode === "timed" ? ` · ${Math.round(a.usedSec / 60)}m` : ""}</a>`).join(" · ");
  const armed = S.armed === `start-${id}`;
  return `<article class="card paper">
    <div class="spread"><div class="t">${paperName(id)}</div><span class="pill ${st}">${STATUS_LABEL[st]}</span></div>
    ${res && st === "none" ? `<span class="pill reserve" style="align-self:flex-start">Mock reserve</span>` : ""}
    ${hist ? `<div class="hist">Recent: ${hist}</div>` : ""}
    <div class="row small"><a href="${esc(links.paper)}" target="_blank" rel="noopener">Paper ↗</a><a href="${esc(links.worked)}" target="_blank" rel="noopener">Worked answers ↗</a></div>
    <div class="actions">
      <button class="btn primary" data-act="start" data-paper="${id}" data-mode="timed">${res && st === "none" ? (armed ? "Tap again to start mock" : "Start mock") : "Timed"}</button>
      <button class="btn" data-act="start" data-paper="${id}" data-mode="untimed">Enter answers</button>
      ${st === "none" ? `<button class="btn ghost" data-act="markdone" data-paper="${id}">Mark done</button>` : ""}
    </div></article>`;
}

function viewSession() {
  const s = session, isPaper = s.kind === "paper";
  const timed = s.mode === "timed";
  const head = `<div class="sessbar">
      <div><div class="clock ${timed && remaining() < 600 ? "low" : ""}" id="clock">${timed ? fmtClock(remaining()) : fmtClock(elapsed())}</div>
      <div class="pace" id="pace">${paceText()}</div></div>
      <div class="row" style="margin-left:auto">
        <button class="btn" data-act="abandon">${S.armed === "abandon" ? "Tap again to discard" : "Discard"}</button>
        <button class="btn primary" data-act="finish">${S.armed === "finish" ? "Tap again to mark" : "Finish & mark"}</button>
      </div></div>`;
  if (isPaper) {
    const links = pdfLinks(s.paper);
    const rows = s.answers.map((ans, i) => `<div class="qrow ${i === s.cur ? "cur" : ""}">
        <button class="qn" data-act="cur" data-q="${i}" aria-label="Question ${i + 1}">${i + 1}</button>
        <div class="lozenges">${LETTERS.map(L => `<button class="loz ${ans === L ? "on" : ""}" data-act="pick" data-q="${i}" data-l="${L}" aria-label="Q${i + 1} ${L}">${L}</button>`).join("")}</div>
        <button class="flag ${s.flags[i] ? "on" : ""}" data-act="flag" data-q="${i}" aria-label="Flag question ${i + 1} as guessed or skipped" title="Guessed / skipped">⚑</button>
        <div class="qt" id="qt${i}">${timed && s.times[i] > 0 ? fmtClock(s.times[i]) : ""}</div>
      </div>`).join("");
    return `<div class="spread"><h2>${paperName(s.paper)} · ${timed ? "timed" : "entering answers"}</h2>
        <div class="row small"><a href="${esc(links.paper)}" target="_blank" rel="noopener">Open paper ↗</a></div></div>
      ${head}
      <p class="small muted" style="margin:0">${timed ? "Tap a question number when you move on to it: the clock charges time to the highlighted question. ⚑ marks a guess or skip." : "Tap the answer you gave for each question. ⚑ marks ones you guessed."}</p>
      <div class="sheet"><div class="sheet-head"><span>Question</span><span>Answer</span><span>Guess</span></div>${rows}</div>
      <div class="row"><button class="btn primary" data-act="finish">${S.armed === "finish" ? "Tap again to mark" : "Finish & mark"}</button></div>`;
  }
  const i = s.cur, q = S.bankById[s.qids[i]];
  const nav = s.qids.map((id, j) => `<button class="${s.answers[j] ? "ans" : ""} ${j === i ? "cur" : ""} ${s.flags[j] ? "fl" : ""}" data-act="pnav" data-q="${j}">${j + 1}</button>`).join("");
  const opts = q ? Object.entries(q.options).map(([L, txt]) => `<button class="opt ${s.answers[i] === L ? "on" : ""}" data-act="popt" data-l="${L}"><span class="l">${L}</span><span class="x">${esc(txt)}</span></button>`).join("") : "";
  return `<h2>Practice set · ${s.qids.length} questions</h2>${head}
    <div class="qnav">${nav}</div>
    <article class="card qcard stack">
      <div class="spread"><span class="label">Question ${i + 1} · ${esc(topicShort(q?.topic))}</span>
        <button class="flag ${s.flags[i] ? "on" : ""}" style="width:44px" data-act="flag" data-q="${i}" title="Guessed / skipped">⚑</button></div>
      <div class="stem">${q ? esc(q.stem) : "This question is no longer in the bank."}</div>
      <div class="opts">${opts}</div>
      <div class="row"><button class="btn" data-act="pnav" data-q="${Math.max(0, i - 1)}" ${i === 0 ? "disabled" : ""}>Previous</button>
        <button class="btn" data-act="pnav" data-q="${Math.min(s.qids.length - 1, i + 1)}" ${i === s.qids.length - 1 ? "disabled" : ""}>Next</button></div>
    </article>`;
}
function paceText() {
  if (!session) return "";
  const s = session, done = s.answers.filter(Boolean).length, n = s.answers.length;
  const cur = s.times[s.cur] + (Date.now() - s.curSince) / 1000;
  if (s.mode !== "timed") return `${done}/${n} entered`;
  const budget = s.limitSec / n;
  const target = Math.min(n, Math.floor(elapsed() / budget));
  const lag = target - done;
  return `Q${s.cur + 1}: ${fmtClock(cur)}${cur > SLOW_SEC ? " · move on?" : ""} · ${done}/${n} answered${lag > 1 ? ` · ${lag} behind pace` : ""}`;
}

function viewAttempt(id) {
  const a = S.attempts[id];
  if (!a) return `<div class="card empty">That attempt isn't here. It may still be loading.</div>`;
  if (a.mode === "status") return `<div class="card empty">Marked done untimed on ${fmtDay(a.date)} (no answers recorded).</div>`;
  const title = a.kind === "paper" ? paperName(a.paper) : `Practice set · ${a.total} questions`;
  const errs = Object.values(S.errors).filter(e => e.attempt === a.id).sort((x, y) => x.q - y.q);
  const rows = a.answers.map((ans, i) => {
    const key = correctAnswer(a, i), ok = ans && ans === key;
    const t = a.times ? a.times[i] : null;
    return `<tr><td class="n">${i + 1}</td><td>${ans || "–"}</td><td>${key || "?"}</td>
      <td>${ok ? `<span class="pill good">✓ Right</span>` : ans ? `<span class="pill bad">✗ Wrong</span>` : `<span class="pill none">Blank</span>`}${a.flags[i] ? ` <span class="pill warn">⚑</span>` : ""}</td>
      <td class="n">${t != null ? `<span${t > SLOW_SEC ? ' style="color:var(--bad)"' : ""}>${fmtClock(t)}</span>` : ""}</td>
      <td>${esc(topicShort(questionTopic(a, i)))}</td></tr>`;
  }).join("");
  let practice = "";
  if (a.kind === "practice") {
    practice = `<section class="card stack"><h2>Solutions</h2>${a.qids.map((gid, i) => {
      const q = S.bankById[gid]; if (!q) return "";
      return `<div class="item"><div class="spread"><b>Q${i + 1}</b><span class="small muted">${esc(topicShort(q.topic))} · difficulty ${q.difficulty}</span></div>
        <div class="stem">${esc(q.stem)}</div><div class="small">Your answer: <b>${a.answers[i] || "–"}</b> · Correct: <b>${q.answer}</b> (${esc(q.options[q.answer])})</div>
        <div class="solution">${esc(q.solution)}</div></div>`;
    }).join("")}</section>`;
  }
  return `<div class="spread"><h2>${title}</h2><span class="small muted">${fmtDay(a.date)} · ${a.mode}</span></div>
    <section class="card hero"><div><div class="big num">${a.score}<span class="muted" style="font-size:1.6rem">/${a.total}</span></div><div class="muted small">${Math.round(100 * a.score / a.total)}% correct</div></div>
      <div class="stack small">${a.usedSec != null && a.mode === "timed" ? `<div>Time used: <b class="num">${fmtClock(a.usedSec)}</b> of ${fmtClock(a.limitSec)}</div>` : ""}
      <div>${errs.length} added to the error log</div>${a.kind === "paper" ? `<a href="${esc(pdfLinks(a.paper).worked)}" target="_blank" rel="noopener">Worked answers ↗</a>` : ""}</div></section>
    ${errs.length ? `<section class="card stack"><h2>Why did these go wrong?</h2><p class="small muted" style="margin:0">One tap each. This drives the "mistakes by reason" chart.</p>${errs.map(e => errorItem(e, true)).join("")}</section>` : ""}
    ${practice}
    <section class="card"><details class="tbl"><summary>All ${a.total} questions</summary><div class="table-wrap"><table><thead><tr><th class="n">Q</th><th>You</th><th>Key</th><th></th><th class="n">Time</th><th>Topic</th></tr></thead><tbody>${rows}</tbody></table></div></details></section>
    <div class="row"><a class="btn" href="#${a.kind === "paper" ? "papers" : "practice"}">Back</a>
      <button class="btn danger" data-act="delattempt" data-id="${a.id}">${S.armed === `del-${a.id}` ? "Tap again to delete" : "Delete attempt"}</button></div>`;
}

function errorItem(e, compact) {
  const where = e.src === "official" ? `${paperName(e.paper)} · Q${e.q}` : `Practice · ${esc(e.gid)}`;
  const tag = e.src === "official" ? S.tags[e.paper]?.[e.q - 1] : null;
  const gq = e.gid ? S.bankById[e.gid] : null;
  const nd = nextDue(e), isDue = nd && nd <= today();
  const redo = (e.redo || []).map(r => r.done ? `<span class="ok">${fmtDay(r.due)} ${r.result === "miss" ? "✗ missed" : "✓ done"}</span>` : `<span class="${r.due <= today() ? "due" : ""}">${r.due <= today() ? "Due " : ""}${fmtDay(r.due)}</span>`).join(" → ");
  const links = e.src === "official" ? pdfLinks(e.paper) : null;
  const open = S.ui.openSol[e.id];
  return `<div class="item">
    <div class="spread"><b>${where}</b><span class="row">${e.why.map(w => `<span class="pill ${w === "slow" ? "warn" : w === "guessed" ? "warn" : "bad"}">${WHY_NAME[w]}</span>`).join("")}</span></div>
    <div class="small muted">${esc(topicName(e.topic))}${e.yours || e.correct ? ` · you ${e.yours || "–"}, key ${e.correct}` : ""}${e.sec ? ` · ${fmtClock(e.sec)}` : ""}</div>
    ${tag && !compact ? `<div class="small">Technique: ${esc(tag.technique)}</div>` : ""}
    <div class="chips">${REASONS.map(([k, label]) => `<button class="chip ${e.reason === k ? "on" : ""}" data-act="reason" data-id="${e.id}" data-v="${k}">${label}</button>`).join("")}</div>
    ${compact ? "" : `<div class="redo">Redo: ${redo}</div>
    <div class="row">${links ? `<a class="btn" href="${esc(links.paper)}" target="_blank" rel="noopener">Paper ↗</a><a class="btn" href="${esc(links.worked)}" target="_blank" rel="noopener">Worked ↗</a>` : gq ? `<button class="btn" data-act="togglesol" data-id="${e.id}">${open ? "Hide question" : "Show question"}</button>` : ""}
      ${isDue ? `<button class="btn primary" data-act="redo" data-id="${e.id}" data-v="ok">Got it</button><button class="btn" data-act="redo" data-id="${e.id}" data-v="miss">Missed again</button>` : ""}</div>
    ${open && gq ? `<div class="stack"><div class="stem">${esc(gq.stem)}</div><div class="small">${Object.entries(gq.options).map(([L, t]) => `<b>${L}</b> ${esc(t)}`).join(" &nbsp; ")}</div><details><summary class="small">Answer and solution</summary><div class="solution"><b>${gq.answer}</b>. ${esc(gq.solution)}</div></details></div>` : ""}`}
  </div>`;
}

function viewErrors() {
  const all = Object.values(S.errors).sort((a, b) => b.created.localeCompare(a.created) || (a.id < b.id ? -1 : 1));
  const f = S.ui.errFilter;
  const lists = {
    due: dueErrors(),
    reason: all.filter(e => !e.reason),
    open: all.filter(e => nextDue(e)),
    all,
  };
  const labels = { due: `Due today (${lists.due.length})`, reason: `No reason (${lists.reason.length})`, open: `Open (${lists.open.length})`, all: `All (${all.length})` };
  const list = lists[f] || lists.due;
  return `<div class="spread"><h2>Error log</h2><span class="small muted">Wrong, guessed or slow (over ${SLOW_SEC / 60} min) questions are added automatically</span></div>
    <div class="seg">${Object.keys(labels).map(k => `<button class="${k === f ? "on" : ""}" data-act="efilter" data-v="${k}">${labels[k]}</button>`).join("")}</div>
    <section class="card stack">${list.length ? list.map(e => errorItem(e)).join("") : `<div class="empty">${f === "due" ? "Nothing due today." : "Nothing here yet. Finish a paper or practice set and mistakes land here."}</div>`}</section>`;
}

function viewPractice() {
  const weak = weakestTopics();
  const counts = {};
  S.bank.forEach(q => counts[q.topic] = (counts[q.topic] || 0) + 1);
  const avail = Object.keys(counts).sort((a, b) => topicName(a).localeCompare(topicName(b)));
  if (S.ui.pTopics === null) S.ui.pTopics = weak.filter(t => counts[t]);
  const sel = S.ui.pTopics;
  const pool = S.bank.filter(q => !sel.length || sel.includes(q.topic));
  const seen = new Set(attemptsList().filter(a => a.kind === "practice").flatMap(a => a.qids));
  const unseen = pool.filter(q => !seen.has(q.id)).length;
  const sets = attemptsList().filter(a => a.kind === "practice").reverse();
  if (!S.bank.length) {
    return `<h2>Practice</h2><section class="card stack"><h3>The question bank is empty</h3>
      <p class="small" style="margin:0">New TMUA-style questions are written and checked by Claude from your error log and topic stats. In a Claude Code session on this repo, say:</p>
      <p class="mono small" style="margin:0">generate 10 questions on my 3 weakest topics</p>
      <p class="small muted" style="margin:0">Each answer is solved twice and checked with sympy before it's added. Practice results are kept separate from past-paper stats.</p>
      ${weak.length ? `<p class="small" style="margin:0">Your weakest topics right now: ${weak.map(t => `<b>${esc(topicShort(t))}</b>`).join(", ")}.</p>` : `<p class="small muted" style="margin:0">Record a few past papers first so your weakest topics are known.</p>`}
    </section>`;
  }
  return `<h2>Practice</h2>
    <section class="card stack">
      <div class="label">Topics ${weak.length ? "· preselected: your weakest" : ""}</div>
      <div class="chips">${avail.map(t => `<button class="chip ${sel.includes(t) ? "on" : ""}" data-act="ptopic" data-v="${t}">${esc(topicShort(t))} <span class="muted">${counts[t]}</span></button>`).join("")}</div>
      <div class="label">Questions · 3.5 min each</div>
      <div class="seg">${[3, 5, 10, 20].map(n => `<button class="${S.ui.pCount === n ? "on" : ""}" data-act="pcount" data-v="${n}">${n}</button>`).join("")}</div>
      <div class="small muted">${pool.length} in the pool, ${unseen} you haven't seen. Unseen questions are used first.</div>
      <div class="row"><button class="btn primary" data-act="pstart" ${pool.length ? "" : "disabled"}>Start ${Math.min(S.ui.pCount, pool.length)} questions · ${fmtClock(Math.min(S.ui.pCount, pool.length) * PRACTICE_SEC_PER_Q)}</button></div>
    </section>
    <section class="card stack"><h3>Recent sets</h3>${sets.length ? sets.slice(0, 8).map(a => `<div class="spread small"><a href="#attempt-${a.id}">${fmtDay(a.date)} · ${a.total} questions</a><span class="num">${a.score}/${a.total} · ${Math.round(a.usedSec / 60)} min</span></div>`).join("") : `<p class="small muted" style="margin:0">No sets yet.</p>`}</section>`;
}
function buildPracticeSet() {
  const sel = S.ui.pTopics || [];
  const pool = S.bank.filter(q => !sel.length || sel.includes(q.topic));
  const seenCount = {};
  attemptsList().filter(a => a.kind === "practice").forEach(a => a.qids.forEach(id => seenCount[id] = (seenCount[id] || 0) + 1));
  const shuffled = pool.map(q => [Math.random(), q]).sort((a, b) => (seenCount[a[1].id] || 0) - (seenCount[b[1].id] || 0) || a[0] - b[0]).map(x => x[1]);
  return shuffled.slice(0, S.ui.pCount).map(q => q.id);
}

/* ---------- progress & charts ---------- */
function viewProgress() {
  const off = attemptsList().filter(a => a.kind === "paper" && a.mode !== "status");
  const timed = off.filter(a => a.mode === "timed");
  const src = S.ui.statSrc;
  const ts = topicStats(src);
  const errs = Object.values(S.errors).filter(e => (src === "official") === (e.src === "official"));
  const byReason = REASONS.map(([k, l]) => ({ k, l, n: errs.filter(e => e.reason === k).length }));
  byReason.push({ k: "none", l: "No reason yet", n: errs.filter(e => !e.reason).length });
  const maxR = Math.max(1, ...byReason.map(r => r.n));
  const remaining = PAPERS.filter(id => paperStatus(id) === "none");
  return `<h2>Progress</h2>
    <section class="grid2">
      <div class="card"><div class="label">Exam in</div><div class="big num" style="font-family:var(--font-display);font-size:2.4rem;font-weight:700">${Math.max(0, daysLeft())} days</div><div class="small muted">8 January 2027</div></div>
      <div class="card"><div class="label">Papers remaining</div><div style="font-family:var(--font-display);font-size:2.4rem;font-weight:700" class="num">${remaining.length}<span class="muted" style="font-size:1.2rem"> / ${PAPERS.length}</span></div>
        <div class="small muted">${remaining.filter(isReserved).length} of them in the mock reserve</div></div>
    </section>
    <section class="card stack"><div class="spread"><h3>Score per paper over time</h3>
      <div class="legend"><span><i style="background:var(--accent)"></i>Timed</span><span><i style="background:var(--series-2)"></i>Untimed</span></div></div>
      ${off.length ? scoreChart(off) : `<div class="empty small">Record a paper to see your scores.</div>`}
      ${off.length ? tableOf(["Date", "Paper", "Mode", "Score"], off.map(a => [fmtDay(a.date), paperName(a.paper), a.mode, `${a.score}/20`])) : ""}</section>
    <section class="card stack"><div class="spread"><h3>Minutes used per timed paper</h3><span class="small muted">Dashed line: 75-minute limit</span></div>
      ${timed.length ? minutesChart(timed) : `<div class="empty small">Timed papers appear here.</div>`}
      ${timed.length ? tableOf(["Date", "Paper", "Minutes", "Answered"], timed.map(a => [fmtDay(a.date), paperName(a.paper), (a.usedSec / 60).toFixed(1), `${a.answers.filter(Boolean).length}/20`])) : ""}</section>
    <div class="seg"><button class="${src === "official" ? "on" : ""}" data-act="statsrc" data-v="official">Past papers</button><button class="${src === "generated" ? "on" : ""}" data-act="statsrc" data-v="generated">Generated practice</button></div>
    <section class="card stack"><div class="spread"><h3>Accuracy by topic, weakest first</h3><span class="small muted">${src === "official" ? "Official questions only" : "Generated questions only"}</span></div>
      ${ts.length ? ts.map(t => `<div class="hbar" data-tip="${esc(topicName(t.code))}: ${t.ok}/${t.n} correct"><span class="name">${esc(topicShort(t.code)).replace(/\//g, "/<wbr>")}</span><span class="track"><span class="fill" style="width:${Math.max(2, t.pct * 100)}%"></span></span><span class="v">${Math.round(t.pct * 100)}% <span class="muted">${t.n}</span></span></div>`).join("") : `<div class="empty small">No marked questions yet.</div>`}</section>
    <section class="card stack"><h3>Mistakes by reason</h3>
      ${errs.length ? byReason.map(r => `<div class="hbar" data-tip="${esc(r.l)}: ${r.n}"><span class="name">${esc(r.l)}</span><span class="track"><span class="fill" style="width:${r.n ? Math.max(2, 100 * r.n / maxR) : 0}%;${r.k === "none" ? "background:var(--ink-3)" : ""}"></span></span><span class="v">${r.n}</span></div>`).join("") : `<div class="empty small">No mistakes logged yet.</div>`}</section>
    <section class="card stack"><h3>Backup</h3>
      <div>${storageNote()}</div>
      <p class="small muted" style="margin:0">Export everything as JSON. Import merges a backup into this copy (entries with the same id are replaced).</p>
      <div class="row"><button class="btn" data-act="export">Export JSON</button><button class="btn" data-act="copy">Copy JSON</button>
        <label class="btn" for="importfile">Import file</label><input id="importfile" type="file" accept="application/json,.json" hidden></div>
      <textarea id="importtext" placeholder="…or paste a backup here"></textarea>
      <div class="row"><button class="btn" data-act="importtext">Import pasted JSON</button></div>
    </section>`;
}
function tableOf(head, rows) {
  return `<details class="tbl"><summary>Show as table</summary><div class="table-wrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
}
const chartW = () => Math.max(300, Math.min(700, ($("#main")?.clientWidth || 700) - 66));
function scoreChart(as) {
  const W = chartW(), H = 230, L = 34, R = 14, T = 12, B = 30;
  const days = as.map(a => new Date(a.date + "T12:00:00").getTime());
  let d0 = Math.min(...days), d1 = Math.max(...days);
  if (d1 - d0 < 6 * 864e5) { d0 -= 3 * 864e5; d1 += 3 * 864e5; }
  const x = t => L + (W - L - R) * (t - d0) / (d1 - d0);
  const y = v => T + (H - T - B) * (1 - v / 20);
  let g = "";
  for (const v of [0, 5, 10, 15, 20]) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  const ticks = W < 450 ? 2 : 4;
  for (let k = 0; k <= ticks; k++) { const t = d0 + (d1 - d0) * k / ticks; g += `<text x="${x(t)}" y="${H - 8}" text-anchor="${k === 0 ? "start" : k === ticks ? "end" : "middle"}">${new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</text>`; }
  for (const [mode, color] of [["untimed", "var(--series-2)"], ["timed", "var(--accent)"]]) {
    const pts = as.filter(a => a.mode === mode).map(a => [x(new Date(a.date + "T12:00:00").getTime()), y(a.score), a]);
    if (pts.length > 1) g += `<polyline fill="none" stroke="${color}" stroke-width="2" stroke-opacity=".45" points="${pts.map(p => `${p[0]},${p[1]}`).join(" ")}"/>`;
    g += pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="5.5" fill="${color}" stroke="var(--surface)" stroke-width="2" data-tip="${esc(paperName(p[2].paper))} · ${p[2].score}/20 · ${p[2].mode} · ${fmtDay(p[2].date)}"/><circle cx="${p[0]}" cy="${p[1]}" r="12" fill="transparent" data-tip="${esc(paperName(p[2].paper))} · ${p[2].score}/20 · ${p[2].mode} · ${fmtDay(p[2].date)}"/>`).join("");
  }
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scores out of 20 by date">${g}</svg>`;
}
function minutesChart(as) {
  const W = chartW(), H = 220, L = 34, R = 14, T = 12, B = 30, max = 90;
  const y = v => T + (H - T - B) * (1 - v / max);
  const bw = Math.min(42, (W - L - R) / as.length * 0.7), step = (W - L - R) / as.length;
  let g = "";
  for (const v of [0, 30, 60, 90]) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  as.forEach((a, i) => {
    const m = Math.min(max, a.usedSec / 60), cx = L + step * (i + 0.5), top = y(m), base = y(0);
    const tip = `${esc(paperName(a.paper))} · ${(a.usedSec / 60).toFixed(1)} min · ${a.score}/20`;
    const r = Math.min(4, Math.max(0, (base - top) / 2));
    g += base - top < 2
      ? `<rect x="${cx - bw / 2}" y="${base - 2}" width="${bw}" height="2" fill="var(--accent)" data-tip="${tip}"/>`
      : `<path d="M${cx - bw / 2},${base} V${top + r} q0,-${r} ${r},-${r} H${cx + bw / 2 - r} q${r},0 ${r},${r} V${base} Z" fill="var(--accent)" data-tip="${tip}"/>`;
    if (as.length <= 14) g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${paperShort(a.paper)}</text>`;
  });
  g += `<line class="ref" x1="${L}" x2="${W - R}" y1="${y(75)}" y2="${y(75)}"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutes used per timed paper">${g}</svg>`;
}

/* ---------- export / import ---------- */
function exportData() { return JSON.stringify({ app: "tmua-study-desk", version: 1, exported: new Date().toISOString(), attempts: S.attempts, errors: S.errors }, null, 1); }
async function importData(text) {
  let d;
  try { d = JSON.parse(text); } catch { toast("That isn't valid JSON."); return; }
  if (!d || d.app !== "tmua-study-desk") { toast("That isn't a TMUA Study Desk backup."); return; }
  let n = 0;
  for (const coll of ["attempts", "errors"]) for (const [id, v] of Object.entries(d[coll] || {})) { await Store.put(coll, id, v); n++; }
  toast(`Imported ${n} entries`); render();
}

/* ---------- events ---------- */
function arm(key) { S.armed = key; setTimeout(() => { if (S.armed === key) { S.armed = null; render(); } }, 3500); render(); }
document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-act]"); if (!el) return;
  const act = el.dataset.act, q = el.dataset.q != null ? +el.dataset.q : null;
  switch (act) {
    case "start": {
      const id = el.dataset.paper, mode = el.dataset.mode;
      if (session) { toast("Finish or discard the open session first."); location.hash = "#session"; return; }
      if (mode === "timed" && isReserved(id) && paperStatus(id) === "none" && S.armed !== `start-${id}`) { arm(`start-${id}`); return; }
      S.armed = null; startSession({ kind: "paper", paper: id, mode }); break;
    }
    case "markdone": await markDoneUntimed(el.dataset.paper); render(); break;
    case "cur": setCur(q); render(); break;
    case "pick": setCur(q); session.answers[q] = session.answers[q] === el.dataset.l ? null : el.dataset.l; saveSession(); render(); break;
    case "flag": setCur(q); session.flags[q] = !session.flags[q]; saveSession(); render(); break;
    case "pnav": setCur(q); render(); break;
    case "popt": session.answers[session.cur] = session.answers[session.cur] === el.dataset.l ? null : el.dataset.l; saveSession(); render(); break;
    case "finish": if (S.armed === "finish") { S.armed = null; await finishSession(); } else arm("finish"); break;
    case "abandon": if (S.armed === "abandon") { S.armed = null; session = null; saveSession(); location.hash = "#today"; toast("Session discarded"); } else arm("abandon"); break;
    case "reason": { const e = clone(S.errors[el.dataset.id]); e.reason = e.reason === el.dataset.v ? null : el.dataset.v; await Store.put("errors", e.id, e); render(); break; }
    case "redo": {
      const e = clone(S.errors[el.dataset.id]); const r = e.redo.find(r => !r.done); if (!r) break;
      r.done = today(); r.result = el.dataset.v;
      if (el.dataset.v === "miss") e.redo.push({ due: addDays(today(), 3), done: null, result: null });
      await Store.put("errors", e.id, e); toast(el.dataset.v === "ok" ? "Marked done" : "Rescheduled in 3 days"); render(); break;
    }
    case "efilter": S.ui.errFilter = el.dataset.v; if (route() !== "errors") location.hash = "#errors"; else render(); break;
    case "togglesol": S.ui.openSol[el.dataset.id] = !S.ui.openSol[el.dataset.id]; render(); break;
    case "statsrc": S.ui.statSrc = el.dataset.v; render(); break;
    case "ptopic": { const t = el.dataset.v, s = S.ui.pTopics; S.ui.pTopics = s.includes(t) ? s.filter(x => x !== t) : [...s, t]; render(); break; }
    case "pcount": S.ui.pCount = +el.dataset.v; render(); break;
    case "pstart": { if (session) { toast("Finish or discard the open session first."); location.hash = "#session"; return; } const ids = buildPracticeSet(); if (ids.length) startSession({ kind: "practice", qids: ids, mode: "timed" }); break; }
    case "delattempt": {
      const id = el.dataset.id;
      if (S.armed !== `del-${id}`) { arm(`del-${id}`); return; }
      S.armed = null;
      for (const e of Object.values(S.errors).filter(e => e.attempt === id)) await Store.del("errors", e.id);
      await Store.del("attempts", id); location.hash = "#papers"; toast("Attempt deleted"); break;
    }
    case "export": {
      const data = exportData(), filename = `tmua-backup-${today()}.json`;
      if (S.downloads) { try { await S.downloads.save({ filename, data }); } catch (e) { if (e?.code !== "declined") toast("Export unavailable here: use Copy JSON."); } }
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
      break;
    }
    case "copy": {
      const data = exportData();
      try { await navigator.clipboard.writeText(data); toast("Backup copied"); }
      catch { const t = $("#importtext"); t.value = data; t.select(); toast("Select-all and copy from the box"); }
      break;
    }
    case "importtext": await importData($("#importtext").value); break;
  }
});
document.addEventListener("change", async ev => {
  if (ev.target.id === "importfile" && ev.target.files[0]) await importData(await ev.target.files[0].text());
});
window.addEventListener("hashchange", () => { S.armed = null; render(); window.scrollTo(0, 0); });

/* hover tooltips for chart marks and bars */
const tip = $("#tip");
document.addEventListener("pointermove", ev => {
  const t = ev.target.closest && ev.target.closest("[data-tip]");
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip; tip.hidden = false;
  const x = Math.min(ev.clientX + 12, window.innerWidth - tip.offsetWidth - 8);
  tip.style.left = `${Math.max(8, x)}px`; tip.style.top = `${ev.clientY + 14}px`;
});

/* session clock: updates text only, auto-marks at zero */
setInterval(() => {
  if (!session || route() !== "session") return;
  const clock = $("#clock"); if (!clock) return;
  if (session.mode === "timed") {
    const rem = remaining();
    clock.textContent = fmtClock(rem); clock.classList.toggle("low", rem < 600);
    if (rem <= 0) { finishSession(); return; }
    const cur = $(`#qt${session.cur}`);
    if (cur && session.kind === "paper") cur.textContent = fmtClock(session.times[session.cur] + (Date.now() - session.curSince) / 1000);
  } else clock.textContent = fmtClock(elapsed());
  const pace = $("#pace"); if (pace) pace.textContent = paceText();
}, 1000);

/* ---------- boot ---------- */
async function boot() {
  const get = p => fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); });
  try {
    const [keys, tags, topics, links, bank] = await Promise.all([
      get("data/answer_keys.json"), get("data/question_tags.json"), get("data/topics.json"), get("data/paper_links.json"),
      get("data/generated_questions.json").catch(() => ({ questions: [] })),
    ]);
    for (const [id, k] of Object.entries(keys.keys)) S.keys[id] = k.split("");
    for (const [id, qs] of Object.entries(tags.papers)) S.tags[id] = qs;
    for (const t of topics.topics) S.topics[t.code] = t;
    S.links = links.papers;
    S.bank = bank.questions || [];
    S.bankById = Object.fromEntries(S.bank.map(q => [q.id, q]));
  } catch (e) {
    $("#main").innerHTML = `<div class="card empty">Couldn't load the paper data (${esc(e.message)}). Reload to try again.</div>`;
    return;
  }
  S.localPdfs = await fetch("papers/manifest.json", { method: "HEAD" }).then(r => r.ok).catch(() => false);
  await Store.init();
  if (session && session.mode === "timed" && remaining() <= 0) await finishSession();
}
boot();
