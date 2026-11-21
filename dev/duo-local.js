// Lokalny serwer deweloperski Tajniaków we dwoje (duo.html?local=1): ta sama klasa TjDuo co na Cloudflare, uruchomiona w SharedWorkerze
// z atrapą ctx. Importuje kod serwera z sąsiedniego repo pl3y-server, więc trzeba serwować folder nadrzędny (dev/serve-duo.ps1, port 8094).
// Stan żyje, dopóki otwarta jest choć jedna karta.
import { TjDuo } from '/pl3y-server/src/games/tajniacy/duo.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();          // code -> { room, run, sockets }
const conns = new Map();          // `${portId}:${cid}` -> FakeWS
let portSeq = 0;

function memStorage(onAlarm) {
  const store = new Map(); let timer = null;
  return {
    get: async k => (store.has(k) ? structuredClone(store.get(k)) : undefined),
    put: async (k, v) => { store.set(k, structuredClone(v)); },
    deleteAll: async () => store.clear(),
    setAlarm: async at => { clearTimeout(timer); timer = setTimeout(onAlarm, Math.max(0, Math.min(at - Date.now(), 2 ** 31 - 1))); },
  };
}

class FakeWS {
  constructor(port, cid, room) { this.port = port; this.cid = cid; this.room = room; this.open = true; this.att = null; this.seen = Date.now(); }
  send(data) { if (this.open) this.port.postMessage({ t: 'msg', cid: this.cid, data }); }
  close(code, reason) { if (!this.open) return; this.open = false; this.port.postMessage({ t: 'close', cid: this.cid, code, reason }); }
  serializeAttachment(a) { this.att = structuredClone(a); }
  deserializeAttachment() { return this.att == null ? null : structuredClone(this.att); }
}

function makeRoom() {
  const sockets = new Set();
  let queue = Promise.resolve();
  const run = fn => (queue = queue.then(fn).catch(e => console.error(e)));
  const holder = {};
  const ctx = {
    storage: memStorage(() => run(() => holder.room.alarm())),
    acceptWebSocket: ws => sockets.add(ws),
    getWebSockets: () => [...sockets].filter(w => w.open),
    setWebSocketAutoResponse() {},
  };
  holder.room = new TjDuo(ctx, {});
  return { room: holder.room, run, sockets };
}

function newCode() {
  let c;
  do { c = Array.from(crypto.getRandomValues(new Uint8Array(5)), x => ALPHABET[x % 32]).join(''); } while (rooms.has(c));
  return c;
}

function closeConn(key) {
  const ws = conns.get(key);
  if (!ws) return;
  conns.delete(key);
  ws.open = false;
  const r = rooms.get(ws.room);
  if (r) { r.sockets.delete(ws); r.run(() => r.room.webSocketClose(ws)); }
}

setInterval(() => {
  const now = Date.now();
  for (const [key, ws] of conns) if (now - ws.seen > 12000) { ws.close(1006, 'timeout'); closeConn(key); }
}, 3000);

async function api({ method, path }) {
  if (path === '/api/tj/duo/rooms' && method === 'POST') {
    const code = newCode(); const r = makeRoom(); rooms.set(code, r);
    return { status: 200, json: await r.room.init(code) };
  }
  return { status: 404, json: null };
}

onconnect = e => {
  const port = e.ports[0];
  const pid = ++portSeq;
  port.onmessage = async ({ data: m }) => {
    const key = `${pid}:${m.cid}`;
    if (m.t === 'api') {
      port.postMessage({ rid: m.rid, ...(await api(m.body)) });
    } else if (m.t === 'connect') {
      const code = String(m.code || '').toUpperCase();
      const r = rooms.get(code);
      const ws = new FakeWS(port, m.cid, code);
      conns.set(key, ws);
      port.postMessage({ t: 'open', cid: m.cid });
      if (!r) {
        ws.send(JSON.stringify({ t: 'error', code: 'noroom', err: 'Taki pokój nie istnieje (lokalny serwer: pokoje znikają po zamknięciu wszystkich kart).' }));
        ws.close(4404, 'noroom'); conns.delete(key);
        return;
      }
      r.run(async () => { r.sockets.add(ws); r.room.attach(ws, await r.room.load()); });
    } else if (m.t === 'send') {
      const ws = conns.get(key);
      if (!ws || !ws.open) return;
      ws.seen = Date.now();
      const r = rooms.get(ws.room);
      r.run(() => r.room.webSocketMessage(ws, m.data));
    } else if (m.t === 'close') closeConn(key);
  };
  port.start();
};
