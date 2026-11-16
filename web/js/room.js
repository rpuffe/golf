// Room networking: create/join a room by code, an SSE stream that resyncs
// from a full snapshot on every (re)connect, and an ordered, retrying send
// queue. Only one send is in flight at a time, so a progress update can never
// overtake the shot it follows, and every message carries a sequence number
// so a retry after a lost response is harmless (the server drops repeats).

const CRED_KEY = 'ghg3d_room';
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class RoomClient {
  constructor(handlers) {
    this.h = handlers;           // onState, onShot, onProgress, onStart, onEmote, onConn, onClosed
    this.code = null; this.id = null; this.token = null; this.state = null;
    this.queue = []; this.sending = false;
    // Increasing across page reloads too (the server keeps the last seq per member).
    this.seqBase = Date.now() * 100; this.seqN = 0;
    this.es = null; this.connected = false; this.closed = false; this.rejoinTries = 0;
  }

  static saved() { try { return JSON.parse(sessionStorage.getItem(CRED_KEY) || 'null'); } catch { return null; } }
  static forget() { try { sessionStorage.removeItem(CRED_KEY); } catch { /* storage blocked */ } }

  create(name) { return this._join('/api/rooms', { name }); }
  join(code, name, { takeover = false } = {}) {
    code = String(code).trim().toUpperCase();
    const body = { name };
    if (takeover) body.takeover = true;
    const s = RoomClient.saved();
    if (s && s.code === code) { body.id = s.id; body.token = s.token; }
    return this._join(`/api/rooms/${encodeURIComponent(code)}/join`, body);
  }

  async _join(url, body) {
    let r;
    try { r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch { throw new Error("Can't reach the server"); }
    if (!r.ok) {
      const taken = r.status === 409 && /name taken/.test(await r.text().catch(() => ''));
      const msg = taken ? 'Someone with that name is already here' : r.status === 404 ? 'No room with that code' : r.status === 409 ? 'That room is full' : r.status === 503 ? 'Too many rooms right now, try again soon' : 'Could not join the room';
      const e = new Error(msg); e.status = r.status; e.nameTaken = taken; throw e;
    }
    const st = await r.json();
    this.code = st.code; this.id = st.you; this.token = st.token; this.closed = false;
    try { sessionStorage.setItem(CRED_KEY, JSON.stringify({ code: st.code, id: st.you, token: st.token })); } catch { /* storage blocked */ }
    this.state = st;
    this.h.onState?.(st);
    this.connect();
    return st;
  }

  connect() {
    this.es?.close();
    const es = this.es = new EventSource(`/api/rooms/${this.code}/events?id=${encodeURIComponent(this.id)}&token=${encodeURIComponent(this.token)}`);
    const on = (name, fn) => es.addEventListener(name, ev => { let d; try { d = JSON.parse(ev.data); } catch { return; } fn(d); });
    on('roster', st => { this.state = st; this.rejoinTries = 0; this._conn(true); this.h.onState?.(st); });
    on('shot', d => this.h.onShot?.(d));
    on('progress', d => this.h.onProgress?.(d));
    on('start', d => this.h.onStart?.(d));
    on('emote', d => this.h.onEmote?.(d));
    es.onerror = () => {
      this._conn(false);
      // CONNECTING = the browser is already retrying. CLOSED = the server
      // answered with an error (room gone, or a proxy error mid-deploy).
      if (es.readyState === EventSource.CLOSED && this.es === es) this._rejoin();
    };
  }

  async _rejoin() {
    if (this.closed) return;
    this.rejoinTries++;
    if (this.rejoinTries > 6) { this._close('Lost the room connection'); return; }
    await sleep(Math.min(8000, 700 * 2 ** this.rejoinTries));
    if (this.closed) return;
    try { await this._join(`/api/rooms/${this.code}/join`, { name: this.h.name?.() ?? 'Player', id: this.id, token: this.token }); }
    catch (e) { if (e.status === 404) this._close('The room has closed'); else if (e.nameTaken) this._close('You rejoined from another tab'); else this._rejoin(); }
  }

  _conn(on) { if (on !== this.connected) { this.connected = on; this.h.onConn?.(on); } }
  _close(why) {
    this.closed = true; this.es?.close(); this.es = null; this._conn(false);
    RoomClient.forget();
    this.h.onClosed?.(why);
  }

  // Queue a message; resolves with the server's JSON reply (start) or null.
  send(msg) {
    if (!this.code || this.closed) return Promise.resolve(null);
    return new Promise(resolve => {
      this.queue.push({ body: { ...msg, id: this.id, token: this.token, seq: this.seqBase + (++this.seqN) }, resolve });
      this._pump();
    });
  }

  async _pump() {
    if (this.sending) return;
    this.sending = true;
    while (this.queue.length) {
      const item = this.queue[0];
      let out = null, delay = 350;
      for (let attempt = 0; attempt < 7; attempt++) {
        try {
          const r = await fetch(`/api/rooms/${this.code}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item.body) });
          if (r.ok) { out = r.status === 200 ? await r.json().catch(() => null) : null; break; }
          if (r.status >= 400 && r.status < 500) break;   // stale round / bad message: retrying won't help
        } catch { /* network blip: retry */ }
        await sleep(delay); delay = Math.min(4000, delay * 2);
      }
      this.queue.shift();
      item.resolve(out);
    }
    this.sending = false;
  }

  async leave() {
    const code = this.code;
    if (code && !this.closed) {
      const body = JSON.stringify({ type: 'leave', id: this.id, token: this.token, seq: this.seqBase + (++this.seqN) });
      try { navigator.sendBeacon?.(`/api/rooms/${code}/send`, new Blob([body], { type: 'application/json' })) || fetch(`/api/rooms/${code}/send`, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }); } catch { /* best effort */ }
    }
    this.closed = true; this.es?.close(); this.es = null; this.code = null; this.queue = [];
    RoomClient.forget();
  }
}
