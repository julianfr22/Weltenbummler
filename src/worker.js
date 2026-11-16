/* =====================================================================
   WELTENBUMMLER – Spiel-Server (Cloudflare Worker + Durable Object)

   Jede Spielrunde hat einen eigenen Raum (Durable Object "Room").
   Der Raum kennt den Spielstand, prüft jede Aktion mit der Engine
   (public/engine.js – derselbe Code wie im Browser) und schickt das
   Ergebnis an alle Mitspieler.

   Adressen:
     /ws?room=…&id=…&name=…&key=…&host=…   WebSocket eines Spielers
     /api/room/new                          Code für einen privaten Raum
     /version                               für den Update-Hinweis im Spiel
   Alles andere: Dateien aus dem Ordner "public".
   ===================================================================== */
import "../public/engine.js";
const WB = globalThis.WB;

const VERSION = "1.1";
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;      // leere Räume werden nach 3 Stunden gelöscht

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/version") return new Response(VERSION, { headers: { "Cache-Control": "no-store" } });

    if (url.pathname === "/api/room/new") {
      const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      let code = ""; for (const b of crypto.getRandomValues(new Uint8Array(5))) code += abc[b % abc.length];
      return json({ code });
    }

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("WebSocket erwartet", { status: 426 });
      const room = (url.searchParams.get("room") || "").toUpperCase();
      if (!/^[A-Z0-9-]{4,16}$/.test(room)) return new Response("Ungültiger Raum", { status: 400 });
      return env.ROOM.get(env.ROOM.idFromName("room-" + room)).fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};

export class Room {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; this.S = null; this.keys = null; }

  async load() {
    if (this.S) return;
    this.S = (await this.ctx.storage.get("game")) || null;
    this.keys = (await this.ctx.storage.get("keys")) || {};
  }
  async save() {
    await this.ctx.storage.put("game", this.S);
    await this.ctx.storage.put("seen", Date.now());
    const at = this.S.wake || 0;
    await this.ctx.storage.setAlarm(at ? Math.max(at, Date.now() + 50) : Date.now() + ROOM_TTL_MS);
  }
  sockets() { return this.ctx.getWebSockets(); }
  idOf(ws) { const a = ws.deserializeAttachment(); return a && a.id; }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch {} }
  broadcast(msg) { const s = JSON.stringify(msg); for (const ws of this.sockets()) { try { ws.send(s); } catch {} } }

  async fetch(request) {
    const url = new URL(request.url), q = url.searchParams;
    const id = (q.get("id") || "").slice(0, 64), key = (q.get("key") || "").slice(0, 64);
    const name = q.get("name") || "Spieler", host = (q.get("host") || "").slice(0, 64);
    const pair = new WebSocketPair(), client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server);
    const refuse = (m) => { this.send(server, { t: "refuse", m }); server.close(4000, "refuse"); return new Response(null, { status: 101, webSocket: client }); };
    if (!id || key.length < 8) return refuse("Verbindung unvollständig – bitte Seite neu laden.");

    await this.load();
    if (!this.S) { this.S = WB.newGame(host || id); this.S.t0 = Date.now(); }
    // Jeder Platz gehört dem Browser, der ihn zuerst belegt hat (Schlüssel liegt nur dort)
    if (this.keys[id] && this.keys[id] !== key) return refuse("Dieser Platz ist schon von einem anderen Gerät belegt.");
    let look = null; try { look = JSON.parse(q.get("look") || "null"); } catch {}
    const r = WB.join(this.S, id, name, look);
    if (!r.ok) return refuse(r.err);
    // Der Host aus der Tyjora-Lobby ist nach 30 s nicht aufgetaucht → der erste Mensch im Raum übernimmt
    if (this.S.phase === "lobby" && !this.S.players.some((p) => p.id === this.S.hostId) && Date.now() - (this.S.t0 || 0) > 30000) {
      const h = this.S.players.find((p) => !p.bot); if (h) this.S.hostId = h.id;
    }
    if (!this.keys[id]) { this.keys[id] = key; await this.ctx.storage.put("keys", this.keys); }

    // alte Verbindung desselben Spielers (zweiter Tab) schliessen
    for (const ws of this.sockets()) if (ws !== server && this.idOf(ws) === id) { this.send(ws, { t: "refuse", m: "Du hast das Spiel in einem anderen Tab geöffnet." }); try { ws.close(4001, "replaced"); } catch {} }
    server.serializeAttachment({ id });

    this.send(server, { t: "hello", you: id, s: this.S, v: VERSION });
    this.broadcast({ t: "u", ev: [], s: this.S });
    await this.save();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    let a; try { a = JSON.parse(raw); } catch { return; }
    if (!a || typeof raw !== "string" || raw.length > 2000) return;
    if (a.t === "ping") { this.send(ws, { t: "pong" }); return; }
    const id = this.idOf(ws); if (!id) return;
    await this.load(); if (!this.S) return;
    delete a.auto;                                    // nur der Server darf "automatisch gezogen" setzen
    const r = WB.apply(this.S, id, a, Date.now());
    if (r.err) { this.send(ws, { t: "err", m: r.err }); return; }
    this.broadcast({ t: "u", ev: r.ev, s: this.S });
    await this.save();
  }

  async webSocketClose(ws) { await this.gone(ws); }
  async webSocketError(ws) { await this.gone(ws); }
  async gone(ws) {
    const id = this.idOf(ws); if (!id) return;
    await this.load(); if (!this.S) return;
    if (this.sockets().some((o) => o !== ws && this.idOf(o) === id)) return;   // noch mit anderem Tab verbunden
    WB.leave(this.S, id);
    if (this.S.phase === "play" && this.S.order[this.S.turn] === id) this.S.wake = Date.now() + 2500;   // nicht auf Abwesende warten
    this.broadcast({ t: "u", ev: [], s: this.S });
    await this.save();
  }

  async alarm() {
    await this.load();
    if (!this.S) return;
    const now = Date.now();
    if (!this.sockets().length) {
      const seen = (await this.ctx.storage.get("seen")) || 0;
      if (now - seen >= ROOM_TTL_MS - 1000) { await this.ctx.storage.deleteAll(); this.S = null; return; }
      await this.ctx.storage.setAlarm(seen + ROOM_TTL_MS);       // niemand da: Spiel pausiert
      return;
    }
    const r = WB.tick(this.S, now);
    if (r) this.broadcast({ t: "u", ev: r.ev, s: this.S });
    await this.ctx.storage.put("game", this.S);
    const at = this.S.wake || 0;
    await this.ctx.storage.setAlarm(at ? Math.max(at, Date.now() + 50) : Date.now() + ROOM_TTL_MS);
  }
}
