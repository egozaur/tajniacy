/* Połączenie z serwerem PL3Y (Cloudflare Worker, repo pl3y-server): pokój Tajniaków przez WebSocket
   i wspólna lista zapisów przez HTTP. Okrojona wersja Conn z klienta Mafii (mafia/js/net.js) (zwykły skrypt, bez modułów). */
(function(){
  const API='https://pl3y-server.pl3y.workers.dev';

// Token sesji PL3Y: wydaje go serwer po podaniu hasła w bramce (/auth.js), tu tylko go odczytujemy.
// Do zapytań HTTP idzie nagłówkiem Authorization, do WebSocketu parametrem ?tok= (przeglądarka nie ustawi nagłówka).
const plToken = () => { try { const t = localStorage.getItem('pl3y_token'); return t && Number(localStorage.getItem('pl3y_token_exp')) > Date.now() ? t : ''; } catch (e) { return ''; } };
const authHead = (h = {}) => { const t = plToken(); return t ? { ...h, Authorization: 'Bearer ' + t } : h; };
const wsTok = () => { const t = plToken(); return t ? '?tok=' + encodeURIComponent(t) : ''; };
// Serwer odrzucił sesję (401): pokaż bramkę hasła.
const onAuthFail = r => { if (r.status === 401 && window.PL3Y && window.PL3Y.expired) window.PL3Y.expired(); };

  class Conn{
    // opts: { code, hello: () => object, onMessage(msg), onStatus(status) }
    constructor(opts){
      this.o=opts; this.ws=null; this.status=''; this.retry=0; this.lastMsg=0; this.stopped=false;
      this.connect();
      this.beat=setInterval(()=>this.heartbeat(),15000);
      addEventListener('online',()=>this.kick());
      document.addEventListener('visibilitychange',()=>{ if(!document.hidden) this.kick(); });
    }
    setStatus(s){ if(this.status!==s){ this.status=s; this.o.onStatus&&this.o.onStatus(s); } }
    connect(){
      if(this.stopped) return;
      this.setStatus(this.retry?'reconnecting':'connecting');
      let ws;
      try{ ws=new WebSocket(API.replace(/^http/,'ws')+'/api/tj/rooms/'+encodeURIComponent(this.o.code)+'/ws'+wsTok()); }
      catch(e){ return this.later(); }
      this.ws=ws;
      ws.onopen=()=>{ this.retry=0; this.lastMsg=Date.now(); this.raw(this.o.hello()); };
      ws.onmessage=e=>{
        this.lastMsg=Date.now();
        let m; try{ m=JSON.parse(e.data); }catch(_){ return; }
        if(m.t==='pong') return;
        if(m.t==='welcome'||m.t==='state') this.setStatus('online');
        if(m.t==='error'&&m.code==='noroom') this.stop('noroom');
        this.o.onMessage(m);
      };
      ws.onclose=e=>{
        if(this.ws!==ws) return;
        this.ws=null;
        if(e&&e.code===4404) return this.stop('noroom');
        if(e&&e.code===4401) return this.stop('revoked');
        this.later();
      };
      ws.onerror=()=>{};
    }
    later(){
      if(this.stopped) return;
      this.setStatus('reconnecting');
      const delay=Math.min(8000,400*2**this.retry++)*(0.75+Math.random()*0.5);
      clearTimeout(this.rt); this.rt=setTimeout(()=>this.connect(),delay);
    }
    kick(){
      if(this.stopped) return;
      if(!this.ws||this.ws.readyState>1){ clearTimeout(this.rt); this.retry=0; this.connect(); }
      else this.heartbeat();
    }
    heartbeat(){
      if(!this.ws||this.ws.readyState!==1) return;
      if(Date.now()-this.lastMsg>40000){ const w=this.ws; try{ w.close(); }catch(e){} if(w.onclose) w.onclose({code:1006}); return; }
      this.raw({t:'ping'});
    }
    raw(obj){ if(this.ws&&this.ws.readyState===1){ this.ws.send(JSON.stringify(obj)); return true; } return false; }
    send(obj){ return this.raw(obj); }
    stop(reason){
      this.stopped=true; clearTimeout(this.rt); clearInterval(this.beat);
      this.setStatus(reason||'closed');
      if(this.ws){ const w=this.ws; this.ws=null; try{ w.close(); }catch(e){} }
    }
  }

  // Zapytanie HTTP do serwera. Rzuca błąd przy braku sieci albo kodzie innym niż 2xx.
  async function api(method,path,body){
    const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),8000);
    try{
      const r=await fetch(API+path,{method,signal:ctl.signal,headers:authHead(body!==undefined?{'Content-Type':'application/json'}:{}),body:body!==undefined?JSON.stringify(body):undefined});
      onAuthFail(r);
      if(!r.ok) throw new Error('HTTP '+r.status);
      return await r.json();
    }finally{ clearTimeout(t); }
  }

  window.TJNET={API,Conn,api,createRoom:()=>api('POST','/api/tj/rooms')};
})();
