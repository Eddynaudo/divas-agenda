/* Diva's Hairboutique — Agenda smart (PWA + Supabase) */
'use strict';

const SUPABASE_URL = 'https://zaxffwwxziympmaepzhs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Jpju-L8WFs0Z-eWhqk5M3w_5hwjCL3i';
const VAPID_PUBLIC = 'BFfP41vJkZGGbPuFOqsnaGrbiPG3NfG6bOsBNwuEIURNblxK77Wq2fB3WNuGxSuN74GZkzVuNBXJ-2qYBWms8H8';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

/* ───────── Stato ───────── */
const S = {
  user: null,
  services: [],
  settings: {},
  tab: 'agenda',
  sel: startOfDay(new Date()),
  weekAppts: [],
  cassaPeriod: 'oggi',
  clientQuery: '',
};

const STAFF_OPTS = [[0, 'Nessuno'], [10, '10 min prima'], [30, '30 min prima'], [60, '1 ora prima'], [120, '2 ore prima'], [180, '3 ore prima'], [1440, '1 giorno prima'], [2880, '2 giorni prima']];
const CLIENT_OPTS = [[0, 'Nessuno'], [120, '2 ore prima'], [240, '4 ore prima'], [1440, '1 giorno prima'], [2880, '2 giorni prima'], [4320, '3 giorni prima'], [10080, '1 settimana prima']];
const PAY_METHODS = [['contanti', 'Contanti'], ['carta', 'Carta'], ['bancomat', 'Bancomat'], ['satispay', 'Satispay'], ['bonifico', 'Bonifico'], ['altro', 'Altro']];
const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240];

/* ───────── Utility ───────── */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d) { const x = startOfDay(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const eur = (n) => (n == null || n === '' ? '—' : '€ ' + Number(n).toLocaleString('it-IT', { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 }));
const fmtLong = (d) => d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
function initials(n) { return (n || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase(); }
function svcColor(name) { const s = S.services.find((x) => x.name.toLowerCase() === String(name).toLowerCase()); return s?.color || '#8a8597'; }
function whenLabel(d) {
  const t = startOfDay(new Date());
  if (sameDay(d, t)) return 'oggi';
  if (sameDay(d, addDays(t, 1))) return 'domani';
  return fmtLong(d);
}
function normalizePhone(p) {
  let n = (p || '').replace(/[^\d+]/g, '');
  if (!n) return '';
  if (n.startsWith('00')) n = '+' + n.slice(2);
  if (!n.startsWith('+')) n = '+39' + n;
  return n;
}
function durLabel(m) { return m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}′` : `${m / 60} h`; }
function optLabel(opts, v) { return (opts.find((o) => o[0] === Number(v)) || [0, `${v} min prima`])[1]; }

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
}
function fail(e) { console.error(e); toast('⚠️ ' + (e?.message || 'Qualcosa è andato storto')); }

const ICON = {
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  euro: '<svg viewBox="0 0 24 24"><path d="M17.5 6.5A7 7 0 1 0 17.5 17.5M4 10.5h9M4 13.5h9"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M4 19.5l1.4-4A8 8 0 1 1 8.6 18.6z"/></svg>',
  camera: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M4 12L20 4l-6 16-3-7z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg>',
};

/* ───────── Sfondo scintillante ───────── */
(function sparkles() {
  const cv = $('#sparkles'); const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, dpr, stars = [], shooting = null, nextShoot = performance.now() + 4000, raf;
  const COLORS = ['255,255,255', '210,225,255', '225,205,255', '255,236,190'];
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round((W * H) / 7000);
    stars = Array.from({ length: n }, () => {
      const big = Math.random() < 0.12;
      return {
        x: Math.random() * W, y: Math.random() * H,
        r: big ? 1.1 + Math.random() * 1.4 : 0.35 + Math.random() * 0.8,
        ph: Math.random() * Math.PI * 2, sp: 0.6 + Math.random() * 2.2,
        c: COLORS[(Math.random() * COLORS.length) | 0], big,
        vy: -(0.6 + Math.random() * 2.4), // lenta deriva verso l'alto (px/s)
      };
    });
  }
  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    const s = t / 1000;
    for (const st of stars) {
      if (!reduce) { st.y += st.vy / 60; if (st.y < -4) { st.y = H + 4; st.x = Math.random() * W; } }
      const tw = 0.5 + 0.5 * Math.sin(s * st.sp + st.ph);
      const a = st.big ? 0.25 + 0.75 * Math.pow(tw, 2) : 0.15 + 0.6 * tw;
      ctx.fillStyle = `rgba(${st.c},${a})`;
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.283); ctx.fill();
      if (st.big && tw > 0.55) {
        const L = st.r * (5 + 9 * tw);
        const g = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, L);
        g.addColorStop(0, `rgba(${st.c},${0.55 * a})`); g.addColorStop(1, `rgba(${st.c},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(st.x - L, st.y - 0.6, L * 2, 1.2);
        ctx.fillRect(st.x - 0.6, st.y - L, 1.2, L * 2);
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r * 3, 0, 6.283);
        ctx.fillStyle = `rgba(${st.c},${0.12 * a})`; ctx.fill();
      }
    }
    if (!reduce) {
      if (!shooting && t > nextShoot) {
        shooting = { x: Math.random() * W * 0.7 + W * 0.2, y: Math.random() * H * 0.35, vx: -(6 + Math.random() * 4), vy: 3 + Math.random() * 2, life: 0 };
      }
      if (shooting) {
        const sh = shooting; sh.life++; sh.x += sh.vx; sh.y += sh.vy;
        const k = Math.max(0, 1 - sh.life / 55);
        const g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 14, sh.y - sh.vy * 14);
        g.addColorStop(0, `rgba(255,240,200,${0.9 * k})`); g.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.beginPath();
        ctx.moveTo(sh.x, sh.y); ctx.lineTo(sh.x - sh.vx * 14, sh.y - sh.vy * 14); ctx.stroke();
        if (k <= 0) { shooting = null; nextShoot = t + 7000 + Math.random() * 9000; }
      }
      raf = requestAnimationFrame(draw);
    }
  }
  resize(); addEventListener('resize', resize);
  if (reduce) draw(0); else raf = requestAnimationFrame(draw);
  document.addEventListener('visibilitychange', () => {
    if (reduce) return;
    if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(draw);
  });
})();

/* ───────── Sheet ───────── */
let sheetOpen = false;
function openSheet(html, onMount) {
  $('#sheetBody').innerHTML = html;
  $('#sheet').classList.remove('hidden'); $('#sheetBackdrop').classList.remove('hidden');
  $('#sheet').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  if (!sheetOpen) { history.pushState({ sheet: 1 }, ''); sheetOpen = true; }
  $$('[data-close]', $('#sheet')).forEach((b) => b.addEventListener('click', closeSheet));
  onMount && onMount($('#sheet'));
}
function closeSheetIfOpen() { if (sheetOpen) closeSheet(); }
function closeSheet(fromPop) {
  stopRecording();
  $('#sheet').classList.add('hidden'); $('#sheetBackdrop').classList.add('hidden');
  document.body.style.overflow = '';
  if (sheetOpen) { sheetOpen = false; if (fromPop !== true) history.back(); }
}
$('#sheetBackdrop').addEventListener('click', closeSheet);
addEventListener('popstate', () => { if (sheetOpen) closeSheet(true); });
const sheetHead = (title, sub = '') => `<div class="sheet-head"><div><h2>${title}</h2>${sub ? `<div class="muted" style="font-size:14px">${sub}</div>` : ''}</div><button class="close-x" data-close aria-label="Chiudi">${ICON.close}</button></div>`;

/* ───────── Auth ───────── */
function showAuth() {
  $('#auth').classList.remove('hidden'); $('#app').classList.add('hidden'); $('#lock').classList.add('hidden');
}
$('#forgotBtn').addEventListener('click', async () => {
  const email = $('#authEmail').value.trim();
  if (!email) { $('#authMsg').textContent = 'Scrivi prima la tua email qui sopra.'; return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  $('#authMsg').textContent = error ? error.message : 'Ti abbiamo inviato un link per reimpostare la password.';
});
$('#authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#authEmail').value.trim(), password = $('#authPwd').value;
  const btn = $('#authBtn'); btn.disabled = true; $('#authMsg').textContent = '';
  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    $('#authPwd').value = '';
  } catch (err) {
    const m = err.message || '';
    $('#authMsg').textContent = m.includes('Invalid login') ? 'Email o password non corretti.'
      : /banned/i.test(m) ? 'Questo account è stato disattivato. Rivolgiti all\'amministratrice.' : m;
  } finally { btn.disabled = false; }
});

// Nota: niente chiamate Supabase "await" dentro la callback (evita blocchi del lock di auth)
sb.auth.onAuthStateChange((event, session) => {
  setTimeout(async () => {
    if (event === 'PASSWORD_RECOVERY') { S.recovery = true; }
    const u = session?.user || null;
    if (u && (!S.user || S.user.id !== u.id)) { S.user = u; await gate(event); }
    if (!u) { S.user = null; S.me = null; showAuth(); }
  }, 0);
});

// Prima di mostrare i dati: profilo valido + eventuale sblocco biometrico
async function gate(event) {
  const { data: me, error } = await sb.from('profiles').select('*').eq('user_id', S.user.id).maybeSingle();
  if (error) { fail(error); return; }
  if (!me || !me.active) {
    await sb.auth.signOut();
    showAuth();
    $('#authMsg').textContent = 'Questo account non è abilitato. Rivolgiti all\'amministratrice del salone.';
    return;
  }
  S.me = me;
  const justSignedIn = event === 'SIGNED_IN' && !$('#auth').classList.contains('hidden');
  if (S.recovery) { S.recovery = false; await boot(); openPasswordSheet(true); return; }
  if (bio.enabledFor(S.user.id) && !justSignedIn) return showLock();
  await boot();
  if (justSignedIn) maybeOfferBio();
}

async function boot() {
  $('#auth').classList.add('hidden'); $('#lock').classList.add('hidden'); $('#app').classList.remove('hidden');
  S.unlocked = true;
  await Promise.all([loadServices(), loadSettings(), loadTeam()]);
  setTab('agenda');
  handleDeepLink(location.hash);
  refreshPushSubscription();
}

async function loadServices() {
  const { data, error } = await sb.from('services').select('*').order('sort').order('name');
  if (error) return fail(error);
  S.services = data || [];
}
async function loadSettings() {
  const { data } = await sb.from('settings').select('*').limit(1).maybeSingle();
  S.settings = data || {};
}
async function loadTeam() {
  const { data } = await sb.from('profiles').select('user_id, full_name, email, role, active').order('role').order('full_name');
  S.team = data || [];
}
const isAdmin = () => S.me?.role === 'admin';
const memberName = (id) => { const m = (S.team || []).find((x) => x.user_id === id); return m ? (m.full_name || m.email) : ''; };

/* ───────── Face ID / impronta (WebAuthn, sblocco locale) ───────── */
const BIO_KEY = 'divas-bio';
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const bio = {
  read() { try { return JSON.parse(localStorage.getItem(BIO_KEY) || 'null'); } catch { return null; } },
  write(v) { try { v ? localStorage.setItem(BIO_KEY, JSON.stringify(v)) : localStorage.removeItem(BIO_KEY); } catch {} },
  enabledFor(uid) { const v = this.read(); return !!(v && v.uid === uid && v.credId); },
  async available() {
    try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
    catch { return false; }
  },
  async enable() {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: "Diva's Agenda", id: location.hostname },
        user: { id: new TextEncoder().encode(S.user.id), name: S.user.email, displayName: S.me?.full_name || S.user.email },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
        timeout: 60000, attestation: 'none',
      },
    });
    this.write({ uid: S.user.id, credId: b64u(cred.rawId) });
  },
  async verify() {
    const v = this.read();
    await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: unb64u(v.credId), transports: ['internal'] }],
        userVerification: 'required', timeout: 60000,
      },
    });
  },
};

function showLock() {
  S.unlocked = false;
  closeSheetIfOpen();
  $('#app').classList.add('hidden'); $('#auth').classList.add('hidden'); $('#lock').classList.remove('hidden');
  $('#lockTitle').textContent = `Ciao ${(S.me?.full_name || '').split(' ')[0] || ''}!`.replace(' !', '!');
  $('#lockMsg').textContent = '';
  // su Android parte da solo; su iPhone serve il tocco sul pulsante
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) setTimeout(unlock, 350);
}
async function unlock() {
  try {
    await bio.verify();
    if (!$('#app').classList.contains('hidden')) return;
    if (S.services.length && S.team) { // già caricata: rientra veloce
      $('#lock').classList.add('hidden'); $('#app').classList.remove('hidden'); S.unlocked = true; setTab(S.tab);
    } else await boot();
  } catch (e) {
    $('#lockMsg').textContent = e?.name === 'NotAllowedError' ? 'Riconoscimento annullato. Riprova.' : 'Sblocco non riuscito: usa la password.';
  }
}
$('#unlockBtn').addEventListener('click', unlock);
$('#lockPwdBtn').addEventListener('click', async () => {
  bio.write(null);
  await sb.auth.signOut();
  location.reload();
});
// richiudi dopo 5 minuti in background
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (S.user && S.unlocked && bio.enabledFor(S.user.id) && hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000) showLock();
});

async function maybeOfferBio() {
  if (bio.enabledFor(S.user.id) || !(await bio.available())) return;
  try { if (localStorage.getItem('divas-bio-asked') === S.user.id) return; localStorage.setItem('divas-bio-asked', S.user.id); } catch {}
  setTimeout(async () => {
    if (!confirm('Vuoi entrare con Face ID / impronta le prossime volte, senza digitare la password?')) return;
    try { await bio.enable(); toast('Face ID / impronta attivati ✨'); } catch { toast('Attivazione annullata: puoi farla da Impostazioni'); }
  }, 900);
}

/* ───────── Cambio password ───────── */
function openPasswordSheet(fromRecovery) {
  openSheet(`
    ${sheetHead(fromRecovery ? 'Nuova password' : 'Cambia password', fromRecovery ? 'Scegli la nuova password del tuo account' : esc(S.user.email))}
    <form class="form" id="pwdForm" autocomplete="off">
      ${fromRecovery ? '' : '<label>Password attuale<input type="password" id="pOld" required autocomplete="current-password"></label>'}
      <label>Nuova password<input type="password" id="pNew" required minlength="8" autocomplete="new-password"></label>
      <label>Ripeti nuova password<input type="password" id="pNew2" required minlength="8" autocomplete="new-password"></label>
      <p class="note" style="margin:0">Almeno 8 caratteri. Consiglio: lettere, numeri e un simbolo.</p>
      <p class="auth-msg" id="pMsg" style="text-align:left"></p>
      <button class="btn gold block" id="pSave">Salva nuova password</button>
    </form>`, (root) => {
    $('#pwdForm', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = $('#pMsg', root);
      const n1 = $('#pNew', root).value, n2 = $('#pNew2', root).value;
      if (n1.length < 8) { msg.textContent = 'La password deve avere almeno 8 caratteri.'; return; }
      if (n1 !== n2) { msg.textContent = 'Le due password non coincidono.'; return; }
      $('#pSave', root).disabled = true;
      try {
        if (!fromRecovery) {
          const { error } = await sb.auth.signInWithPassword({ email: S.user.email, password: $('#pOld', root).value });
          if (error) { msg.textContent = 'La password attuale non è corretta.'; return; }
        }
        const { error } = await sb.auth.updateUser({ password: n1 });
        if (error) throw error;
        closeSheet(); toast('Password aggiornata ✨');
      } catch (err) { msg.textContent = err.message; }
      finally { $('#pSave', root).disabled = false; }
    });
  });
}

/* ───────── Team (solo admin) ───────── */
async function adminCall(action, payload = {}) {
  const { data, error } = await sb.functions.invoke('admin-users', { body: { action, ...payload } });
  if (error) {
    let m = error.message;
    try { const j = await error.context.json(); m = j.error || m; } catch {}
    throw new Error(m);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
async function renderTeam(box) {
  box.innerHTML = '<div class="muted">Caricamento…</div>';
  let users = [];
  try { users = (await adminCall('list')).users; } catch (e) { box.innerHTML = `<div class="muted">${esc(e.message)}</div>`; return; }
  box.innerHTML = users.map((u) => `
    <div class="member ${u.active ? '' : 'off'}" data-id="${u.user_id}">
      <div class="avatar">${esc(initials(u.full_name || u.email))}</div>
      <div class="info"><strong>${esc(u.full_name || '—')} ${u.role === 'admin' ? '<span class="badge info">Admin</span>' : u.active ? '' : '<span class="badge danger">Disattivato</span>'}</strong>
        <small>${esc(u.email)}${u.last_sign_in_at ? ' · ultimo accesso ' + fmtShort(new Date(u.last_sign_in_at)) : ' · mai entrato'}</small></div>
      ${u.role === 'admin' ? '' : `<button class="mini-btn" data-act aria-label="Gestisci">${ICON.edit}</button>`}
    </div>`).join('');
  $$('[data-act]', box).forEach((b) => b.addEventListener('click', () => {
    const u = users.find((x) => x.user_id === b.closest('.member').dataset.id);
    openMemberSheet(u);
  }));
}
function openMemberSheet(u) {
  openSheet(`
    ${sheetHead(esc(u.full_name || u.email), esc(u.email))}
    <div class="form">
      <label>Nome<input id="mName" value="${esc(u.full_name || '')}"></label>
      <button class="btn" id="mRename">Salva nome</button>
      <div class="section-t">Password</div>
      <label>Nuova password temporanea<input id="mPwd" type="text" minlength="8" placeholder="min 8 caratteri" autocomplete="off"></label>
      <button class="btn" id="mReset">Imposta nuova password</button>
      <div class="section-t">Accesso</div>
      <button class="btn ${u.active ? '' : 'ok'}" id="mToggle">${u.active ? 'Disattiva account (non potrà più entrare)' : 'Riattiva account'}</button>
      <button class="btn danger" id="mDel">${ICON.trash} Elimina account</button>
      <p class="note">Gli appuntamenti creati da questo account restano in agenda.</p>
    </div>`, (root) => {
    const run = async (btn, fn, ok) => {
      btn.disabled = true;
      try { await fn(); toast(ok); closeSheet(); await loadTeam(); renderSettings(); }
      catch (e) { toast('⚠️ ' + e.message); } finally { btn.disabled = false; }
    };
    $('#mRename', root).addEventListener('click', (e) => run(e.currentTarget, () => adminCall('rename', { user_id: u.user_id, full_name: $('#mName', root).value }), 'Nome aggiornato'));
    $('#mReset', root).addEventListener('click', (e) => run(e.currentTarget, () => adminCall('reset_password', { user_id: u.user_id, password: $('#mPwd', root).value }), 'Password impostata: comunicala al dipendente'));
    $('#mToggle', root).addEventListener('click', (e) => run(e.currentTarget, () => adminCall('set_active', { user_id: u.user_id, active: !u.active }), u.active ? 'Account disattivato' : 'Account riattivato'));
    $('#mDel', root).addEventListener('click', (e) => {
      if (!confirm(`Eliminare definitivamente l'account di ${u.full_name || u.email}?`)) return;
      run(e.currentTarget, () => adminCall('delete', { user_id: u.user_id }), 'Account eliminato');
    });
  });
}
function openNewMemberSheet() {
  openSheet(`
    ${sheetHead('Nuovo dipendente', 'Crea l\'accesso all\'agenda')}
    <form class="form" id="nmForm" autocomplete="off">
      <label>Nome e cognome<input id="nmName" required autocapitalize="words"></label>
      <label>Email<input id="nmEmail" type="email" required autocapitalize="off" inputmode="email"></label>
      <label>Password iniziale<input id="nmPwd" type="text" required minlength="8" autocomplete="off" placeholder="min 8 caratteri"></label>
      <p class="note" style="margin:0">Comunica email e password al dipendente: potrà cambiarla da Impostazioni → Cambia password.</p>
      <p class="auth-msg" id="nmMsg" style="text-align:left"></p>
      <button class="btn gold block" id="nmSave">Crea account</button>
    </form>`, (root) => {
    $('#nmPwd', root).value = Math.random().toString(36).slice(2, 6) + '-' + Math.random().toString(36).slice(2, 6) + '!' ;
    $('#nmForm', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#nmSave', root); btn.disabled = true;
      try {
        await adminCall('create', { full_name: $('#nmName', root).value, email: $('#nmEmail', root).value, password: $('#nmPwd', root).value });
        closeSheet(); toast('Account creato ✨'); await loadTeam(); renderSettings();
      } catch (err) { $('#nmMsg', root).textContent = err.message; }
      finally { btn.disabled = false; }
    });
  });
}

/* ───────── Navigazione ───────── */
$$('.tabbar button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('#fab').addEventListener('click', () => openForm(null, { date: S.sel }));
$('#todayBtn').addEventListener('click', () => { S.sel = startOfDay(new Date()); setTab('agenda'); });

function setTab(t) {
  S.tab = t;
  $$('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
  $('#fab').classList.toggle('hidden', t === 'impostazioni');
  scrollTo(0, 0);
  ({ agenda: renderAgenda, clienti: renderClients, cassa: renderCassa, impostazioni: renderSettings })[t]();
}
function setTop(eyebrow, title) { $('#topEyebrow').textContent = eyebrow; $('#topTitle').textContent = title; }

function handleDeepLink(hash) {
  const m = (hash || '').match(/#\/(app|send)\/([0-9a-f-]{36})(?:\/(\d))?/);
  if (!m) return;
  history.replaceState(null, '', location.pathname);
  if (m[1] === 'app') openDetail(m[2]);
  else openSendPrompt(m[2], Number(m[3] || 1));
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type === 'navigate') handleDeepLink(new URL(e.data.url).hash);
  });
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && S.user && S.unlocked && !sheetOpen) setTab(S.tab);
});

/* ───────── Agenda ───────── */
async function renderAgenda() {
  const ws = startOfWeek(S.sel), we = addDays(ws, 7);
  setTop(S.sel.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), sameDay(S.sel, new Date()) ? 'Oggi' : fmtLong(S.sel));
  const view = $('#view');
  if (!view.querySelector('.week')) view.innerHTML = '<div class="list"><div class="empty muted">Caricamento…</div></div>';
  const { data, error } = await sb.from('appointments').select('*, attachments(id,kind)')
    .gte('starts_at', ws.toISOString()).lt('starts_at', we.toISOString()).order('starts_at');
  if (error) return fail(error);
  if (S.tab !== 'agenda') return;
  S.weekAppts = data || [];

  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const dayAppts = S.weekAppts.filter((a) => sameDay(new Date(a.starts_at), S.sel));
  const active = dayAppts.filter((a) => a.status !== 'cancelled');
  const tot = active.reduce((s, a) => s + Number(a.price || 0), 0);

  view.innerHTML = `
    <div class="week">
      <button class="week-nav" data-w="-7" aria-label="Settimana precedente">${ICON.left}</button>
      <div class="days">
        ${days.map((d) => {
          const n = S.weekAppts.filter((a) => a.status !== 'cancelled' && sameDay(new Date(a.starts_at), d)).length;
          return `<button class="day ${sameDay(d, S.sel) ? 'sel' : ''} ${sameDay(d, today) ? 'today' : ''}" data-d="${ymd(d)}">
            <small>${d.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 3)}</small><b>${d.getDate()}</b>
            <span class="dots">${'<i></i>'.repeat(Math.min(n, 4))}</span></button>`;
        }).join('')}
      </div>
      <button class="week-nav" data-w="7" aria-label="Settimana successiva">${ICON.right}</button>
    </div>
    <div class="day-summary">
      <h2>${esc(fmtLong(S.sel))}</h2>
      <span>${active.length} ${active.length === 1 ? 'appuntamento' : 'appuntamenti'}${tot ? ' · ' + eur(tot) : ''}</span>
    </div>
    <div class="list">
      ${dayAppts.length ? dayAppts.map(apptCard).join('') : `
        <div class="empty glass"><div class="spark">✦</div><div class="serif">Giornata libera</div>
        <div class="muted">Tocca + per aggiungere un appuntamento</div></div>`}
    </div>`;

  $$('.day', view).forEach((b) => b.addEventListener('click', () => { const [y, m, d] = b.dataset.d.split('-').map(Number); S.sel = new Date(y, m - 1, d); renderAgenda(); }));
  $$('.week-nav', view).forEach((b) => b.addEventListener('click', () => { S.sel = addDays(S.sel, Number(b.dataset.w)); renderAgenda(); }));
  $$('.appt', view).forEach((c) => c.addEventListener('click', () => openDetail(c.dataset.id)));
}

function statusBadges(a) {
  const out = [];
  if (a.status === 'cancelled') out.push('<span class="badge danger">Annullato</span>');
  else if (a.status === 'noshow') out.push('<span class="badge danger">Non presentata</span>');
  else if (a.status === 'done') out.push(`<span class="badge ok">${ICON.check}Eseguito</span>`);
  if (a.paid) out.push(`<span class="badge ok">${ICON.euro}Pagato${a.payment_method ? ' · ' + a.payment_method : ''}</span>`);
  else if (a.status === 'done') out.push('<span class="badge warn">Da incassare</span>');
  return out.join('');
}

function apptCard(a) {
  const d = new Date(a.starts_at);
  const end = new Date(d.getTime() + a.duration_min * 60000);
  const media = (a.attachments || []).length;
  return `<article class="appt glass ${a.status}" data-id="${a.id}" style="--accent:${svcColor(a.services[0])}">
    <div class="time">${hm(d)}<small>${hm(end)}</small></div>
    <div class="who"><strong>${esc(a.client_name)}</strong>${(S.team || []).length > 1 ? `<span class="op-chip">con ${esc(memberName(a.assigned_to || a.user_id).split(' ')[0])}</span>` : ''}
      <div class="chips">${a.services.map((s) => `<span class="chip"><span class="sw" style="background:${svcColor(s)}"></span>${esc(s)}</span>`).join('')}
      ${media ? `<span class="chip">📎 ${media}</span>` : ''}</div>
    </div>
    <div class="right"><span class="price">${a.price != null ? eur(a.price) : ''}</span>${statusBadges(a)}</div>
  </article>`;
}

/* ───────── Form appuntamento ───────── */
let pendingMedia = [];

async function openForm(appt, opts = {}) {
  pendingMedia = [];
  const isNew = !appt;
  const st = S.settings;
  let rem = { s1: st.staff_r1 ?? 1440, s2: st.staff_r2 ?? 60, c1: st.client_r1 ?? 2880, c2: st.client_r2 ?? 1440 };
  if (!isNew) {
    const { data } = await sb.from('reminders').select('*').eq('appointment_id', appt.id);
    rem = { s1: 0, s2: 0, c1: 0, c2: 0 };
    (data || []).forEach((r) => { rem[(r.target === 'staff' ? 's' : 'c') + r.slot] = r.offset_min; });
  }
  let date = opts.date ? new Date(opts.date) : new Date();
  let time = '09:00';
  if (appt) { const d = new Date(appt.starts_at); date = d; time = hm(d); }
  else if (sameDay(date, new Date())) { const n = new Date(); n.setMinutes(Math.ceil(n.getMinutes() / 15) * 15 + 15, 0, 0); time = hm(n); }
  const a = appt || { client_name: opts.name || '', phone: opts.phone || '', services: [], price: null, notes: '', duration_min: st.default_duration || 60, client_channel: st.default_channel || 'whatsapp' };
  const selSvcs = new Set(a.services);
  let priceTouched = !isNew && a.price != null;

  const options = (opts2, v) => opts2.map(([val, l]) => `<option value="${val}" ${Number(v) === val ? 'selected' : ''}>${l}</option>`).join('');
  const durOpts = [...new Set([...DURATIONS, a.duration_min])].sort((x, y) => x - y)
    .map((m) => `<option value="${m}" ${m === a.duration_min ? 'selected' : ''}>${durLabel(m)}</option>`).join('');

  openSheet(`
    ${sheetHead(isNew ? 'Nuovo appuntamento' : 'Modifica appuntamento')}
    <form class="form" id="apptForm" autocomplete="off">
      <div class="suggest">
        <label>Nome cliente<input id="fName" required value="${esc(a.client_name)}" placeholder="Es. Giulia Rossi" autocapitalize="words"></label>
        <div class="suggest-list hidden" id="suggest"></div>
      </div>
      <label>Cellulare<input id="fPhone" type="tel" inputmode="tel" value="${esc(a.phone || '')}" placeholder="+39 333 1234567"></label>
      <div class="row3">
        <label>Giorno<input id="fDate" type="date" required value="${ymd(date)}"></label>
        <label>Ora<input id="fTime" type="time" required step="300" value="${time}"></label>
        <label>Durata<select id="fDur">${durOpts}</select></label>
      </div>

      ${(S.team || []).filter((m) => m.active).length > 1 ? `<label>Operatrice<select id="fOp">${S.team.filter((m) => m.active || m.user_id === a.assigned_to).map((m) => `<option value="${m.user_id}" ${(a.assigned_to || (isNew ? S.user.id : a.user_id)) === m.user_id ? 'selected' : ''}>${esc(m.full_name || m.email)}</option>`).join('')}</select></label>` : ''}

      <div class="section-t">Servizi</div>
      <div class="svc-grid" id="svcGrid"></div>

      <div class="row">
        <label>Prezzo (€)<input id="fPrice" type="number" inputmode="decimal" step="0.5" min="0" value="${a.price ?? ''}" placeholder="0"></label>
        <label>Messaggio cliente via<select id="fChannel">
          <option value="whatsapp" ${a.client_channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
          <option value="sms" ${a.client_channel === 'sms' ? 'selected' : ''}>SMS</option>
          <option value="nessuno" ${a.client_channel === 'nessuno' ? 'selected' : ''}>Nessuno</option>
        </select></label>
      </div>
      <label>Note<textarea id="fNotes" placeholder="Formula colore, preferenze, allergie…">${esc(a.notes || '')}</textarea></label>

      <div class="section-t">Promemoria</div>
      <div class="rem-box">
        <div class="hint">🔔 Per te (notifica sul telefono)</div>
        <div class="row"><select id="rS1">${options(STAFF_OPTS, rem.s1)}</select><select id="rS2">${options(STAFF_OPTS, rem.s2)}</select></div>
      </div>
      <div class="rem-box">
        <div class="hint">💬 Per la cliente (messaggio al cellulare)</div>
        <div class="row"><select id="rC1">${options(CLIENT_OPTS, rem.c1)}</select><select id="rC2">${options(CLIENT_OPTS, rem.c2)}</select></div>
      </div>

      <div class="section-t">Foto e audio</div>
      <div class="media-row">
        <label class="btn" style="flex-direction:row;color:var(--text);font-size:15px">${ICON.camera} Foto<input type="file" accept="image/*" multiple id="fPhoto" hidden></label>
        <button type="button" class="btn" id="recBtn">${ICON.mic} Registra audio</button>
      </div>
      <div id="formMedia" class="form" style="gap:8px"></div>

      <button class="btn gold block" type="submit" id="saveBtn">${isNew ? 'Salva appuntamento' : 'Salva modifiche'}</button>
      ${isNew ? '' : `<button type="button" class="btn danger block" id="delBtn">${ICON.trash} Elimina appuntamento</button>`}
    </form>`, (root) => {

    const grid = $('#svcGrid', root);
    function renderSvcs() {
      const extra = [...selSvcs].filter((n) => !S.services.some((s) => s.name === n));
      grid.innerHTML = [...S.services.map((s) => s.name), ...extra].map((n) =>
        `<button type="button" class="svc ${selSvcs.has(n) ? 'on' : ''}" data-n="${esc(n)}"><span class="sw" style="background:${svcColor(n)}"></span>${esc(n)}</button>`).join('')
        + `<button type="button" class="svc add" id="addSvc">${ICON.plus.replace('<svg', '<svg style="width:15px;height:15px"')} Aggiungi</button>`;
      $$('.svc[data-n]', grid).forEach((b) => b.addEventListener('click', () => {
        const n = b.dataset.n; selSvcs.has(n) ? selSvcs.delete(n) : selSvcs.add(n); renderSvcs(); autoPrice();
      }));
      $('#addSvc', grid).addEventListener('click', async () => {
        const n = (prompt('Nome del nuovo servizio (es. Trattamento, Meches, Barba):') || '').trim();
        if (!n) return;
        const p = prompt(`Prezzo standard per "${n}" in € (lascia vuoto se variabile):`);
        const price = p ? Number(String(p).replace(',', '.')) : null;
        const palette = ['#c6a84b', '#d9b7e8', '#9ec5ff', '#f2a7b5', '#a7e3c9', '#f5c58a', '#b5b0ff'];
        const { data, error } = await sb.from('services').insert({ name: n, default_price: isNaN(price) ? null : price, color: palette[S.services.length % palette.length], sort: S.services.length + 1 }).select().single();
        if (error) return fail(error);
        S.services.push(data); selSvcs.add(n); renderSvcs(); autoPrice();
      });
    }
    function autoPrice() {
      if (priceTouched) return;
      const sum = [...selSvcs].reduce((s, n) => s + Number(S.services.find((x) => x.name === n)?.default_price || 0), 0);
      $('#fPrice', root).value = sum || '';
    }
    $('#fPrice', root).addEventListener('input', () => { priceTouched = true; });
    renderSvcs();

    // suggerimenti clienti
    const nameIn = $('#fName', root), sug = $('#suggest', root);
    let sugT;
    nameIn.addEventListener('input', () => {
      clearTimeout(sugT);
      const q = nameIn.value.trim();
      if (q.length < 2) { sug.classList.add('hidden'); return; }
      sugT = setTimeout(async () => {
        const { data } = await sb.from('clients').select('*').ilike('name', `%${q}%`).order('name').limit(5);
        if (!data?.length) { sug.classList.add('hidden'); return; }
        sug.innerHTML = data.map((c) => `<button type="button" data-id="${c.id}">${esc(c.name)}<small>${esc(c.phone || '')}</small></button>`).join('');
        sug.classList.remove('hidden');
        $$('button', sug).forEach((b) => b.addEventListener('click', () => {
          const c = data.find((x) => x.id === b.dataset.id);
          nameIn.value = c.name; $('#fPhone', root).value = c.phone || ''; sug.classList.add('hidden');
        }));
      }, 200);
    });
    nameIn.addEventListener('blur', () => setTimeout(() => sug.classList.add('hidden'), 200));

    // media in attesa (nuovo) o diretti (modifica)
    const mediaBox = $('#formMedia', root);
    const refreshMedia = async () => {
      if (isNew) renderPendingMedia(mediaBox);
      else await renderMedia(mediaBox, appt.id, true);
    };
    refreshMedia();
    $('#fPhoto', root).addEventListener('change', async (e) => {
      for (const f of e.target.files) {
        const blob = await compressImage(f);
        if (isNew) pendingMedia.push({ kind: 'photo', blob, url: URL.createObjectURL(blob) });
        else await uploadMedia(appt.id, 'photo', blob);
      }
      e.target.value = ''; refreshMedia();
    });
    $('#recBtn', root).addEventListener('click', () => toggleRecording($('#recBtn', root), async (blob) => {
      if (isNew) pendingMedia.push({ kind: 'audio', blob, url: URL.createObjectURL(blob) });
      else await uploadMedia(appt.id, 'audio', blob);
      refreshMedia();
    }));

    if (!isNew) $('#delBtn', root).addEventListener('click', () => deleteAppt(appt));

    $('#apptForm', root).addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selSvcs.size) { toast('Seleziona almeno un servizio'); return; }
      const btn = $('#saveBtn', root); btn.disabled = true; btn.textContent = 'Salvataggio…';
      try {
        const [y, mo, d] = $('#fDate', root).value.split('-').map(Number);
        const [hh, mm] = $('#fTime', root).value.split(':').map(Number);
        const starts = new Date(y, mo - 1, d, hh, mm);
        const name = nameIn.value.trim(), phone = $('#fPhone', root).value.trim();
        const priceV = $('#fPrice', root).value;
        const client_id = await upsertClient(name, phone);
        const row = {
          client_id, client_name: name, phone: phone || null, starts_at: starts.toISOString(),
          duration_min: Number($('#fDur', root).value), services: [...selSvcs],
          price: priceV === '' ? null : Number(priceV), notes: $('#fNotes', root).value.trim() || null,
          client_channel: $('#fChannel', root).value,
          assigned_to: $('#fOp', root)?.value || (isNew ? S.user.id : (a.assigned_to || a.user_id)),
        };
        let saved;
        if (isNew) {
          const r = await sb.from('appointments').insert(row).select().single(); if (r.error) throw r.error; saved = r.data;
        } else {
          const r = await sb.from('appointments').update(row).eq('id', appt.id).select().single(); if (r.error) throw r.error; saved = r.data;
        }
        await saveReminders(saved, {
          s1: +$('#rS1', root).value, s2: +$('#rS2', root).value, c1: +$('#rC1', root).value, c2: +$('#rC2', root).value,
        });
        for (const m of pendingMedia) await uploadMedia(saved.id, m.kind, m.blob);
        pendingMedia = [];
        closeSheet();
        S.sel = startOfDay(starts);
        toast(isNew ? 'Appuntamento salvato ✨' : 'Modifiche salvate ✨');
        setTab('agenda');
        maybeAskPush();
      } catch (err) { fail(err); btn.disabled = false; btn.textContent = 'Riprova'; }
    });
  });
}

async function upsertClient(name, phone) {
  const p = normalizePhone(phone);
  if (p) {
    const { data: ex } = await sb.from('clients').select('id,name').eq('phone', p).limit(1);
    if (ex?.length) {
      if (ex[0].name !== name) await sb.from('clients').update({ name }).eq('id', ex[0].id);
      return ex[0].id;
    }
    const { data, error } = await sb.from('clients').insert({ name, phone: p }).select().single();
    if (error) { console.warn(error); return null; }
    return data.id;
  }
  const { data: ex } = await sb.from('clients').select('id').ilike('name', name).is('phone', null).limit(1);
  if (ex?.length) return ex[0].id;
  const { data } = await sb.from('clients').insert({ name }).select().single();
  return data?.id || null;
}

async function saveReminders(a, r) {
  await sb.from('reminders').delete().eq('appointment_id', a.id);
  const start = new Date(a.starts_at).getTime(), now = Date.now();
  const rows = [];
  [['staff', 1, r.s1], ['staff', 2, r.s2], ['client', 1, r.c1], ['client', 2, r.c2]].forEach(([target, slot, off]) => {
    if (!off) return;
    if (target === 'client' && (!a.phone || a.client_channel === 'nessuno')) return;
    const send = start - off * 60000;
    if (send <= now) return;
    rows.push({ appointment_id: a.id, target, slot, offset_min: off, send_at: new Date(send).toISOString() });
  });
  if (rows.length) { const { error } = await sb.from('reminders').insert(rows); if (error) throw error; }
}

async function deleteAppt(a) {
  if (!confirm(`Eliminare l'appuntamento di ${a.client_name}? Verranno cancellati anche foto e audio.`)) return;
  const { data: att } = await sb.from('attachments').select('path').eq('appointment_id', a.id);
  if (att?.length) await sb.storage.from('media').remove(att.map((x) => x.path));
  const { error } = await sb.from('appointments').delete().eq('id', a.id);
  if (error) return fail(error);
  closeSheet(); toast('Appuntamento eliminato'); setTab(S.tab);
}

/* ───────── Media ───────── */
function compressImage(file, max = 1600, q = 0.82) {
  return new Promise((res) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => res(b || file), 'image/jpeg', q);
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(file); };
    img.src = url;
  });
}

async function uploadMedia(apptId, kind, blob) {
  const ext = kind === 'photo' ? 'jpg' : (blob.type.includes('mp4') || blob.type.includes('m4a') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm');
  const path = `${S.user.id}/${apptId}/${crypto.randomUUID()}.${ext}`;
  const up = await sb.storage.from('media').upload(path, blob, { contentType: blob.type || (kind === 'photo' ? 'image/jpeg' : 'audio/webm') });
  if (up.error) return fail(up.error);
  const { error } = await sb.from('attachments').insert({ appointment_id: apptId, kind, path });
  if (error) fail(error);
}

function mediaHtml(photos, audios, editable) {
  return `
    ${photos.length ? `<div class="thumbs">${photos.map((p) => `<div class="thumb"><img src="${p.url}" alt="Foto" data-full="${p.url}" loading="lazy">${editable ? `<button type="button" class="del" data-del="${p.id}" aria-label="Elimina foto">${ICON.close}</button>` : ''}</div>`).join('')}</div>` : ''}
    ${audios.map((a) => `<div class="audio-item"><audio controls preload="metadata" src="${a.url}"></audio>${editable ? `<button type="button" class="del" data-del="${a.id}" aria-label="Elimina audio">${ICON.close}</button>` : ''}</div>`).join('')}`;
}
function bindLightbox(box) {
  $$('img[data-full]', box).forEach((img) => img.addEventListener('click', () => {
    const lb = document.createElement('div'); lb.className = 'lightbox';
    lb.innerHTML = `<img src="${img.dataset.full}" alt="">`; lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
  }));
}
function renderPendingMedia(box) {
  const photos = pendingMedia.map((m, i) => ({ ...m, id: i })).filter((m) => m.kind === 'photo');
  const audios = pendingMedia.map((m, i) => ({ ...m, id: i })).filter((m) => m.kind === 'audio');
  box.innerHTML = mediaHtml(photos, audios, true);
  $$('[data-del]', box).forEach((b) => b.addEventListener('click', () => { pendingMedia.splice(Number(b.dataset.del), 1); renderPendingMedia(box); }));
  bindLightbox(box);
}
async function renderMedia(box, apptId, editable) {
  const { data } = await sb.from('attachments').select('*').eq('appointment_id', apptId).order('created_at');
  if (!data?.length) { box.innerHTML = ''; return data || []; }
  const { data: signed } = await sb.storage.from('media').createSignedUrls(data.map((x) => x.path), 3600);
  const items = data.map((x, i) => ({ ...x, url: signed?.[i]?.signedUrl }));
  box.innerHTML = mediaHtml(items.filter((x) => x.kind === 'photo'), items.filter((x) => x.kind === 'audio'), editable);
  $$('[data-del]', box).forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Eliminare questo file?')) return;
    const it = items.find((x) => x.id === b.dataset.del);
    await sb.storage.from('media').remove([it.path]);
    await sb.from('attachments').delete().eq('id', it.id);
    renderMedia(box, apptId, editable);
  }));
  bindLightbox(box);
  return items;
}

let recorder = null, recChunks = [], recStream = null, recTimer = null;
function pickAudioMime() {
  const c = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
  return window.MediaRecorder ? c.find((m) => MediaRecorder.isTypeSupported?.(m)) || '' : '';
}
async function toggleRecording(btn, onDone) {
  if (recorder && recorder.state === 'recording') { recorder.stop(); return; }
  if (!window.MediaRecorder) { toast('Registrazione non supportata su questo dispositivo'); return; }
  try {
    recStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch { toast('Consenti l\'accesso al microfono per registrare'); return; }
  const mime = pickAudioMime();
  recorder = new MediaRecorder(recStream, mime ? { mimeType: mime } : undefined);
  recChunks = [];
  recorder.ondataavailable = (e) => e.data.size && recChunks.push(e.data);
  recorder.onstop = async () => {
    clearInterval(recTimer);
    recStream.getTracks().forEach((t) => t.stop());
    btn.classList.remove('rec'); btn.innerHTML = `${ICON.mic} Registra audio`;
    const blob = new Blob(recChunks, { type: recorder.mimeType || mime || 'audio/webm' });
    recorder = null;
    if (blob.size > 0 && onDone) await onDone(blob);
  };
  recorder.start();
  const t0 = Date.now();
  btn.classList.add('rec');
  const tick = () => { const s = Math.floor((Date.now() - t0) / 1000); btn.innerHTML = `<span class="dot"></span> Stop ${Math.floor(s / 60)}:${pad(s % 60)}`; };
  tick(); recTimer = setInterval(tick, 500);
}
function stopRecording() { if (recorder && recorder.state === 'recording') recorder.stop(); }

/* ───────── Dettaglio ───────── */
async function openDetail(id) {
  const { data: a, error } = await sb.from('appointments').select('*').eq('id', id).maybeSingle();
  if (error) return fail(error);
  if (!a) return toast('Appuntamento non trovato');
  const { data: rems } = await sb.from('reminders').select('*').eq('appointment_id', id).order('send_at');
  const d = new Date(a.starts_at), end = new Date(d.getTime() + a.duration_min * 60000);
  const remLine = (rems || []).map((r) => {
    const icon = r.target === 'staff' ? '🔔' : '💬';
    const state = r.status === 'pending' ? '' : r.status === 'sent' ? ' ✓' : r.status === 'skipped' ? ' (saltato)' : ' ⚠️';
    return `<div>${icon} ${r.target === 'staff' ? 'Tu' : 'Cliente'} · ${optLabel(r.target === 'staff' ? STAFF_OPTS : CLIENT_OPTS, r.offset_min)}${state}</div>`;
  }).join('') || '<span class="muted">Nessuno</span>';
  const phone = normalizePhone(a.phone);

  openSheet(`
    ${sheetHead(esc(a.client_name), a.services.map(esc).join(' · '))}
    <div class="detail-top">
      <div class="detail-time"><b>${hm(d)}</b><small>${esc(d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }))}</small></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <div class="chips" style="margin:0">${statusBadges(a) || '<span class="badge info">In programma</span>'}</div>
        <div style="font-size:26px;font-family:Marcellus,serif">${a.price != null ? eur(a.price) : '<span class="muted" style="font-size:16px">Prezzo da definire</span>'}</div>
        ${phone ? `<div style="display:flex;gap:8px">
          <a class="mini-btn" href="tel:${phone}" aria-label="Chiama">${ICON.phone}</a>
          <a class="mini-btn" href="https://wa.me/${phone.replace('+', '')}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICON.chat}</a>
          <button class="btn" style="min-height:40px;padding:8px 12px;font-size:14px" id="sendNow">${ICON.send} Invia promemoria</button>
        </div>` : ''}
      </div>
    </div>
    <dl class="kv glass" style="margin:14px 0">
      <dt>Orario</dt><dd>${hm(d)} – ${hm(end)} (${a.duration_min} min)</dd>
      <dt>Cellulare</dt><dd>${esc(a.phone || '—')}</dd>
      ${(S.team || []).length > 1 ? `<dt>Operatrice</dt><dd>${esc(memberName(a.assigned_to || a.user_id) || '—')}</dd>` : ''}
      ${a.notes ? `<dt>Note</dt><dd style="white-space:pre-wrap">${esc(a.notes)}</dd>` : ''}
      <dt>Promemoria</dt><dd>${remLine}</dd>
      ${a.paid ? `<dt>Pagamento</dt><dd>${eur(a.paid_amount ?? a.price)} · ${esc(a.payment_method || '')}${a.paid_at ? ' · ' + fmtShort(new Date(a.paid_at)) : ''}</dd>` : ''}
    </dl>
    <div id="payBox"></div>
    <div class="actions" id="actBox">
      ${a.status !== 'done' ? `<button class="btn ok" id="doneBtn">${ICON.check} Eseguito</button>` : `<button class="btn" id="undoneBtn">Segna da fare</button>`}
      ${!a.paid ? `<button class="btn gold" id="payBtn">${ICON.euro} Incassa</button>` : `<button class="btn" id="unpayBtn">Annulla pagamento</button>`}
      <button class="btn" id="editBtn">${ICON.edit} Modifica</button>
      <button class="btn" id="moreBtn">Altro…</button>
    </div>
    <div class="section-t" style="margin-top:18px">Foto e audio</div>
    <div class="media-row" style="margin:12px 0">
      <label class="btn" style="flex-direction:row;color:var(--text);font-size:15px">${ICON.camera} Foto<input type="file" accept="image/*" multiple id="dPhoto" hidden></label>
      <button type="button" class="btn" id="dRec">${ICON.mic} Registra audio</button>
    </div>
    <div id="dMedia" class="form" style="gap:8px"><div class="muted">Caricamento…</div></div>
  `, (root) => {
    const mediaBox = $('#dMedia', root);
    renderMedia(mediaBox, a.id, true).then((items) => { if (!items.length) mediaBox.innerHTML = '<div class="muted" style="font-size:14px">Nessun file. Aggiungi foto del risultato o una nota vocale.</div>'; });
    $('#dPhoto', root).addEventListener('change', async (e) => {
      toast('Caricamento foto…');
      for (const f of e.target.files) await uploadMedia(a.id, 'photo', await compressImage(f));
      e.target.value = ''; await renderMedia(mediaBox, a.id, true); toast('Foto salvate ✨');
    });
    $('#dRec', root).addEventListener('click', () => toggleRecording($('#dRec', root), async (blob) => {
      await uploadMedia(a.id, 'audio', blob); await renderMedia(mediaBox, a.id, true); toast('Audio salvato ✨');
    }));
    $('#sendNow', root)?.addEventListener('click', () => openSendPrompt(a.id, 0, a));
    $('#editBtn', root).addEventListener('click', () => openForm(a));
    $('#doneBtn', root)?.addEventListener('click', () => updateAppt(a.id, { status: 'done' }, 'Segnato come eseguito ✓'));
    $('#undoneBtn', root)?.addEventListener('click', () => updateAppt(a.id, { status: 'scheduled' }, 'Riportato in programma'));
    $('#unpayBtn', root)?.addEventListener('click', () => updateAppt(a.id, { paid: false, payment_method: null, paid_amount: null, paid_at: null }, 'Pagamento annullato'));
    $('#payBtn', root)?.addEventListener('click', () => showPay(root, a));
    $('#moreBtn', root).addEventListener('click', () => {
      $('#actBox', root).innerHTML = `
        <button class="btn" id="noshowBtn">Non presentata</button>
        <button class="btn" id="cancelBtn">${a.status === 'cancelled' ? 'Ripristina' : 'Annulla appuntamento'}</button>
        <button class="btn" id="dupBtn">${ICON.plus} Nuovo per lei</button>
        <button class="btn danger" id="delBtn2">${ICON.trash} Elimina</button>`;
      $('#noshowBtn', root).addEventListener('click', () => updateAppt(a.id, { status: 'noshow' }, 'Segnata come non presentata'));
      $('#cancelBtn', root).addEventListener('click', () => updateAppt(a.id, { status: a.status === 'cancelled' ? 'scheduled' : 'cancelled' }, a.status === 'cancelled' ? 'Ripristinato' : 'Appuntamento annullato'));
      $('#dupBtn', root).addEventListener('click', () => openForm(null, { name: a.client_name, phone: a.phone, date: S.sel }));
      $('#delBtn2', root).addEventListener('click', () => deleteAppt(a));
    });
  });
}

function showPay(root, a) {
  let method = 'contanti';
  const box = $('#payBox', root);
  box.innerHTML = `<div class="rem-box" style="margin-bottom:12px">
    <div class="hint">Come ha pagato?</div>
    <div class="pay-methods">${PAY_METHODS.map(([v, l]) => `<button type="button" data-m="${v}" class="${v === method ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label>Importo incassato (€)<input type="number" inputmode="decimal" step="0.5" id="payAmt" value="${a.price ?? ''}"></label>
    <button class="btn ok block" id="payConfirm">${ICON.check} Conferma pagamento</button>
  </div>`;
  $$('[data-m]', box).forEach((b) => b.addEventListener('click', () => { method = b.dataset.m; $$('[data-m]', box).forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#payConfirm', box).addEventListener('click', () => {
    const amt = $('#payAmt', box).value;
    updateAppt(a.id, { paid: true, payment_method: method, paid_amount: amt === '' ? a.price : Number(amt), paid_at: new Date().toISOString(), status: a.status === 'cancelled' ? 'cancelled' : 'done' }, 'Pagamento registrato 💛');
  });
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function updateAppt(id, patch, msg) {
  const { error } = await sb.from('appointments').update(patch).eq('id', id);
  if (error) return fail(error);
  toast(msg);
  openDetail(id);
  if (S.tab !== 'impostazioni') setTab(S.tab);
}

/* ───────── Messaggio alla cliente ───────── */
function buildClientText(a) {
  const d = new Date(a.starts_at);
  const tpl = S.settings.client_template || 'Ciao {nome}! Ti ricordiamo il tuo appuntamento {quando} alle {ora}.';
  return tpl.replaceAll('{nome}', (a.client_name || '').split(' ')[0])
    .replaceAll('{quando}', whenLabel(d)).replaceAll('{data}', fmtLong(d))
    .replaceAll('{ora}', hm(d)).replaceAll('{servizi}', a.services.join(', ').toLowerCase());
}
async function openSendPrompt(id, slot, appt) {
  let a = appt;
  if (!a) { const r = await sb.from('appointments').select('*').eq('id', id).maybeSingle(); a = r.data; }
  if (!a) return toast('Appuntamento non trovato');
  const phone = normalizePhone(a.phone);
  if (!phone) return toast('Manca il numero di cellulare');
  const text = buildClientText(a);
  openSheet(`
    ${sheetHead('Promemoria per ' + esc(a.client_name), esc(a.phone))}
    <div class="form">
      <label>Messaggio<textarea id="msgText" rows="5">${esc(text)}</textarea></label>
      <button class="btn gold block" id="sendWa">${ICON.chat} Invia con WhatsApp</button>
      <button class="btn block" id="sendSms">${ICON.send} Invia con SMS</button>
      <p class="note">Si apre WhatsApp (o Messaggi) con il testo già pronto: tocca solo "Invia".</p>
    </div>`, (root) => {
    const t = () => encodeURIComponent($('#msgText', root).value);
    $('#sendWa', root).addEventListener('click', () => { window.open(`https://wa.me/${phone.replace('+', '')}?text=${t()}`, '_blank'); });
    $('#sendSms', root).addEventListener('click', () => { location.href = `sms:${phone}${/iPhone|iPad|Mac/.test(navigator.userAgent) ? '&' : '?'}body=${t()}`; });
  });
}

/* ───────── Clienti ───────── */
async function renderClients() {
  setTop('Rubrica', 'Clienti');
  const view = $('#view');
  view.innerHTML = `<input class="search" type="search" id="cq" placeholder="Cerca per nome o numero…" value="${esc(S.clientQuery)}"><div class="list" id="clist"><div class="muted">Caricamento…</div></div>`;
  const [{ data: clients, error }, { data: appts }] = await Promise.all([
    sb.from('clients').select('*').order('name'),
    sb.from('appointments').select('client_id, starts_at, price, paid, paid_amount, status'),
  ]);
  if (error) return fail(error);
  if (S.tab !== 'clienti') return;
  const stats = {};
  (appts || []).forEach((a) => {
    if (!a.client_id) return;
    const s = stats[a.client_id] ||= { n: 0, last: null, spent: 0 };
    if (a.status !== 'cancelled') s.n++;
    const d = new Date(a.starts_at);
    if (d <= new Date() && (!s.last || d > s.last)) s.last = d;
    if (a.paid) s.spent += Number(a.paid_amount ?? a.price ?? 0);
  });
  const draw = () => {
    const q = S.clientQuery.toLowerCase();
    const list = (clients || []).filter((c) => !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q.replace(/\s/g, '')));
    $('#clist').innerHTML = list.length ? list.map((c) => {
      const s = stats[c.id] || { n: 0 };
      const ph = normalizePhone(c.phone);
      return `<div class="client glass" data-id="${c.id}">
        <div class="avatar">${esc(initials(c.name))}</div>
        <div class="info"><strong>${esc(c.name)}</strong><small>${s.n} ${s.n === 1 ? 'visita' : 'visite'}${s.last ? ' · ultima ' + fmtShort(s.last) : ''}${s.spent ? ' · ' + eur(s.spent) : ''}</small></div>
        ${ph ? `<a class="mini-btn" href="tel:${ph}" aria-label="Chiama" onclick="event.stopPropagation()">${ICON.phone}</a>
        <a class="mini-btn" href="https://wa.me/${ph.replace('+', '')}" target="_blank" rel="noopener" aria-label="WhatsApp" onclick="event.stopPropagation()">${ICON.chat}</a>` : ''}
      </div>`;
    }).join('') : `<div class="empty glass"><div class="spark">✦</div><div class="serif">${q ? 'Nessun risultato' : 'Ancora nessuna cliente'}</div><div class="muted">Le clienti vengono salvate in automatico quando crei un appuntamento</div></div>`;
    $$('.client', $('#clist')).forEach((el) => el.addEventListener('click', () => openClient(clients.find((c) => c.id === el.dataset.id), stats[el.dataset.id])));
  };
  draw();
  $('#cq').addEventListener('input', (e) => { S.clientQuery = e.target.value; draw(); });
}

async function openClient(c, s = {}) {
  const { data: hist } = await sb.from('appointments').select('*').eq('client_id', c.id).order('starts_at', { ascending: false }).limit(50);
  openSheet(`
    ${sheetHead(esc(c.name), esc(c.phone || 'Nessun numero'))}
    <div class="stats">
      <div class="stat glass"><small>Visite</small><b>${s?.n || 0}</b></div>
      <div class="stat glass"><small>Speso</small><b>${eur(s?.spent || 0)}</b></div>
      <div class="stat glass"><small>Ultima</small><b style="font-size:18px">${s?.last ? fmtShort(s.last) : '—'}</b></div>
    </div>
    <div class="form">
      <label>Nome<input id="cName" value="${esc(c.name)}"></label>
      <label>Cellulare<input id="cPhone" type="tel" value="${esc(c.phone || '')}"></label>
      <label>Note cliente<textarea id="cNotes" placeholder="Formula colore abituale, preferenze…">${esc(c.notes || '')}</textarea></label>
      <div class="actions">
        <button class="btn gold" id="cSave">Salva</button>
        <button class="btn" id="cNew">${ICON.plus} Appuntamento</button>
      </div>
    </div>
    <div class="section-t" style="margin:20px 0 10px">Storico</div>
    <div class="list">${(hist || []).length ? hist.map(apptCard).join('') : '<div class="muted">Nessun appuntamento</div>'}</div>
    <button class="btn danger block" id="cDel" style="margin-top:16px">${ICON.trash} Elimina cliente</button>
  `, (root) => {
    $$('.appt', root).forEach((el) => el.addEventListener('click', () => openDetail(el.dataset.id)));
    $('#cNew', root).addEventListener('click', () => openForm(null, { name: c.name, phone: c.phone, date: S.sel }));
    $('#cSave', root).addEventListener('click', async () => {
      const { error } = await sb.from('clients').update({ name: $('#cName', root).value.trim(), phone: normalizePhone($('#cPhone', root).value) || null, notes: $('#cNotes', root).value.trim() || null }).eq('id', c.id);
      if (error) return fail(error.code === '23505' ? { message: 'Esiste già una cliente con questo numero' } : error);
      toast('Cliente aggiornata ✨'); closeSheet(); renderClients();
    });
    $('#cDel', root).addEventListener('click', async () => {
      if (!confirm(`Eliminare ${c.name} dalla rubrica? Gli appuntamenti restano in agenda.`)) return;
      const { error } = await sb.from('clients').delete().eq('id', c.id);
      if (error) return fail(error);
      closeSheet(); renderClients();
    });
  });
}

/* ───────── Cassa ───────── */
async function renderCassa() {
  setTop('Incassi', 'Cassa');
  const now = new Date();
  let from, to = addDays(startOfDay(now), 1), label;
  if (S.cassaPeriod === 'oggi') { from = startOfDay(now); label = 'oggi'; }
  else if (S.cassaPeriod === 'settimana') { from = startOfWeek(now); to = addDays(from, 7); label = 'questa settimana'; }
  else { from = new Date(now.getFullYear(), now.getMonth(), 1); to = new Date(now.getFullYear(), now.getMonth() + 1, 1); label = now.toLocaleDateString('it-IT', { month: 'long' }); }
  const view = $('#view');
  view.innerHTML = `<div class="seg period" id="per">
    ${[['oggi', 'Oggi'], ['settimana', 'Settimana'], ['mese', 'Mese']].map(([v, l]) => `<button data-p="${v}" class="${S.cassaPeriod === v ? 'on' : ''}">${l}</button>`).join('')}
  </div><div id="cassaBody"><div class="muted">Caricamento…</div></div>`;
  $$('#per button').forEach((b) => b.addEventListener('click', () => { S.cassaPeriod = b.dataset.p; renderCassa(); }));
  const { data, error } = await sb.from('appointments').select('*').gte('starts_at', from.toISOString()).lt('starts_at', to.toISOString()).order('starts_at');
  if (error) return fail(error);
  if (S.tab !== 'cassa') return;
  const { data: unpaidAll } = await sb.from('appointments').select('*').eq('status', 'done').eq('paid', false).order('starts_at', { ascending: false }).limit(30);
  if (S.tab !== 'cassa') return;
  const list = data || [];
  const paid =list.filter((a) => a.paid);
  const incassato = paid.reduce((s, a) => s + Number(a.paid_amount ?? a.price ?? 0), 0);
  const done = list.filter((a) => a.status === 'done').length;
  const previsto = list.filter((a) => a.status === 'scheduled' && !a.paid).reduce((s, a) => s + Number(a.price || 0), 0);
  const byM = {}; paid.forEach((a) => { const m = a.payment_method || 'altro'; byM[m] = (byM[m] || 0) + Number(a.paid_amount ?? a.price ?? 0); });
  const maxM = Math.max(1, ...Object.values(byM));
  const bySvc = {}; list.filter((a) => a.status !== 'cancelled').forEach((a) => a.services.forEach((s) => { bySvc[s] = (bySvc[s] || 0) + 1; }));
  const maxS = Math.max(1, ...Object.values(bySvc));

  $('#cassaBody').innerHTML = `
    <div class="stats">
      <div class="stat glass"><small>Incassato</small><b>${eur(incassato)}</b></div>
      <div class="stat glass"><small>Eseguiti</small><b>${done}</b></div>
      <div class="stat glass"><small>Previsto</small><b>${eur(previsto)}</b></div>
    </div>
    <div class="card glass"><h3>Metodi di pagamento <span class="muted" style="font-size:13px;font-family:Jost">· ${esc(label)}</span></h3>
      ${Object.keys(byM).length ? PAY_METHODS.filter(([v]) => byM[v]).map(([v, l]) => `<div class="bar-row"><span>${l}</span><div class="bar"><i style="width:${(byM[v] / maxM) * 100}%"></i></div><span>${eur(byM[v])}</span></div>`).join('') : '<div class="muted">Nessun incasso nel periodo</div>'}
    </div>
    <div class="card glass"><h3>Servizi più richiesti</h3>
      ${Object.keys(bySvc).length ? Object.entries(bySvc).sort((a, b) => b[1] - a[1]).map(([s, n]) => `<div class="bar-row"><span>${esc(s)}</span><div class="bar"><i style="width:${(n / maxS) * 100}%;background:${svcColor(s)}"></i></div><span>${n}</span></div>`).join('') : '<div class="muted">Nessun servizio nel periodo</div>'}
    </div>
    <div class="card glass"><h3>Da incassare</h3>
      <div class="list">${(unpaidAll || []).length ? unpaidAll.map(apptCard).join('') : '<div class="muted">Tutto incassato ✨</div>'}</div>
    </div>`;
  $$('.appt', view).forEach((c) => c.addEventListener('click', () => openDetail(c.dataset.id)));
}

/* ───────── Impostazioni ───────── */
async function renderSettings() {
  setTop(isAdmin() ? 'Amministratrice' : 'Il tuo profilo', 'Impostazioni');
  const st = S.settings;
  const admin = isAdmin();
  const [pushOk, bioAvail] = await Promise.all([hasPushSubscription(), bio.available()]);
  if (S.tab !== 'impostazioni') return;
  const bioOn = bio.enabledFor(S.user.id);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const dis = admin ? '' : 'disabled';
  const opt = (opts, v) => opts.map(([val, l]) => `<option value="${val}" ${Number(v) === val ? 'selected' : ''}>${l}</option>`).join('');
  $('#view').innerHTML = `
    ${!standalone ? `<div class="install-tip glass"><div style="font-size:24px">📲</div><div><b>Installa l'app sul telefono</b><br>
      ${isIOS ? 'In Safari tocca <b>Condividi</b> ⬆️ e poi <b>"Aggiungi alla schermata Home"</b>. Necessario su iPhone per ricevere le notifiche.' : 'Apri il menu ⋮ del browser e scegli <b>"Installa app"</b> o <b>"Aggiungi a schermata Home"</b>.'}
      ${deferredInstall ? '<br><button class="btn gold" id="installBtn" style="margin-top:10px">Installa ora</button>' : ''}</div></div>` : ''}

    <div class="card glass">
      <h3>Il mio account</h3>
      <div class="member" style="padding-top:0">
        <div class="avatar">${esc(initials(S.me?.full_name || S.user.email))}</div>
        <div class="info"><strong>${esc(S.me?.full_name || '')} ${admin ? '<span class="badge info">Admin</span>' : ''}</strong><small>${esc(S.user.email)}</small></div>
      </div>
      <div class="toggle-row" style="margin-top:8px">
        <div>Accesso con Face ID / impronta<small>${bioAvail ? (bioOn ? 'Attivo su questo telefono' : 'Sblocca l\'app senza digitare la password') : 'Non disponibile su questo dispositivo/browser'}</small></div>
        <label class="switch" aria-label="Face ID o impronta"><input type="checkbox" id="bioToggle" ${bioOn ? 'checked' : ''} ${bioAvail ? '' : 'disabled'}><span></span></label>
      </div>
      <div class="actions">
        <button class="btn" id="chPwd">Cambia password</button>
        <button class="btn danger" id="logout">Esci</button>
      </div>
    </div>

    <div class="card glass">
      <h3>Notifiche</h3>
      <div class="status-line"><span class="status-dot ${pushOk ? 'on' : ''}"></span>${pushOk ? 'Attive su questo dispositivo' : 'Non attive su questo dispositivo'}</div>
      <div class="actions">
        <button class="btn ${pushOk ? '' : 'gold'}" id="pushBtn">${ICON.bell} ${pushOk ? 'Riattiva' : 'Attiva notifiche'}</button>
        <button class="btn" id="testPush" ${pushOk ? '' : 'disabled'}>Prova notifica</button>
      </div>
    </div>

    ${admin ? `<div class="card glass">
      <h3>Team</h3>
      <div id="teamBox"></div>
      <button class="btn gold block" id="addMember" style="margin-top:10px">${ICON.plus} Nuovo dipendente</button>
    </div>` : ''}

    <div class="card glass form">
      <h3>Promemoria predefiniti</h3>
      ${admin ? '' : '<p class="note" style="margin:-6px 0 0">Solo l\'amministratrice può modificare queste impostazioni.</p>'}
      <label>🔔 Per l'operatrice<div class="row"><select id="dS1" ${dis}>${opt(STAFF_OPTS, st.staff_r1)}</select><select id="dS2" ${dis}>${opt(STAFF_OPTS, st.staff_r2)}</select></div></label>
      <label>💬 Per la cliente<div class="row"><select id="dC1" ${dis}>${opt(CLIENT_OPTS, st.client_r1)}</select><select id="dC2" ${dis}>${opt(CLIENT_OPTS, st.client_r2)}</select></div></label>
      <div class="row">
        <label>Canale predefinito<select id="dCh" ${dis}><option value="whatsapp" ${st.default_channel === 'whatsapp' ? 'selected' : ''}>WhatsApp</option><option value="sms" ${st.default_channel === 'sms' ? 'selected' : ''}>SMS</option><option value="nessuno" ${st.default_channel === 'nessuno' ? 'selected' : ''}>Nessuno</option></select></label>
        <label>Durata predefinita<select id="dDur" ${dis}>${DURATIONS.map((m) => `<option value="${m}" ${m === st.default_duration ? 'selected' : ''}>${durLabel(m)}</option>`).join('')}</select></label>
      </div>
      <label>Testo del messaggio alla cliente<textarea id="dTpl" rows="4" ${dis}>${esc(st.client_template || '')}</textarea></label>
      <p class="note" style="margin:-4px 0 0">Puoi usare <code>{nome}</code> <code>{quando}</code> <code>{data}</code> <code>{ora}</code> <code>{servizi}</code></p>
      ${admin ? '<button class="btn gold block" id="saveDefaults">Salva impostazioni</button>' : ''}
    </div>

    ${admin ? `<div class="card glass">
      <h3>Servizi e listino</h3>
      <div id="svcList"></div>
      <button class="btn block" id="addSvc2" style="margin-top:10px">${ICON.plus} Aggiungi servizio</button>
    </div>` : ''}
    <p class="note" style="text-align:center">Diva's Hairboutique · Agenda ✦</p>`;

  $('#installBtn')?.addEventListener('click', async () => { deferredInstall.prompt(); deferredInstall = null; });
  $('#chPwd').addEventListener('click', () => openPasswordSheet(false));
  $('#bioToggle').addEventListener('change', async (e) => {
    if (e.target.checked) {
      try { await bio.enable(); toast('Face ID / impronta attivati ✨'); }
      catch { e.target.checked = false; toast('Attivazione annullata'); }
    } else { bio.write(null); toast('Accesso biometrico disattivato'); }
    renderSettings();
  });
  $('#pushBtn').addEventListener('click', async () => { await enablePush(true); renderSettings(); });
  $('#testPush').addEventListener('click', async () => {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification("✨ Diva's — prova", { body: 'Le notifiche funzionano! Riceverai così i promemoria.', icon: 'img/icon-192.png', badge: 'img/icon-192.png' });
  });
  $('#logout').addEventListener('click', async () => {
    if (!confirm('Uscire dall\'account su questo telefono?')) return;
    bio.write(null); await sb.auth.signOut(); location.reload();
  });
  if (!admin) return;

  renderTeam($('#teamBox'));
  $('#addMember').addEventListener('click', openNewMemberSheet);
  $('#saveDefaults').addEventListener('click', async () => {
    const patch = {
      staff_r1: +$('#dS1').value, staff_r2: +$('#dS2').value, client_r1: +$('#dC1').value, client_r2: +$('#dC2').value,
      default_channel: $('#dCh').value, default_duration: +$('#dDur').value, client_template: $('#dTpl').value.trim(), updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from('settings').update(patch).eq('user_id', S.settings.user_id);
    if (error) return fail(error);
    Object.assign(S.settings, patch); toast('Impostazioni salvate ✨');
  });

  const drawSvcs = () => {
    $('#svcList').innerHTML = S.services.map((s) => `<div class="set-row" data-id="${s.id}">
      <input type="color" value="${s.color || '#c6a84b'}" aria-label="Colore">
      <input type="text" value="${esc(s.name)}" aria-label="Nome servizio">
      <input type="number" class="price" inputmode="decimal" step="0.5" value="${s.default_price ?? ''}" placeholder="€" aria-label="Prezzo">
      <button class="mini-btn" data-del aria-label="Elimina">${ICON.trash}</button></div>`).join('');
    $$('.set-row', $('#svcList')).forEach((row) => {
      const id = row.dataset.id;
      const [col, name, price] = $$('input', row);
      const save = async () => {
        const patch = { color: col.value, name: name.value.trim() || 'Servizio', default_price: price.value === '' ? null : Number(price.value) };
        const { error } = await sb.from('services').update(patch).eq('id', id);
        if (error) return fail(error);
        Object.assign(S.services.find((x) => x.id === id), patch); toast('Listino aggiornato');
      };
      [col, name, price].forEach((i) => i.addEventListener('change', save));
      $('[data-del]', row).addEventListener('click', async () => {
        if (!confirm(`Rimuovere "${name.value}" dal listino?`)) return;
        await sb.from('services').delete().eq('id', id);
        S.services = S.services.filter((x) => x.id !== id); drawSvcs();
      });
    });
  };
  drawSvcs();
  $('#addSvc2').addEventListener('click', async () => {
    const { data, error } = await sb.from('services').insert({ name: 'Nuovo servizio', color: '#a7e3c9', sort: S.services.length + 1 }).select().single();
    if (error) return fail(error);
    S.services.push(data); drawSvcs();
    const inputs = $$('.set-row input[type=text]'); inputs[inputs.length - 1].select();
  });
}

/* ───────── Push ───────── */
function urlB64ToUint8Array(b64) {
  const p = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
async function hasPushSubscription() {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    return !!(await reg.pushManager.getSubscription()) && Notification.permission === 'granted';
  } catch { return false; }
}
async function enablePush(interactive) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (interactive) toast(/iPhone|iPad/.test(navigator.userAgent) ? 'Su iPhone installa prima l\'app nella schermata Home' : 'Notifiche non supportate da questo browser');
    return false;
  }
  try {
    const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (perm !== 'granted') { if (interactive) toast('Permesso notifiche negato: abilitalo dalle impostazioni del telefono'); return false; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC) });
    const j = sub.toJSON();
    const { error } = await sb.from('push_subscriptions').upsert({ user_id: S.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) }, { onConflict: 'endpoint' });
    if (error) throw error;
    if (interactive) toast('Notifiche attive 🔔');
    return true;
  } catch (e) { if (interactive) fail(e); return false; }
}
async function refreshPushSubscription() {
  if ('Notification' in window && Notification.permission === 'granted') enablePush(false);
}
let askedPush = false;
async function maybeAskPush() {
  if (askedPush || !('Notification' in window) || Notification.permission !== 'default') return;
  askedPush = true;
  setTimeout(() => { if (confirm('Vuoi ricevere le notifiche dei promemoria su questo telefono?')) enablePush(true); }, 600);
}

/* ───────── Installazione PWA ───────── */
let deferredInstall = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; });
if ('serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(console.warn));
}

/* ───────── Avvio ───────── */
(async () => {
  const { data } = await sb.auth.getSession();
  if (!data.session) showAuth();
})();
