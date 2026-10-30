(function () {
  "use strict";
  const C = window.SWL_CONFIG;
  const QS = C.questions, NAMES = C.names, PAGE = document.body.dataset.page;
  const ORN = ["#B23A48", "#D4B26A", "#7FC79A"];
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const banner = (m) => { const b = $("#banner"); if (b) b.textContent = m || ""; };

  // ---------- device id (one vote per phone per round) ----------
  const newId = () => "d" + Math.random().toString(36).slice(2, 12);
  let device;
  try { device = localStorage.getItem("swl-device"); if (!device) { device = newId(); localStorage.setItem("swl-device", device); } }
  catch (e) { device = newId(); }

  // ---------- backend: Firebase, or a demo that syncs across tabs on one computer ----------
  function firebaseBackend() {
    firebase.initializeApp(C.firebase);
    const db = firebase.database();
    let vRef = null, pRef = null;
    return {
      demo: false,
      onState(cb) { db.ref("state").on("value", (s) => cb(s.val()), (e) => banner("Can’t read the game: " + e.message)); },
      watchSession(session, onVotes, onPresence) {
        if (vRef) vRef.off(); if (pRef) pRef.off();
        vRef = db.ref("votes/" + session); vRef.on("value", (s) => onVotes(s.val() || {}));
        pRef = db.ref("presence/" + session); pRef.on("value", (s) => onPresence(Object.keys(s.val() || {}).length));
      },
      setState(st) { return db.ref("state").set(st); },
      vote(session, rk, dev, name) { return db.ref(`votes/${session}/${rk}/${dev}`).set({ name, at: firebase.database.ServerValue.TIMESTAMP }); },
      join(session, dev) {
        const r = db.ref(`presence/${session}/${dev}`);
        db.ref(".info/connected").on("value", (s) => {
          if (s.val()) { r.onDisconnect().remove(); r.set(true); banner(""); }
          else banner("Reconnecting…");
        });
        return () => r.remove();
      }
    };
  }
  function demoBackend() {
    const KEY = "swl-demo";
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    const write = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} fire(); };
    const subs = [];
    const fire = () => subs.forEach((f) => f(read()));
    window.addEventListener("storage", (e) => { if (e.key === KEY) fire(); });
    let sess = null, ov = () => {}, op = () => {};
    subs.push((d) => { if (sess) { ov(((d.votes || {})[sess]) || {}); op(Object.keys(((d.presence || {})[sess]) || {}).length); } });
    return {
      demo: true,
      onState(cb) { subs.push((d) => cb(d.state || null)); setTimeout(fire, 0); },
      watchSession(session, onVotes, onPresence) { sess = session; ov = onVotes; op = onPresence; setTimeout(fire, 0); },
      setState(st) { const d = read(); d.state = st; write(d); return Promise.resolve(); },
      vote(session, rk, dev, name) {
        const d = read(); const s = d.state || {};
        if (s.phase !== "voting" || s.session !== session || s.roundKey !== rk) return Promise.reject(new Error("Voting is closed"));
        d.votes = d.votes || {}; d.votes[session] = d.votes[session] || {}; d.votes[session][rk] = d.votes[session][rk] || {};
        d.votes[session][rk][dev] = { name, at: Date.now() }; write(d); return Promise.resolve();
      },
      join(session, dev) {
        const d = read(); d.presence = d.presence || {}; d.presence[session] = d.presence[session] || {}; d.presence[session][dev] = true; write(d);
        return () => {};
      }
    };
  }
  const B = C.firebase ? firebaseBackend() : demoBackend();

  // ---------- shared game state ----------
  let state = null;          // {phase, round, session, attempt:{}, roundKey}
  let votes = {};            // {roundKey: {device: {name}}}
  let phones = 0;
  let watched = null;
  const rk = (r, st = state) => "r" + r + "_" + (((st && st.attempt) || {})[r] || 0);
  const roundList = (r) => Object.values(votes[rk(r)] || {}).map((v) => v && v.name).filter((n) => NAMES.includes(n));
  const tally = (list) => { const m = {}; list.forEach((n) => (m[n] = (m[n] || 0) + 1)); return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); };
  const myVote = () => { const v = (votes[state.roundKey] || {})[device]; return v && NAMES.includes(v.name) ? v.name : null; };

  B.onState((st) => {
    if (!st || !st.session) {
      if (PAGE === "host") { state = null; render(); return; }
      state = { phase: "lobby", round: 0, session: "none", attempt: {}, roundKey: "r0_0" };
    } else state = st;
    if (watched !== state.session) {
      watched = state.session;
      if (PAGE === "vote" && state.session !== "none") B.join(state.session, device);
      B.watchSession(state.session, (v) => { votes = v; render("votes"); }, (n) => { phones = n; if (PAGE !== "vote") render("presence"); });
    }
    render("state");
  });

  // ---------- decorations ----------
  const LC = ["#E9C46A", "#C0394B", "#F4EFE4", "#7FC79A"];
  function lights(cls) { let s = `<svg class="${cls}" aria-hidden="true" viewBox="0 0 1440 96" preserveAspectRatio="xMidYMin slice"><path d="M-10 14 Q80 64 170 14 T350 14 T530 14 T710 14 T890 14 T1070 14 T1250 14 T1430 14 T1610 14" fill="none" stroke="#24543B" stroke-width="3"/>`; for (let k = 0; k < 16; k++) { const x = 45 + 90 * k; s += `<circle cx="${x}" cy="55" r="22" fill="${LC[k % 4]}" opacity=".22"/><rect x="${x - 5}" y="34" width="10" height="8" rx="2" fill="#8C8A7A"/><ellipse cx="${x}" cy="53" rx="8" ry="12" fill="${LC[k % 4]}"/>`; } return s + "</svg>"; }
  const HILLS = (() => { let s = '<svg class="hills" aria-hidden="true" viewBox="0 0 1440 240" preserveAspectRatio="xMidYMax slice"><path d="M0 150 C180 90 320 110 470 140 C640 172 760 96 940 110 C1120 124 1240 160 1440 120 L1440 240 L0 240 Z" fill="#123D29"/><path d="M0 190 C220 150 420 170 620 180 C820 190 1010 150 1220 168 C1320 176 1390 184 1440 180 L1440 240 L0 240 Z" fill="#0C2E1F"/>'; [[120, 190, 110, 70], [205, 186, 80, 52], [560, 184, 70, 46], [880, 176, 96, 60], [1250, 182, 120, 76], [1340, 186, 86, 56]].forEach(([x, b, h, w], i) => { const f = i % 2 ? "#256B47" : "#1E5A3C"; s += `<rect x="${x - 5}" y="${b - 10}" width="10" height="14" fill="#4A3424"/>`; [[0, 1], [0.3, 0.8], [0.55, 0.58]].forEach(([q, ww]) => { const t = b - 10 - h * (q + 0.45), bt = b - 10 - h * q; s += `<polygon points="${x},${t} ${x - (w * ww) / 2},${bt} ${x + (w * ww) / 2},${bt}" fill="${f}"/>`; }); s += `<circle cx="${x - w * 0.2}" cy="${b - 10 - h * 0.3}" r="3.2" fill="#E9C46A"/><circle cx="${x + w * 0.18}" cy="${b - 10 - h * 0.5}" r="3.2" fill="#C0394B"/><circle cx="${x - w * 0.05}" cy="${b - 10 - h * 0.72}" r="3.2" fill="#F4EFE4"/>`; }); return s + "</svg>"; })();
  function confetti() { let s = '<div class="confetti" aria-hidden="true">'; const c = ["#D4B26A", "#E9C46A", "#B02A3E", "#2E8B57", "#60B078"]; for (let i = 0; i < 50; i++) { s += `<i style="left:${(i * 37) % 100}%;background:${c[i % 5]};animation-duration:${(4 + (i % 5)) * 1.1}s;animation-delay:${-(i % 9) * 0.7}s"></i>`; } return s + "</div>"; }

  // ---------- TV ----------
  const voteUrl = new URL("./", location.href).href;
  let qrImg = "";
  function makeQR() {
    if (qrImg || !window.QRCode) return;
    const holder = document.createElement("div");
    new QRCode(holder, { text: voteUrl, width: 512, height: 512, correctLevel: QRCode.CorrectLevel.M });
    const cv = holder.querySelector("canvas");
    qrImg = cv ? cv.toDataURL() : "";
  }
  function qrBlock(label) {
    makeQR();
    return `<div class="side"><div class="qr">${qrImg ? `<img src="${qrImg}" alt="QR code to the voting page">` : ""}</div><p>${label}<em>Escanea para votar</em></p><span class="url">${esc(voteUrl.replace(/^https?:\/\//, ""))}</span></div>`;
  }
  function board(t, title) {
    const max = t[0][1];
    return `<div class="board"><h3>${esc(title)}</h3>${t.slice(0, 5).map(([n, c]) => `<div class="row${c === max ? " top" : ""}"><div><span>${esc(n)}</span><span>${c}</span></div><div class="t"><i style="width:${Math.round((c / max) * 100)}%"></i></div></div>`).join("")}</div>`;
  }
  const ROUND_IMG = {"0": {"src": "round01.jpg", "qr": [70.19, 24.35, 18.34]}, "1": {"src": "round02.jpg", "qr": [70.22, 22.11, 18.29], "ct": 72}, "2": {"src": "round03.jpg", "qr": [69.92, 23.87, 17.94]}, "3": {"src": "round04.jpg", "qr": [70.65, 23.45, 18.04]}, "4": {"src": "round05.jpg", "qr": [70.24, 22.52, 18.14]}, "5": {"src": "round06.jpg", "qr": [70.27, 22.62, 18.14]}, "6": {"src": "round07.jpg", "qr": [70.15, 23.12, 17.89]}, "7": {"src": "round08.jpg", "qr": [70.1, 22.52, 18.15]}, "8": {"src": "round09.jpg", "qr": [70.24, 22.41, 18.14]}, "9": {"src": "round10.jpg", "qr": [70.16, 22.7, 17.94]}, "10": {"src": "round11.jpg", "qr": [70.24, 22.3, 18.14]}, "11": {"src": "round12.jpg", "qr": [70.18, 22.52, 18.14]}};
  const BARS = [259, 341, 422, 504, 586];
  function revealTpl(chip, label, t, emptyMsg) {
    const top = t.length ? t[0][1] : 0;
    const name = t.length ? t.filter((x) => x[1] === top).map((x) => x[0]).join(" & ") : emptyMsg;
    const rows = t.slice(0, 5).map(([n, c], i) => { const y = ((BARS[i] / 941) * 100).toFixed(2); return `<div class="rv-bar${c === top ? " top" : ""}" style="top:${y}%"><i style="width:${Math.max(10, Math.round((c / top) * 100))}%"></i><span>${esc(n)}</span></div><div class="rv-num" style="top:${y}%">${c}</div>`; }).join("");
    return `<div class="stage"><img class="bgimg" src="reveal.jpg" alt=""><div class="rv-head"><span class="rv-chip">${esc(chip)}</span><span class="rv-sep"></span><span class="rv-label">${esc(label)}</span></div><div class="rv-name${name.length > 14 ? " long" : ""}">${esc(name)}</div>${rows}${t.length ? confetti() : ""}</div>`;
  }
  function renderTV() {
    const r = state.round, q = QS[r];
    let html;
    if (state.phase === "lobby") {
      makeQR();
      html = `<div class="stage"><img class="bgimg" src="how-to-vote.jpg" alt="How to vote: 1. Scan the QR code with your phone camera. 2. Tap a coworker’s name, then tap Vote. 3. Watch the TV for the winner. No app, no login. One vote per phone each round."><div class="qrspot">${qrImg ? `<img src="${qrImg}" alt="QR code to the voting page">` : ""}</div><p class="joined">${phones} ${phones === 1 ? "phone" : "phones"} joined · ${esc(voteUrl.replace(/^https?:\/\//, ""))}</p></div>`;
    } else if (state.phase === "voting") {
      const n = roundList(r).length, pct = phones ? Math.min(100, Math.round((n / phones) * 100)) : 0;
      const ri = ROUND_IMG[r];
      if (ri) {
        makeQR();
        html = `<div class="stage"><img class="bgimg" src="${ri.src}" alt="${esc(q[0])} / ${esc(q[1])}"><div class="qrspot" style="left:${ri.qr[0]}%;top:${ri.qr[1]}%;width:${ri.qr[2]}%">${qrImg ? `<img src="${qrImg}" alt="QR code to the voting page">` : ""}</div><div class="rcount"${ri.ct ? ` style="top:${ri.ct}%"` : ""}><span><b>${n}</b>${n === 1 ? "vote" : "votes"} in <em>of ${phones} ${phones === 1 ? "phone" : "phones"}</em></span><div class="bar"><i style="width:${pct}%"></i></div></div></div>`;
      } else
      html = `<div class="stage">${lights("lights")}${HILLS}<div class="inner"><div class="col"><div style="display:flex;gap:1.4cqw;align-items:center"><span class="chip">Round ${r + 1} of ${QS.length}</span><span class="open"><i></i>Voting open</span></div><h1 class="q">${esc(q[0])}</h1><p class="qes">${esc(q[1])}</p><div class="count"><span><b>${n}</b>${n === 1 ? "vote" : "votes"} in</span><span>of ${phones} ${phones === 1 ? "phone" : "phones"}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>${qrBlock("Scan to vote")}</div></div>`;
    } else if (state.phase === "reveal") {
      html = revealTpl(`Round ${r + 1} of ${QS.length}`, q[2], tally(roundList(r)), "No votes this round");
    } else {
      const all = []; QS.forEach((_, i) => all.push(...roundList(i)));
      html = revealTpl("Grand prize", C.grandPrize, tally(all), "No votes yet");
    }
    $("#app").innerHTML = html;
  }

  // ---------- Phone ----------
  let picked = null, changing = false, sending = false, lastKey = "";
  const head = (sub) => `${lights("ph-lights")}<div class="ph-head"><div class="ph-top"><span>SWL Superlatives</span><span>${sub}</span></div>`;
  function renderVote(why) {
    const r = state.round, q = QS[r], mine = state.phase === "voting" ? myVote() : null;
    const key = [state.session, state.phase, state.roundKey, mine, picked, changing, sending].join("|");
    if (key === lastKey) return; // don't rebuild the list while people type or others vote
    lastKey = key;
    let html;
    if (state.phase === "lobby") {
      html = `<div class="ph">${head("")}</div><div class="center"><h2>You’re in!</h2><p class="es">¡Ya estás dentro!</p><div class="steps"><div><span style="background:#B23A48;color:#F6EEE6">1</span><p>A question pops up here<small>Aparece una pregunta aquí</small></p></div><div><span style="background:#D4B26A;color:#0A2318">2</span><p>Tap a name, then tap Vote<small>Toca un nombre y luego Votar</small></p></div><div><span style="background:#7FC79A;color:#0A2318">3</span><p>Watch the TV for the winner<small>Mira la pantalla para ver al ganador</small></p></div></div><p>Waiting for the host to start Round 1. Keep this page open.</p></div></div>`;
    } else if (state.phase === "voting" && mine && !changing) {
      html = `<div class="ph">${head(`Round ${r + 1} / ${QS.length}`)}</div><div class="center"><div class="check"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0A2318" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div><h2>Vote locked in</h2><p class="es">¡Voto registrado!</p><div class="you">You picked <b>${esc(mine)}</b></div><p>Eyes on the TV for the reveal. The next round shows up here on its own.</p><button class="link" id="change">Change my vote · Cambiar</button></div></div>`;
    } else if (state.phase === "voting") {
      const sel = picked || (changing ? mine : null);
      html = `<div class="ph">${head(`Round ${r + 1} / ${QS.length}`)}<h1 class="ph-q">${esc(q[0])}</h1><p class="ph-es">${esc(q[1])}</p>${NAMES.length > 8 ? `<input class="search" id="search" type="search" placeholder="Find a name · Busca un nombre" aria-label="Find a name" autocomplete="off">` : ""}</div><div class="names">${NAMES.map((n) => `<button class="name" data-name="${esc(n)}" aria-pressed="${n === sel}">${esc(n)}<i></i></button>`).join("")}<p class="noresult" id="noresult" hidden>No match. Check the spelling.</p></div><div class="ph-foot"><button class="big" id="submit" ${sel && !sending ? "" : "disabled"}>${sending ? "Sending…" : sel ? `Vote for ${esc(sel)} · Votar` : "Pick a name · Elige un nombre"}</button></div></div>`;
    } else {
      const fin = state.phase === "final";
      html = `<div class="ph">${head(fin ? "Finale" : `Round ${r + 1} / ${QS.length}`)}</div><div class="center"><h2>${fin ? "The grand prize is up!" : "Voting is closed"}</h2><p class="es">${fin ? "¡El gran premio!" : "Votación cerrada"}</p><p>${fin ? "Watch the TV for the " + esc(C.grandPrize) + " winner." : "Watch the TV for the winner. The next round shows up here on its own."}</p></div></div>`;
    }
    const sv = $("#search") ? $("#search").value : "";
    $("#app").innerHTML = html;
    if ($("#search") && sv) { $("#search").value = sv; filter(sv); }
  }
  function filter(v) {
    const s = v.trim().toLowerCase(); let shown = 0;
    document.querySelectorAll(".name").forEach((b) => { const ok = !s || b.dataset.name.toLowerCase().includes(s); b.hidden = !ok; if (ok) shown++; });
    const nr = $("#noresult"); if (nr) nr.hidden = shown > 0;
  }
  if (PAGE === "vote") {
    $("#app").addEventListener("input", (e) => { if (e.target.id === "search") filter(e.target.value); });
    $("#app").addEventListener("click", async (e) => {
      const n = e.target.closest(".name");
      if (n) { picked = n.dataset.name; document.querySelectorAll(".name").forEach((b) => b.setAttribute("aria-pressed", String(b === n))); const s = $("#submit"); s.disabled = false; s.textContent = `Vote for ${picked} · Votar`; lastKey = ""; return; }
      if (e.target.closest("#change")) { changing = true; picked = myVote(); render(); return; }
      if (e.target.closest("#submit") && picked && !sending) {
        sending = true; render();
        try { await B.vote(state.session, state.roundKey, device, picked); picked = null; changing = false; banner(""); }
        catch (err) { banner("Your vote didn’t go through. Voting may have closed. · Tu voto no se registró."); }
        sending = false; render();
      }
    });
  }

  // ---------- Host ----------
  let unlocked = false;
  try { unlocked = sessionStorage.getItem("swl-host") === "1"; } catch (e) {}
  function save(patch) {
    const base = state || { phase: "lobby", round: 0, session: newSession(), attempt: {} };
    const st = Object.assign({}, base, patch);
    st.attempt = Object.assign({}, st.attempt || {});
    st.roundKey = rk(st.round, st);
    st.updatedAt = Date.now();
    return B.setState(st).catch((e) => banner("Couldn’t save: " + e.message));
  }
  const newSession = () => "s" + Date.now().toString(36);
  function renderHost() {
    if (!unlocked) {
      $("#app").innerHTML = `<form class="gate" id="gate"><h1>Host controls</h1><p class="note">Enter the host PIN.</p><input id="pin" inputmode="numeric" autocomplete="off" aria-label="Host PIN"><button class="btn primary" type="submit">Unlock</button><p class="note" id="pinmsg"></p></form>`;
      return;
    }
    if (!state) {
      $("#app").innerHTML = `<div class="wrap"><div class="card"><h2>Set up the game</h2><p class="note">This creates a fresh game and puts the How to vote screen on the TV.</p><div class="btns"><button class="btn primary" data-act="setup">Create the game</button></div></div></div>`;
      return;
    }
    const r = state.round, q = QS[r], list = roundList(r), t = tally(list);
    const label = { lobby: "TV shows: How to vote", voting: "Voting open", reveal: "Winner on the TV", final: "Finale on the TV" }[state.phase];
    let main = "";
    if (state.phase === "lobby") main = `<button class="btn primary" data-act="start">Start Round ${r + 1}</button>`;
    else if (state.phase === "voting") main = `<button class="btn primary" data-act="reveal">Close voting &amp; reveal</button><button class="btn" data-act="redo">Redo this round</button><button class="btn" data-act="lobby">Show How to vote</button>`;
    else if (state.phase === "reveal") main = (r < QS.length - 1 ? `<button class="btn primary" data-act="next">Next: Round ${r + 2}</button>` : `<button class="btn primary" data-act="final">Finale: ${esc(C.grandPrize)}</button>`) + `<button class="btn" data-act="reopen">Reopen voting</button><button class="btn" data-act="redo">Redo this round</button>`;
    else main = `<button class="btn primary" data-act="reveal">Back to Round ${r + 1} reveal</button>`;
    $("#app").innerHTML = `<div class="wrap"><div class="hostbar"><h1>Host controls</h1><span class="note">TV screen: <a href="tv.html" target="_blank" rel="noopener">open tv.html</a>${B.demo ? " · DEMO MODE (this computer only)" : ""}</span></div><div class="grid">
      <div class="card"><span class="kicker${state.phase === "voting" ? " live" : ""}">${label}</span><h2>${state.phase === "final" ? esc(C.grandPrize) : `Round ${r + 1}: ${esc(q[0])}`}</h2><div class="stats"><span><b>${phones}</b>phones joined</span>${state.phase === "voting" || state.phase === "reveal" ? `<span><b>${list.length}</b>votes this round</span>` : ""}</div><div class="btns">${main}</div>${state.phase === "voting" && t.length ? `<details><summary class="note">Peek at the live tally (only you see this)</summary><div class="tally">${t.map(([n, c]) => `<div><span>${esc(n)}</span><span>${c}</span></div>`).join("")}</div></details>` : ""}</div>
      <div class="card"><h2>Rounds</h2><p class="note">Tap a round to jump to it and open voting.</p><div class="rounds">${QS.map((x, i) => { const c = roundList(i).length; return `<button class="rd${i === r && state.phase !== "lobby" ? " cur" : ""}" data-jump="${i}"><span>${i + 1} · ${esc(x[2])}</span><span>${c ? c + " votes" : "—"}</span></button>`; }).join("")}</div></div>
      <div class="card"><h2>New game</h2><p class="note">Starts over with zero votes and puts the How to vote screen back on the TV. Phones stay connected. Do this after testing and right before the party.</p><div class="btns"><button class="btn gold" data-act="reset" id="reset">Start a fresh game</button></div></div>
    </div></div>`;
  }
  if (PAGE === "host") {
    let armed = false;
    $("#app").addEventListener("submit", (e) => {
      if (e.target.id !== "gate") return; e.preventDefault();
      if ($("#pin").value.trim() === String(C.hostPin)) { unlocked = true; try { sessionStorage.setItem("swl-host", "1"); } catch (_) {} render(); }
      else $("#pinmsg").textContent = "That PIN isn’t right.";
    });
    $("#app").addEventListener("click", (e) => {
      const j = e.target.closest("[data-jump]"); if (j) { save({ phase: "voting", round: Number(j.dataset.jump) }); return; }
      const a = e.target.closest("[data-act]"); if (!a) return;
      const r = state ? state.round : 0;
      switch (a.dataset.act) {
        case "setup": save({ phase: "lobby", round: 0, session: newSession(), attempt: {} }); break;
        case "start": save({ phase: "voting", round: r }); break;
        case "reveal": save({ phase: "reveal" }); break;
        case "reopen": save({ phase: "voting" }); break;
        case "next": save({ phase: "voting", round: r + 1 }); break;
        case "final": save({ phase: "final" }); break;
        case "lobby": save({ phase: "lobby" }); break;
        case "redo": { const at = Object.assign({}, state.attempt || {}); at[r] = (at[r] || 0) + 1; save({ phase: "voting", attempt: at }); break; }
        case "reset":
          if (!armed) { armed = true; a.textContent = "Tap again to erase all votes"; setTimeout(() => { armed = false; render(); }, 4000); return; }
          armed = false; save({ phase: "lobby", round: 0, session: newSession(), attempt: {} }); break;
      }
    });
  }

  function render() {
    if (PAGE === "host") return renderHost();
    if (!state) return;
    if (PAGE === "tv") return renderTV();
    renderVote();
  }
  if (PAGE === "host") render();
  if (B.demo && PAGE !== "tv") banner("Demo mode: Firebase isn’t connected yet, so this only syncs between tabs on this computer.");
})();
