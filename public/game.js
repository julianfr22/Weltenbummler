/* =====================================================================
   WELTENBUMMLER – Oberfläche, Animationen & Verbindung
   · verbindet sich mit dem Spiel-Server (oder spielt lokal gegen Bots)
   · spielt die Ereignisse des Servers nacheinander als Animation ab
   · Anbindung an die Tyjora-Lobby: ?lobby=CODE&room=CODE-1&host=ID
   ===================================================================== */
(function () {
"use strict";
const WB = window.WB, G3 = window.G3, N = WB.BOARD.nodes, CFG = WB.CFG;
const TYJORA = (typeof window.WB_TYJORA === "string" ? window.WB_TYJORA : "https://tyjora.com").replace(/\/$/, "");
const GAME_ID = "weltenbummler";

const $ = (s) => document.querySelector(s);
const show = (s, on = true) => $(s).classList.toggle("hide", !on);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const rid = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
const clone = (o) => JSON.parse(JSON.stringify(o));

let me = null, D = null, conn = null, mode = "", roomCode = "";
let queue = [], running = false, skip = false, activeId = null, ownersSig = "";
let myLook = null; try { myLook = JSON.parse(store.get("wb_look") || "null"); } catch {}
if (!myLook) myLook = {};
for (const k in WB.LOOK_MAX) if (!Number.isInteger(myLook[k]) || myLook[k] < 0 || myLook[k] >= WB.LOOK_MAX[k]) myLook[k] = Math.floor(Math.random() * WB.LOOK_MAX[k]);

const P = (id) => D && D.players.find((p) => p.id === id);
const nameOf = (id) => { const p = P(id); return p ? (id === me ? "Du" : p.name) : "?"; };
const seatCol = (id) => { const p = P(id); return G3.SEATS[(p ? p.seat : 0) % G3.SEATS.length]; };
const isHost = () => D && D.hostId === me;
const myTurn = () => D && D.phase === "play" && D.order[D.turn] === me;

/* ---------- Meldungen ---------- */
function toast(html, ms = 2600) {
  const d = document.createElement("div"); d.className = "toast"; d.innerHTML = html; $("#toasts").appendChild(d);
  while ($("#toasts").children.length > 4) $("#toasts").firstChild.remove();
  setTimeout(() => { d.classList.add("out"); setTimeout(() => d.remove(), 320); }, ms);
}
let bannerT = 0;
function banner(big, small, ms = 1300) { const b = $("#banner"); b.innerHTML = esc(big) + (small ? "<small>" + esc(small) + "</small>" : ""); b.classList.add("on"); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove("on"), ms); }
function status(title, text, btns) {
  $("#statusTitle").textContent = title; $("#statusText").innerHTML = text; const r = $("#statusBtns"); r.innerHTML = "";
  for (const [label, fn, cls] of btns || []) { const b = document.createElement("button"); b.textContent = label; b.className = cls || "pri"; b.onclick = fn; r.appendChild(b); }
  show("#status", true);
}

/* ---------- Zeit & Bewegungen ---------- */
const tweens = [];
function wait(ms) { return skip ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)); }
function tween(ms, fn) { if (skip) { fn(1); return Promise.resolve(); } return new Promise((res) => tweens.push({ t: 0, ms, fn, res })); }
const ease = (k) => k * k * (3 - 2 * k);
let lastT = 0;
function loop(ts) {
  const dt = Math.min(0.05, (ts - (lastT || ts)) / 1000); lastT = ts;
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt * 1000; const k = Math.min(1, w.t / w.ms); w.fn(k); if (k >= 1) { tweens.splice(i, 1); w.res(); } }
  if (D && D.phase === "lobby") stageLobby();
  G3.frame(dt, ts / 1000);
  labels();
  requestAnimationFrame(loop);
}

/* ---------- Beschriftungen über den Figuren ---------- */
const tagEls = {}, airEls = [];
function labels() {
  const L = $("#labels");
  for (const id in tagEls) if (!G3.chars[id] || !P(id)) { tagEls[id].remove(); delete tagEls[id]; }
  for (const id in G3.chars) {
    const c = G3.chars[id], p = P(id); if (!p) continue;
    let el = tagEls[id]; if (!el) { el = tagEls[id] = document.createElement("div"); el.className = "tag"; L.appendChild(el); }
    const txt = (D.hostId === id && D.phase === "lobby" ? "👑 " : "") + p.name + (p.on || p.bot ? "" : " 💤");
    if (el._t !== txt) { el.textContent = txt; el._t = txt; }
    el.style.background = seatCol(id); el.classList.toggle("me", id === me);
    const s = G3.project(c.x, G3.cy(c) + 0.32 * c.scale * (c.look.hat ? [0, 1.5, 1.74, 1.6, 1.62, 1.5, 1.6, 1.85, 1.5][c.look.hat] : 1.42) + 0.05, c.z);
    el.style.display = c.vis && c.scale > 0.4 && s.ok ? "" : "none"; el.style.left = s.x + "px"; el.style.top = s.y + "px";
  }
  const far = G3.cam.dist > 9 || !D || D.phase === "lobby";
  WB.AIRPORTS.forEach((n, i) => { let el = airEls[i]; if (!el) { el = airEls[i] = document.createElement("div"); el.className = "tag air"; el.textContent = "✈ " + N[n].air; L.appendChild(el); }
    const p = G3.pos(n), s = G3.project(p.x, p.y - 0.02, p.z + 0.2); el.style.display = s.ok && !far ? "" : "none"; el.style.left = s.x + "px"; el.style.top = s.y + 20 + "px"; });
  for (const b of L.querySelectorAll(".go")) { const p = G3.pos(+b.dataset.node), s = G3.project(p.x, p.y + 0.03, p.z); b.style.left = s.x + "px"; b.style.top = s.y + "px"; }
}
function floatText(id, html, col) {
  const c = G3.chars[id]; if (!c || skip) return; const s = G3.project(c.x, G3.cy(c) + 0.6, c.z);
  const d = document.createElement("div"); d.className = "float"; d.innerHTML = html; d.style.color = col; d.style.left = s.x + "px"; d.style.top = s.y + "px";
  $("#labels").appendChild(d); setTimeout(() => d.remove(), 1350);
}

/* ---------- Spielstand anzeigen ---------- */
function applySync(s) {
  D = s;
  const ids = D.players.map((p) => p.id);
  G3.keepOnly(ids);
  for (const p of D.players) { const c = G3.setChar(p.id, p.look, p.pos, p.seat); if (D.phase !== "lobby" && !running) { c.busy = false; c.scale = 1; c.rot = c.rot || 0; } }
  if (D.phase !== "lobby") for (const p of D.players) { const c = G3.chars[p.id]; if (c.stage) { c.stage = false; c.busy = false; c.scale = 1; c.rot = 0; const q = G3.pos(p.pos); c.x = q.x; c.z = q.z; c.node = p.pos; } }
  if (queue.length === 0) { G3.caseObj.node = D.caseNode; G3.caseObj.scale = 1; G3.caseObj.y = 0; }
  const sig = JSON.stringify(D.owners) + "|" + D.players.map((p) => p.id + p.seat).join();
  if (sig !== ownersSig) { ownersSig = sig; G3.bake(D.phase === "lobby" ? {} : D.owners, (id) => { const p = P(id); return p ? p.seat : 0; }); }
  if (D.phase === "play") activeId = D.order[D.turn]; else activeId = null;
  render();
}
function render() {
  if (!D) return;
  const lobby = D.phase === "lobby", game = D.phase === "play" || D.phase === "mini" || D.phase === "end";
  show("#lobby", lobby); show("#lobbyTitle", lobby);
  show("#top", game); show("#plist", game); show("#bar", game && D.phase !== "end");
  if (D.phase !== "end") show("#end", false);
  if (D.phase !== "mini" && !running) show("#mini", false);
  if (lobby) { renderLobby(); G3.turnId = null; G3.rings = []; clearGo(); show("#prompt", false); G3.caseObj.node = -1; }
  if (game) { renderPlayers(); renderTop(); renderBar(); }
  if (D.phase === "end") renderEnd();
}
function renderPlayers() {
  const el = $("#plist"); el.innerHTML = "";
  const list = D.order.length ? D.order.map(P).filter(Boolean) : D.players;
  for (const p of list) {
    const d = document.createElement("div"); d.className = "pc" + (p.id === activeId ? " act" : "") + (p.on || p.bot ? "" : " off");
    let st = ""; for (let i = 0; i < D.set.stamps; i++) st += p.stamps[i] ? `<i class="got" title="${esc(WB.CONTS[p.stamps[i]].name)}">${WB.CONTS[p.stamps[i]].icon}</i>` : "<i></i>";
    d.innerHTML = `<div class="bar" style="background:${seatCol(p.id)}"></div>
      <div class="nm">${p.bot ? "🤖 " : ""}${esc(p.name)}${p.id === me ? " (du)" : ""}${p.skip ? " 💤" : ""}</div>
      <div class="st"><span>🪙 ${p.coins}</span><span>${"❤".repeat(Math.max(0, p.lives))}<span style="opacity:.3">${"❤".repeat(Math.max(0, CFG.START_LIVES - p.lives))}</span></span><span>🎒 ${p.items.length}</span></div>
      <div class="stamps">${st}</div>`;
    d.onclick = () => { const c = G3.chars[p.id]; if (c) G3.focus(c.x, c.z + 0.25, 3.1, 0.95); };
    el.appendChild(d);
  }
}
function renderTop() {
  $("#roundChip").textContent = "Runde " + D.round;
  const mp = P(me);
  if (D.caseNode >= 0) { const d = mp ? WB.distTo(D.caseNode)[mp.pos] : 0; $("#caseChip").textContent = "🧳 " + WB.CONTS[D.caseCont].name + (mp ? " · " + d + (d === 1 ? " Feld" : " Felder") : ""); }
  else $("#caseChip").textContent = "🧳 –";
}
function clearGo() { for (const b of document.querySelectorAll("#labels .go")) b.remove(); }
function send(a) { if (conn) conn.send(a); }

function renderBar() {
  if (!D || D.phase === "lobby") return;
  const bar = $("#bar"); bar.innerHTML = ""; clearGo(); G3.rings = []; show("#prompt", false);
  const msg = (t) => { const s = document.createElement("span"); s.className = "msg"; s.innerHTML = t; bar.appendChild(s); };
  if (D.phase === "end") return;
  if (D.phase === "mini") { msg("🎮 Minispiel!"); return; }
  const p = P(D.order[D.turn]); if (!p) return;
  if (running || queue.length) { msg(p.id === me ? "Du bist dran …" : esc(p.name) + " ist dran …"); return; }
  G3.turnId = p.id;
  if (p.id !== me) { msg((p.bot ? "🤖 " : "") + esc(p.name) + " ist dran …"); return; }
  const st = D.step, c = G3.chars[me];
  if (c && !G3.cam.free) G3.focus(c.x, c.z + 0.25, st.k === "branch" ? 4.2 : 3.1, 0.95);
  if (st.k === "pre") {
    const b = document.createElement("button"); b.id = "rollBtn"; b.className = "pri"; b.textContent = "🎲 Würfeln"; b.onclick = () => send({ t: "roll" }); bar.appendChild(b);
    const buff = p.buff === "double" ? "Doppelwürfel aktiv" : p.buff === "mini" ? "Mini-Würfel aktiv" : p.buff ? "Wunschwürfel: " + p.buff.gold : "";
    if (buff || p.slow || p.disc) msg([buff, p.slow ? "🐌 dein Wurf wird halbiert" : "", p.disc ? "🏷️ Koffer-Gutschein aktiv" : ""].filter(Boolean).join(" · "));
    p.items.forEach((it, i) => {
      const def = WB.ITEMS[it], x = document.createElement("button"); x.className = "item" + (def.good ? " good" : ""); x.disabled = !!st.used;
      x.innerHTML = `${def.icon}<span class="tip"><b>${esc(def.name)}</b>${esc(def.text)}</span>`; x.onclick = () => useItem(i, it); bar.appendChild(x);
    });
    if (!p.items.length) msg('<span class="muted small">Keine Items</span>');
  } else if (st.k === "branch") {
    msg(`Wähle deinen Weg – noch <b>${st.left}</b> ${st.left === 1 ? "Schritt" : "Schritte"}`);
    const dist = D.caseNode >= 0 ? WB.distTo(D.caseNode) : null;
    for (const to of st.opts) {
      G3.rings.push({ node: to, col: [1, 0.85, 0.3] });
      const b = document.createElement("button"); b.className = "go"; b.dataset.node = to;
      const n = N[to]; b.innerHTML = (n.t === "sea" ? "⛵" : "➜") + `<small>${n.t === "sea" ? "übers Meer · " : ""}${dist ? "🧳 " + (dist[to] + 1) + " Felder" : WB.CONTS[n.c] ? WB.CONTS[n.c].name : ""}</small>`;
      b.onclick = () => send({ t: "go", to }); $("#labels").appendChild(b);
    }
  } else if (st.k === "case") {
    prompt(`<h2>🧳 KOFFER GEFUNDEN!</h2><p>Öffnen für <b>${st.price} T-Coins</b>? Du bekommst den Stempel <b>„${esc(WB.CONTS[D.caseCont].name)}“</b> ${WB.CONTS[D.caseCont].icon}.</p>`,
      [["Koffer öffnen", () => send({ t: "case", buy: true }), "pri"], ["Weitergehen", () => send({ t: "case", buy: false }), "ghost"]]);
  } else if (st.k === "air") {
    const dist = D.caseNode >= 0 ? WB.distTo(D.caseNode) : null;
    const rows = WB.AIRPORTS.filter((a) => a !== p.pos).map((a) => [`✈ ${N[a].air} <small>${WB.CONTS[N[a].c].name}${dist ? " · 🧳 in " + dist[a] + " Feldern" : ""}</small>`, () => send({ t: "fly", to: a }), N[a].c === D.caseCont ? "gold" : ""]);
    prompt(`<h2>✈ FLUGHAFEN ${esc(N[p.pos].air.toUpperCase())}</h2><p>Für <b>${CFG.FLY_PRICE} T-Coins</b> zu einem anderen Flughafen fliegen? Dein Zug endet dort.${st.left ? ` Sonst läufst du noch ${st.left} ${st.left === 1 ? "Schritt" : "Schritte"} weiter.` : ""}</p>`,
      rows.concat([["Nicht fliegen", () => send({ t: "fly", to: null }), "ghost"]]), true);
  } else if (st.k === "buy") {
    prompt(`<h2>🚩 FREIES ZOLLFELD</h2><p>Für <b>${st.price} T-Coins</b> beanspruchen? Wer hier landet, muss dir etwas abgeben – du entscheidest, was:</p>`,
      [[`🪙 Zoll: ${CFG.TOLL} T-Coins`, () => send({ t: "buy", toll: "coin" }), "gold"], ["❤ Zoll: 1 Leben", () => send({ t: "buy", toll: "life" }), "pri"], ["Nein danke", () => send({ t: "buy", toll: null }), "ghost"]]);
  }
}
function prompt(html, btns, asList) {
  const box = $("#promptBox"); box.innerHTML = html; const r = document.createElement("div"); r.className = asList ? "list" : "row";
  for (const [label, fn, cls] of btns) { const b = document.createElement("button"); b.innerHTML = label; if (cls) b.className = cls; b.onclick = () => { show("#prompt", false); fn(); }; r.appendChild(b); }
  box.appendChild(r); show("#prompt", true);
}
function useItem(i, it) {
  const def = WB.ITEMS[it], back = ["Abbrechen", () => renderBar(), "ghost"];
  if (def.pick === "player") prompt(`<h2>${def.icon} ${esc(def.name.toUpperCase())}</h2><p>${esc(def.text)}</p>`, D.players.filter((p) => p.id !== me).map((p) => [`${esc(p.name)} <small>🪙 ${p.coins} · ❤ ${p.lives}</small>`, () => send({ t: "item", i, target: p.id })]).concat([back]), true);
  else if (def.pick === "value") prompt(`<h2>${def.icon} ${esc(def.name.toUpperCase())}</h2><p>${esc(def.text)}</p>`, [1, 2, 3, 4, 5, 6].map((v) => [String(v), () => send({ t: "item", i, v }), "gold"]).concat([back]));
  else if (def.pick === "airport") prompt(`<h2>${def.icon} ${esc(def.name.toUpperCase())}</h2><p>${esc(def.text)}</p>`, WB.AIRPORTS.filter((a) => a !== P(me).pos).map((a) => [`✈ ${N[a].air} <small>${WB.CONTS[N[a].c].name}</small>`, () => send({ t: "item", i, to: a }), N[a].c === D.caseCont ? "gold" : ""]).concat([back]), true);
  else send({ t: "item", i });
}

/* ---------- Lobby ---------- */
function stageLobby() {
  const k = G3.pos(WB.BOARD.start), others = D.players.filter((p) => p.id !== me);
  if (!G3.cam.free) G3.focus(k.x, k.z + 0.5, 3.1, 0.42);
  D.players.forEach((p) => {
    const c = G3.chars[p.id]; if (!c) return; c.busy = true; c.stage = true; c.vis = true; c.tilt = 0; c.y = 0; c.moving = false;
    if (p.id === me) { c.x = k.x; c.z = k.z + 0.95; c.scale = 1.5; c.rot = Math.sin(performance.now() / 1400) * 0.5; }
    else { const i = others.indexOf(p), n = others.length, a = n > 1 ? -1.1 + (2.2 * i) / (n - 1) : 0.5; c.x = k.x + Math.sin(a) * (n > 4 ? 1.15 : 0.85); c.z = k.z + 0.75 - Math.cos(a) * 0.75; c.scale = 1.05; c.rot = -a * 0.5; }
  });
}
function buildLookRows() {
  const box = $("#lookRows"); box.innerHTML = "";
  for (const key in G3.LOOKS) {
    const def = G3.LOOKS[key], row = document.createElement("div"); row.className = "pick";
    row.innerHTML = `<button>◀</button><div><small>${def.label}</small><span></span></div><button>▶</button>`;
    const upd = () => (row.querySelector("span").textContent = def.names[myLook[key]]);
    const step = (d) => { myLook[key] = (myLook[key] + d + def.names.length) % def.names.length; upd(); lookChanged(); };
    row.children[0].onclick = () => step(-1); row.children[2].onclick = () => step(1); row._upd = upd; upd(); box.appendChild(row);
  }
}
function lookChanged() {
  store.set("wb_look", JSON.stringify(myLook));
  const c = G3.chars[me]; if (c) c.look = clone(myLook);
  send({ t: "look", look: myLook });
}
function renderLobby() {
  const host = isHost();
  $("#lobbyCount").textContent = `(${D.players.length}/${CFG.MAX_PLAYERS})`;
  $("#lobbyPlayers").innerHTML = D.players.map((p) => `<div class="lp"><i style="background:${seatCol(p.id)}"></i><span>${p.bot ? "🤖 " : ""}${esc(p.name)}${p.id === me ? " (du)" : ""}</span>${p.id === D.hostId ? "👑" : ""}</div>`).join("");
  $("#stVal").textContent = D.set.stamps;
  $("#stMinus").disabled = !host || D.set.stamps <= 1; $("#stPlus").disabled = !host || D.set.stamps >= 7;
  $("#stHint").textContent = "Wer zuerst so viele Stempel hat, gewinnt. Jeder Kontinent hat genau einen Koffer – insgesamt gibt es also 7." + (host ? "" : " (Stellt der Host ein.)");
  show("#hostRow", host);
  const b = $("#btnStart"); b.disabled = !host; b.textContent = host ? "Reise starten" : "Warte auf den Host …";
  $("#inviteHint").innerHTML = mode === "tyjora" ? "Freunde lädst du in deiner Tyjora-Lobby ein – sie landen automatisch hier." : mode === "room" ? `Raum-Code: <b>${esc(roomCode)}</b> · <a href="#" id="copyLink" style="color:var(--mustard)">Link kopieren</a>` : "Solo-Modus: Du spielst gegen Bots (läuft komplett auf deinem Gerät).";
  const cl = $("#copyLink"); if (cl) cl.onclick = (e) => { e.preventDefault(); const link = location.origin + location.pathname + "?r=" + roomCode; (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => toast("Link kopiert"), () => toast(esc(link), 8000)); };
}

/* ---------- Ende ---------- */
function renderEnd() {
  const r = D.result; if (!r) return;
  const w = P(r.winner), rows = r.rank.map((x, i) => `<tr class="${x.p === me ? "me" : ""}"><td>${i + 1}.</td><td>${esc(P(x.p) ? P(x.p).name : "?")}</td><td class="r">${x.stamps} Stempel</td><td class="r">🪙 ${x.coins}</td></tr>`).join("");
  $("#endBox").innerHTML = `<div class="crown">👑</div><h2>${esc(w ? w.name.toUpperCase() : "")} GEWINNT!</h2><p>${w && w.stamps.length >= D.set.stamps ? "Der Reisepass ist voll." : "Alle Koffer sind geöffnet – die meisten Stempel zählen."}</p>
    <table class="res">${rows}</table><div class="row">${isHost() ? '<button class="pri" id="endLobby">Nochmal spielen</button>' : '<span class="muted">Der Host kann eine neue Runde starten.</span>'}<button class="ghost" id="endHome">Zurück zu Tyjora</button></div>`;
  const b = $("#endLobby"); if (b) b.onclick = () => send({ t: "lobby" });
  $("#endHome").onclick = () => (location.href = TYJORA);
  G3.turnId = null; show("#end", true);
}

/* ---------- Animationen zu den Ereignissen ---------- */
function showDice(e) {
  const box = $("#dice"); box.innerHTML = "";
  const ROT = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] }, PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const cubes = e.dice.map((v, i) => {
    const c = document.createElement("div"); c.className = "cube" + (e.kind === "gold" ? " gold" : "");
    for (let f = 1; f <= 6; f++) { const d = document.createElement("div"); d.className = "f f" + f; for (let k = 0; k < 9; k++) { const p = document.createElement("i"); if (PIPS[f].includes(k)) p.className = "on"; d.appendChild(p); } c.appendChild(d); }
    c.style.transform = `rotateX(${-200 - i * 60}deg) rotateY(${150 + i * 90}deg)`; box.appendChild(c); return [c, v];
  });
  show("#dice", true);
  requestAnimationFrame(() => requestAnimationFrame(() => cubes.forEach(([c, v], i) => (c.style.transform = `rotateX(${ROT[v][0] + 720}deg) rotateY(${ROT[v][1] + 720 + i * 360}deg)`))));
}
async function hop(c, to, ms) {
  const a = { x: c.x, z: c.z }, b = G3.pos(to), dx = b.x - a.x, dz = b.z - a.z;
  c.rot = Math.atan2(dx, dz); c.moving = true; c.sea = N[to].t === "sea";
  await tween(ms, (k) => { const q = ease(k); c.x = a.x + dx * q; c.z = a.z + dz * q; c.y = c.sea ? 0 : Math.sin(Math.PI * k) * 0.2; c.walk = k; c.sq = 1 + Math.sin(Math.PI * k) * 0.08; if (!G3.cam.free) G3.focus(c.x, c.z + 0.25); });
  c.y = 0; c.sq = 1; c.moving = false; c.node = to;
  if (!c.sea && !skip) G3.burst(c.x, G3.cy(c) + 0.02, c.z, "dust", 3);
}
async function pop(c, from, to, ms) { await tween(ms, (k) => (c.scale = from + (to - from) * ease(k))); }
function place(c, node) { const p = G3.pos(node); c.x = p.x; c.z = p.z; c.node = node; c.sea = false; }
function fx(id, kind, n) { const c = G3.chars[id]; if (c && n && !skip) G3.burst(c.x, G3.cy(c) + 0.35, c.z, kind, n); }
const CARD_ICON = { lotto: "🎰", found: "👛", tourist: "🧲", payall: "🍹", getall: "🎂", tp: "🧭", skip: "⏰", heal: "🧖", hurt: "🥵", item: "🛍️", swap: "🔀", again: "💨" };

const H = {
  async start() { G3.overview(); banner("DIE REISE BEGINNT", `Wer zuerst ${D.set.stamps} ${D.set.stamps === 1 ? "Stempel" : "Stempel"} hat, gewinnt`, 2000); await wait(1800); },
  async turn(e) {
    activeId = e.p; G3.turnId = e.p; renderPlayers();
    const c = G3.chars[e.p]; if (c) G3.focus(c.x, c.z + 0.25, 3.1, 0.95);
    if (e.p === me) banner(e.again ? "NOCHMAL!" : "DU BIST DRAN", "", 900); else if (e.again) toast(`💨 ${esc(nameOf(e.p))} darf nochmal`);
    await wait(550);
  },
  async skip(e) { toast(`💤 ${esc(nameOf(e.p))} ${e.p === me ? "setzt" : "setzt"} diese Runde aus`); const p = P(e.p); if (p) p.skip = Math.max(0, p.skip - 1); await wait(1100); },
  async item(e) {
    const def = WB.ITEMS[e.item], p = P(e.p);
    if (p) { const i = p.items.indexOf(e.item); if (i >= 0) p.items.splice(i, 1); renderPlayers(); }
    toast(`${def.icon} ${esc(nameOf(e.p))} ${e.p === me ? "benutzt" : "benutzt"} <b>${esc(def.name)}</b>${e.target ? " gegen " + esc(e.target === me ? "dich" : nameOf(e.target)) : ""}`, 3000);
    await wait(1400);
  },
  async roll(e) {
    if (skip) return;
    const c = G3.chars[e.p]; if (c && !G3.cam.free) G3.focus(c.x, c.z + 0.25, 3.1, 0.95);
    showDice(e); await wait(1650);
    const sum = e.dice.reduce((a, b) => a + b, 0);
    $("#diceSum").innerHTML = esc(nameOf(e.p)) + ": " + (e.slow ? `${sum} 🐌 → ${e.total}` : e.total); show("#diceSum", true);
    await wait(600); show("#dice", false); show("#diceSum", false);
  },
  async move(e) {
    const c = G3.chars[e.p]; if (!c) return; c.busy = true; c.stage = false; c.scale = 1;
    for (const to of e.path) await hop(c, to, 390);
    c.busy = false; c.sea = false; const p = P(e.p); if (p) p.pos = e.path[e.path.length - 1];
    renderTop(); await wait(200);
  },
  async coins(e) { const p = P(e.p); if (p) { p.coins = Math.max(0, p.coins + e.d); renderPlayers(); } floatText(e.p, (e.d > 0 ? "+" : "−") + Math.abs(e.d) + " 🪙", e.d > 0 ? "#E9C46A" : "#F4A261"); fx(e.p, "coin", e.d > 0 ? Math.min(12, e.d + 2) : 0); await wait(650); },
  async life(e) { const p = P(e.p); if (p) { p.lives = Math.max(0, Math.min(CFG.MAX_LIVES, p.lives + e.d)); renderPlayers(); } floatText(e.p, e.d > 0 ? "+" + e.d + " ❤" : "−" + -e.d + " 💔", e.d > 0 ? "#ff8fa3" : "#E76F51"); fx(e.p, e.d > 0 ? "heart" : "star", 6); await wait(650); },
  async got(e) { const def = WB.ITEMS[e.item], p = P(e.p); if (p && !e.full) { p.items.push(e.item); renderPlayers(); } toast(`🎁 ${esc(nameOf(e.p))}: ${def.icon} <b>${esc(def.name)}</b>${e.full ? " – Tasche voll, dafür T-Coins" : ""}`); await wait(700); },
  async card(e) {
    if (skip) return;
    $("#card .front").innerHTML = `<div class="small muted">GLÜCKSKARTE · ${esc(nameOf(e.p))}</div><div class="ico">${CARD_ICON[e.card.id] || "🍀"}</div><h2>${esc(e.card.title.toUpperCase())}</h2><div>${esc(e.card.text)}</div>`;
    const g = $("#card .gcard"); g.style.animation = "none"; void g.offsetWidth; g.style.animation = ""; show("#card", true);
    await wait(3900); show("#card", false);
  },
  async tp(e) { const c = G3.chars[e.p]; if (!c) return; c.busy = true; await pop(c, 1, 0, 300); place(c, e.to); G3.focusNode(e.to, 4); await wait(600); await pop(c, 0, 1, 300); c.busy = false; const p = P(e.p); if (p) p.pos = e.to; toast(`🧭 ${esc(nameOf(e.p))} ${e.p === me ? "bist" : "ist"} jetzt: ${esc(N[e.to].lm || WB.CONTS[N[e.to].c].name)}`); await wait(300); },
  async swap(e) {
    const a = G3.chars[e.a], b = G3.chars[e.b]; if (!a || !b) return; a.busy = b.busy = true;
    await Promise.all([pop(a, 1, 0, 300), pop(b, 1, 0, 300)]); const na = a.node, nb = b.node; place(a, nb); place(b, na);
    G3.focusNode(nb, 4); await wait(500); await Promise.all([pop(a, 0, 1, 300), pop(b, 0, 1, 300)]); a.busy = b.busy = false; await wait(200);
  },
  async buy(e) { D.owners[e.node] = { p: e.p, toll: e.toll }; ownersSig = ""; applyBake(); toast(`🚩 ${esc(nameOf(e.p))} ${e.p === me ? "beanspruchst" : "beansprucht"} ein Zollfeld (${e.toll === "life" ? "Zoll: 1 Leben" : "Zoll: " + CFG.TOLL + " T-Coins"})`); await wait(700); },
  async toll(e) { toast(`🚧 ${esc(nameOf(e.p))} ${e.p === me ? "zahlst" : "zahlt"} Zoll an ${esc(e.owner === me ? "dich" : nameOf(e.owner))}: ${e.kind === "life" ? "1 Leben" : e.amt ? e.amt + " T-Coins" : "keine Coins – 1 Leben"}`, 3000); await wait(1100); },
  async fly(e) {
    const c = G3.chars[e.p]; if (!c) return; c.busy = true;
    toast(`✈ ${esc(nameOf(e.p))} ${e.p === me ? "fliegst" : "fliegt"} nach <b>${esc(N[e.to].air)}</b>${e.free ? " (Freiflug)" : ""}`, 3200);
    if (skip) { place(c, e.to); c.busy = false; return; }
    const a = G3.pos(e.from), b = G3.pos(e.to), dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz), pl = G3.plane;
    Object.assign(pl, { on: true, x: a.x, y: a.y + 0.35, z: a.z, rot: Math.atan2(dx, dz), bank: 0, pitch: 0 }); c.fly = true;
    G3.focus(a.x, a.z + 0.3, 4.2, 0.95);
    await tween(450, (k) => { c.y = k * 0.3; c.scale = 1 - k; });
    await tween(2900, (k) => { const q = ease(k); pl.x = a.x + dx * q; pl.z = a.z + dz * q; pl.y = a.y + 0.35 + Math.sin(Math.PI * q) * Math.min(2.2, 0.6 + len * 0.18); pl.pitch = -Math.cos(Math.PI * q) * 0.35; pl.bank = Math.sin(k * 9) * 0.08;
      G3.focus(pl.x, pl.z + 0.4, 4.2 + Math.sin(Math.PI * q) * Math.min(5, len * 0.45), 0.95); });
    pl.on = false; place(c, e.to); c.y = 0; c.fly = false; const p = P(e.p); if (p) p.pos = e.to;
    G3.focusNode(e.to, 3.8); await pop(c, 0, 1, 350); c.busy = false; await wait(250);
  },
  async caseNo(e) { toast(e.p === me ? `🧳 Dir fehlen noch <b>${e.need} T-Coins</b> für den Koffer` : `🧳 ${esc(nameOf(e.p))} kann sich den Koffer nicht leisten`); await wait(700); },
  async stamp(e) {
    const p = P(e.p), c = G3.chars[e.p], co = G3.caseObj, cont = WB.CONTS[e.cont];
    if (p && !p.stamps.includes(e.cont)) p.stamps.push(e.cont);
    renderPlayers(); if (skip) { co.node = -1; return; }
    G3.focusNode(e.node, 3.2); if (c) c.cheer = true; fx(e.p, "confetti", 40);
    await tween(600, (k) => { co.y = k * 0.5; co.scale = 1 + k * 0.5; }); await tween(250, (k) => (co.scale = 1.5 * (1 - k))); co.node = -1; co.scale = 1; co.y = 0;
    let slots = ""; for (const k of WB.CONT_KEYS) { const has = p && p.stamps.includes(k); slots += `<div class="slot">${has ? `<div class="stamp${k === e.cont ? " new" : ""}" style="color:${WB.CONTS[k].color}"><div><b>${WB.CONTS[k].icon}</b>${esc(WB.CONTS[k].name)}</div></div>` : ""}</div>`; }
    $("#passport .scene").innerHTML = `<h2>${esc(nameOf(e.p).toUpperCase())} ${e.p === me ? "ÖFFNEST" : "ÖFFNET"} DEN KOFFER!</h2>
      <div class="pass"><div class="pages"><div class="pg"><div style="font-size:44px">${cont.icon}</div><div class="who">REISEPASS</div><div>${esc(p ? p.name : "")}</div><div class="small" style="margin-top:8px">Stempel <b>${e.count}</b> von ${D.set.stamps}</div></div>
      <div class="pg" style="grid-template-columns:repeat(3,1fr)">${slots}</div></div><div class="cover"><span>TYJORA<br>REISEPASS</span></div><div class="cover2"></div></div>
      <h2 style="color:var(--mustard);animation:tin .4s 2.4s both">NEUER STEMPEL: ${esc(cont.name.toUpperCase())}</h2>`;
    show("#passport", true); await wait(5600); show("#passport", false); if (c) c.cheer = false;
  },
  async caseSpawn(e) {
    D.caseNode = e.node; D.caseCont = e.cont; renderTop(); const co = G3.caseObj; co.node = e.node;
    if (skip) { co.scale = 1; co.y = 0; return; }
    G3.focusNode(e.node, 5.2); toast(`🧳 Ein Koffer ist aufgetaucht: <b>${esc(WB.CONTS[e.cont].name)}</b> ${WB.CONTS[e.cont].icon}`, 3200);
    co.scale = 0; await wait(500); await tween(700, (k) => { co.scale = ease(k); co.y = (1 - k) * (1 - k) * 2.2; }); co.y = 0; await wait(1100);
  },
  async ko(e) {
    const c = G3.chars[e.p], p = P(e.p); toast(`💥 ${esc(nameOf(e.p))} ${e.p === me ? "bist" : "ist"} K.O. – ${e.lost} T-Coins weg, einmal aussetzen`, 3600);
    if (p) { p.coins = Math.max(0, p.coins - e.lost); p.lives = CFG.START_LIVES; p.pos = e.to; p.skip++; renderPlayers(); }
    if (!c) return; c.busy = true; if (!G3.cam.free) G3.focus(c.x, c.z + 0.25, 3.4);
    await tween(450, (k) => (c.tilt = ease(k) * 1.5)); await wait(650); await pop(c, 1, 0, 300); c.tilt = 0; place(c, e.to); G3.focusNode(e.to, 3.8); await wait(300); await pop(c, 0, 1, 300); c.busy = false;
  },
  async mini(e) { if (skip) return; G3.turnId = null; activeId = null; renderPlayers(); await playMini(e); },
  async miniEnd(e) {
    if (skip) { show("#mini", false); return; }
    const g = WB.MINIGAMES[e.game];
    const rows = e.rows.map((r, i) => `<tr class="${r.p === me ? "me" : ""}"><td>${i + 1}.</td><td>${esc(P(r.p) ? P(r.p).name : "?")}</td><td class="r">${esc(MINI[e.game].result(r.score))}</td><td class="r">+${r.coins} 🪙</td><td class="r">${r.item ? WB.ITEMS[r.item].icon : ""}</td></tr>`).join("");
    $("#miniPlace").textContent = "Ergebnis"; $("#miniName").textContent = g.name.toUpperCase(); $("#miniText").textContent = "";
    $("#miniStage").innerHTML = `<table class="res">${rows}</table><p class="small muted">Platz 1 bekommt ein starkes Item, Platz 2 und 3 ein kleines.</p>`;
    show("#mini", true); await wait(6000); show("#mini", false);
  },
  async end(e) { G3.overview(); for (let i = 0; i < 4; i++) { fx(e.winner, "confetti", 30); await wait(250); } const c = G3.chars[e.winner]; if (c) c.cheer = true; },
  async lobby() {},
};
function applyBake() { G3.bake(D.owners, (id) => { const p = P(id); return p ? p.seat : 0; }); ownersSig = JSON.stringify(D.owners) + "|" + D.players.map((p) => p.id + p.seat).join(); }

async function run() {
  if (running) return; running = true; renderBar();
  while (queue.length) {
    const e = queue.shift(); skip = queue.length > 45 || document.hidden;
    try { if (e.e === "sync") applySync(e.s); else if (H[e.e]) await H[e.e](e); } catch (err) { console.error(err); }
  }
  running = false; skip = false;
  if (D) { for (const p of D.players) { const c = G3.chars[p.id]; if (c && D.phase !== "lobby") { c.busy = false; c.scale = 1; c.tilt = 0; c.vis = true; if (D.phase !== "end") c.cheer = false; if (c.node !== p.pos) place(c, p.pos); } } G3.caseObj.node = D.phase === "lobby" ? -1 : D.caseNode; G3.caseObj.scale = 1; G3.caseObj.y = 0; G3.plane.on = false; }
  render();
}

/* ---------- Minispiele (Oberfläche) ----------
   Neues Minispiel: in engine.js unter MINIGAMES eintragen und hier die Oberfläche ergänzen.
   run(stage, dauerMs) liefert die Punktzahl (höher = besser).                            */
const MINI = {
  sushi: {
    text: "Rolle so viele Sushi wie möglich! Hämmere auf den Knopf (oder die Leertaste) – 4 Mal drücken = 1 Rolle.",
    result: (s) => Math.floor(s / 4) + " Rollen",
    run(stage, dur) {
      return new Promise((res) => {
        let n = 0; stage.innerHTML = `<div class="timebar"><i></i></div><div class="mat"><div class="roll"></div></div><div class="sushi"></div><button class="big" style="width:140px;height:140px">ROLLEN!<br>🍣</button><div class="syn" style="font-size:20px">0 Rollen</div>`; const roll = stage.querySelector(".roll");
        const bar = stage.querySelector(".timebar i"), row = stage.querySelector(".sushi"), cnt = stage.lastChild, btn = stage.querySelector(".big");
        bar.style.transition = `width ${dur}ms linear`; requestAnimationFrame(() => (bar.style.width = "0%"));
        const tap = () => { n++; roll.style.transform = `rotate(${n * 45}deg) scale(${1 + (n % 4) * 0.05})`; if (n % 4 === 0) { cnt.textContent = n / 4 + " Rollen"; if (n / 4 <= 26) row.textContent += ["🍣", "🍙", "🍱"][(n / 4) % 3]; } };
        const key = (e) => { if (e.code === "Space" && !e.repeat) { e.preventDefault(); tap(); btn.classList.add("hit"); } };
        btn.addEventListener("pointerdown", (e) => { e.preventDefault(); tap(); }); addEventListener("keydown", key);
        setTimeout(() => { removeEventListener("keydown", key); res(n); }, dur);
      });
    },
  },
  reflex: {
    text: "Dein Taxi steht an der Ampel. Sobald sie GRÜN wird: sofort klicken! Wer zu früh losfährt, ist raus.",
    result: (s) => (s <= 1 ? "–" : 2000 - s + " ms"),
    run(stage, dur) {
      return new Promise((res) => {
        stage.innerHTML = `<div class="light" style="width:90px;height:90px"></div><div class="syn" style="font-size:18px">WARTE …</div><div class="road"><span class="taxi">🚕</span></div><button class="big" style="width:120px;height:120px">GAS!</button>`; const road = stage.querySelector(".road");
        const light = stage.querySelector(".light"), txt = stage.children[1], btn = stage.querySelector(".big");
        let t0 = 0, done = false; const delay = 1400 + Math.random() * (dur - 4200);
        const fin = (score, label) => { if (done) return; done = true; txt.textContent = label; removeEventListener("keydown", key); setTimeout(() => res(score), 900); };
        const go = setTimeout(() => { if (done) return; light.classList.add("go"); txt.textContent = "LOS!"; t0 = performance.now(); }, delay);
        const hit = () => { if (done) return; if (!t0) { clearTimeout(go); fin(1, "ZU FRÜH! 🙈"); } else { const ms = Math.round(performance.now() - t0); road.classList.add("go"); fin(Math.max(2, 2000 - ms), ms + " MS"); } };
        const key = (e) => { if (e.code === "Space" && !e.repeat) { e.preventDefault(); hit(); } };
        btn.addEventListener("pointerdown", (e) => { e.preventDefault(); hit(); }); addEventListener("keydown", key);
        setTimeout(() => fin(1, "ZU LANGSAM …"), dur - 950);
      });
    },
  },
};
async function playMini(e) {
  const g = WB.MINIGAMES[e.game], ui = MINI[e.game], stage = $("#miniStage");
  $("#miniPlace").textContent = "Minispiel · " + g.place + " (" + WB.CONTS[g.cont].name + ")"; $("#miniName").textContent = g.name.toUpperCase(); $("#miniText").textContent = ui.text;
  show("#prompt", false); show("#mini", true);
  for (const n of ["3", "2", "1"]) { stage.innerHTML = `<div id="miniCount">${n}</div>`; await wait(1150); }
  const score = await ui.run(stage, g.dur);
  send({ t: "score", v: score });
  stage.innerHTML = `<div class="syn" style="font-size:20px">${esc(ui.result(score))}</div><p class="muted">Warte auf die anderen …</p>`;
}

/* ---------- Nachrichten vom Server ---------- */
function deliver(m) {
  if (m.t === "hello") {
    me = m.you; queue = []; show("#status", false); show("#home", false); show("#roomOv", false);
    applySync(m.s);
    if (D.phase !== "lobby") { const c = G3.chars[me]; if (c) G3.focus(c.x, c.z + 0.25, 3.1, 0.95); }
    const mp = P(me); if (mp && D.phase === "lobby" && JSON.stringify(mp.look) !== JSON.stringify(myLook)) send({ t: "look", look: myLook });
  } else if (m.t === "u") { if (D && D.phase === "lobby" && m.s.phase !== "lobby" && !queue.length) queue.push({ e: "sync", s: m.s }); for (const e of m.ev) queue.push(e); queue.push({ e: "sync", s: m.s }); run(); }
  else if (m.t === "err") toast("⚠ " + esc(m.m));
  else if (m.t === "refuse") { refused = true; status("NICHT VERBUNDEN", esc(m.m), [["Neu laden", () => location.reload()], ["Zu Tyjora", () => (location.href = TYJORA), "ghost"]]); }
}

/* ---------- Verbindung: Server ---------- */
let ws = null, refused = false, retry = 0, pingT = 0;
function connect(room, id, name, host) {
  roomCode = room; refused = false;
  let key = store.get("wb_key"); if (!key) { key = rid(12); store.set("wb_key", key); }
  const q = new URLSearchParams({ room, id, name, key, host: host || "", look: JSON.stringify(myLook) });
  const open = () => {
    const sock = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws?" + q); ws = sock;
    sock.onopen = () => { retry = 0; clearInterval(pingT); pingT = setInterval(() => { try { sock.send('{"t":"ping"}'); } catch {} }, 25000); };
    sock.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } deliver(m); };
    sock.onclose = () => { if (ws !== sock || refused) return; clearInterval(pingT); retry++;
      status("VERBINDUNG VERLOREN", "Verbinde neu …", [["Zu Tyjora", () => (location.href = TYJORA), "ghost"]]); setTimeout(open, Math.min(8000, 800 * retry)); };
  };
  conn = { send(a) { try { ws.send(JSON.stringify(a)); } catch {} } };
  status("WELTENBUMMLER", "Verbinde mit dem Spiel …"); open();
}

/* ---------- Verbindung: lokal gegen Bots (auch offline) ---------- */
function startLocal() {
  mode = "solo";
  const S = WB.newGame("me"); WB.join(S, "me", store.get("wb_name") || "Du", myLook);
  for (let i = 0; i < 3; i++) WB.apply(S, "me", { t: "bot" }, Date.now());
  const out = (ev) => setTimeout(() => deliver({ t: "u", ev, s: clone(S) }), 0);
  conn = { send(a) { delete a.auto; const r = WB.apply(S, "me", a, Date.now()); if (r.err) deliver({ t: "err", m: r.err }); else out(r.ev); } };
  setInterval(() => { const r = WB.tick(S, Date.now()); if (r) out(r.ev); }, 200);
  if (new URLSearchParams(location.search).has("test")) window.__S = S;   // nur zum Testen
  deliver({ t: "hello", you: "me", s: clone(S) });
}

/* ---------- Einstieg ---------- */
async function startTyjora(lobby, room, host) {
  mode = "tyjora";
  status("WELTENBUMMLER", "Verbinde mit deiner Tyjora-Lobby …");
  const guest = () => { show("#status", false); openRoomDialog(room); };
  try {
    const r = await fetch(TYJORA + "/api/lobby/" + encodeURIComponent(lobby), { credentials: "include", headers: { Accept: "application/json" } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.me) throw new Error(d.error || "Du bist nicht angemeldet oder nicht in dieser Lobby.");
    connect(room, "t" + d.me.id, d.me.username, "t" + (host || (d.lobby && d.lobby.hostId) || ""));
  } catch (err) {
    status("LOBBY NICHT GEFUNDEN", esc(err && err.message && !/fetch|network|load/i.test(err.message) ? err.message : "Die Tyjora-Lobby konnte nicht geprüft werden.") + "<br><span class='small muted'>Öffne das Spiel am besten über deine Lobby auf Tyjora.</span>",
      [["Zu Tyjora", () => (location.href = TYJORA)], ["Mit Namen beitreten", guest, "ghost"]]);
  }
}
function openRoomDialog(fixedCode) {
  $("#roomName").value = store.get("wb_name") || ""; $("#roomCode").value = fixedCode || ""; $("#roomCode").disabled = !!fixedCode; $("#roomErr").textContent = "";
  show("#home", false); show("#roomOv", true); setTimeout(() => $("#roomName").focus(), 100);
}
$("#roomGo").onclick = async () => {
  const name = $("#roomName").value.trim(); let code = $("#roomCode").value.trim().toUpperCase();
  if (name.length < 2) { $("#roomErr").textContent = "Bitte gib einen Namen ein (mind. 2 Zeichen)."; return; }
  if (code && !/^[A-Z0-9-]{4,16}$/.test(code)) { $("#roomErr").textContent = "Der Code besteht aus 4–8 Buchstaben/Zahlen."; return; }
  store.set("wb_name", name);
  if (location.protocol === "file:") { $("#roomErr").textContent = "Räume gibt es nur online – lokal geht der Solo-Modus."; return; }
  if (!code) { try { code = (await (await fetch("/api/room/new")).json()).code; } catch { $("#roomErr").textContent = "Der Server ist nicht erreichbar."; return; } }
  let id = store.get("wb_id"); if (!id) { id = "g" + rid(8); store.set("wb_id", id); }
  if (mode !== "tyjora") { mode = "room"; history.replaceState(null, "", location.pathname + "?r=" + code); }
  show("#roomOv", false); connect(code, id, name, "");
};
$("#roomCancel").onclick = () => { show("#roomOv", false); if (mode === "tyjora") location.href = TYJORA; else show("#home", true); };
$("#hSolo").onclick = () => { show("#home", false); startLocal(); };
$("#hRoom").onclick = () => openRoomDialog("");
$("#hTyjora").onclick = () => (location.href = TYJORA + "/?create=" + GAME_ID);
$("#hBack").onclick = () => (location.href = TYJORA);

/* ---------- Knöpfe ---------- */
$("#stMinus").onclick = () => send({ t: "set", stamps: D.set.stamps - 1 });
$("#stPlus").onclick = () => send({ t: "set", stamps: D.set.stamps + 1 });
$("#btnBotAdd").onclick = () => send({ t: "bot" });
$("#btnBotDel").onclick = () => send({ t: "bot", remove: true });
$("#btnStart").onclick = () => send({ t: "start" });
$("#btnRandom").onclick = () => { for (const k in WB.LOOK_MAX) myLook[k] = Math.floor(Math.random() * WB.LOOK_MAX[k]); for (const r of $("#lookRows").children) r._upd(); lookChanged(); };
$("#btnLeave").onclick = () => { if (mode === "tyjora") location.href = TYJORA; else location.href = location.pathname; };
$("#btnRules").onclick = $("#btnRules2").onclick = () => show("#rules", true);
for (const b of document.querySelectorAll("[data-close]")) b.onclick = () => show("#" + b.dataset.close, false);
let mapOn = false;
$("#btnMap").onclick = () => { mapOn = !mapOn; if (mapOn) G3.overview(); else { const c = G3.chars[activeId || me]; if (c) G3.focus(c.x, c.z + 0.25, 3.1, 0.95); } };
$("#caseChip").onclick = () => { if (D && D.caseNode >= 0) G3.focusNode(D.caseNode, 5); };
addEventListener("keydown", (e) => { if (e.code === "Space" && myTurn() && D.step && D.step.k === "pre" && !running && !queue.length && $("#mini").classList.contains("hide")) { e.preventDefault(); send({ t: "roll" }); } });
document.addEventListener("visibilitychange", () => { if (!document.hidden && queue.length > 20) skip = true; });

buildLookRows();
G3.init($("#gl")).then(() => {
  requestAnimationFrame(loop);
  const q = new URLSearchParams(location.search);
  const lobby = (q.get("lobby") || "").toUpperCase(), room = (q.get("room") || "").toUpperCase(), r = (q.get("r") || "").toUpperCase();
  G3.overview(); G3.cam.dist = G3.cam.td;
  if (/^[A-Z0-9]{4,8}$/.test(lobby) && /^[A-Z0-9-]{4,16}$/.test(room)) startTyjora(lobby, room, q.get("host") || "");
  else if (/^[A-Z0-9-]{4,16}$/.test(r)) { show("#status", false); openRoomDialog(r); }
  else if (q.has("solo") || location.protocol === "file:") { show("#status", false); startLocal(); }
  else { show("#status", false); show("#home", true); }
}).catch((err) => status("FEHLER", esc(err.message || String(err)), [["Zu Tyjora", () => (location.href = TYJORA)]]));
})();
