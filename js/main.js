import { NATIVE } from './apps.js';
import { WEB_APPS, WALLPAPERS } from './catalog.js';
import { wm } from './wm.js';
import { store } from './store.js';

const $ = s => document.querySelector(s);
const CELL_W = 100, CELL_H = 108, PAD = 16;
let custom = [], prefs = { wall: { type: 'preset', v: 0 }, accent: '#7fb4ff' }, pos = {};

const catalog = () => [...NATIVE, ...WEB_APPS, ...custom].map(a => ({ ...a, web: !!a.url }));

/* ---------- launching ---------- */
const popup = url => chrome.windows.create({ url, type: 'popup', width: 1100, height: 760 });

function launch(id, arg) {
  const a = catalog().find(x => x.id === id);
  if (!a) return;
  $('#start').hidden = true;
  if (a.web) {
    if (!a.embed) return popup(a.url);
    const f = document.createElement('iframe');
    f.src = a.url;
    f.allow = 'clipboard-read; clipboard-write; fullscreen; autoplay; encrypted-media';
    wm.open({ key: a.id, title: a.name, icon: a.icon, w: 1000, h: 640, content: f, popout: () => popup(a.url) });
  } else {
    const r = a.open(ctx, arg);
    wm.open({ key: r.key || a.id, title: r.title || a.name, icon: a.icon, w: r.w, h: r.h, content: r.content, popout: r.popout });
  }
}

/* ---------- system context handed to apps ---------- */
async function memory() {
  if (!chrome.system?.memory) return null;
  const m = await chrome.system.memory.getInfo();
  const used = m.capacity - m.availableCapacity;
  return { totalGB: (m.capacity / 2 ** 30).toFixed(1), usedGB: (used / 2 ** 30).toFixed(1), pct: Math.round(used / m.capacity * 100) };
}
const ctx = {
  launch, memory, catalog,
  accent: () => prefs.accent,
  getCustom: () => custom,
  async setCustom(list) {
    custom = list;
    await store.set('customApps', list);
    await chrome.runtime.sendMessage('rebuild'); // re-scope the header rule
    renderDesktop(); renderStart();
  },
  async setWallpaper(w) { prefs.wall = w; await store.set('prefs', prefs); applyTheme(); },
  async setAccent(c) { prefs.accent = c; await store.set('prefs', prefs); applyTheme(); }
};

function applyTheme() {
  const w = prefs.wall, el = $('#wall');
  el.style.cssText = '';
  if (w.type === 'img') el.style.background = `center / cover url("${w.v}")`;
  else el.style.background = (WALLPAPERS[w.v] || WALLPAPERS[0]).css;
  document.documentElement.style.setProperty('--accent', prefs.accent);
}

/* ---------- desktop icons on a snapping grid ---------- */
const rows = () => Math.max(1, Math.floor((innerHeight - 84 - PAD) / CELL_H));
const cols = () => Math.max(1, Math.floor((innerWidth - PAD) / CELL_W));
const key = (c, r) => c + ',' + r;

function freeCell(taken, fromC = 0, fromR = 0) {
  let best = null, bd = Infinity;
  for (let c = 0; c < cols(); c++) for (let r = 0; r < rows(); r++) {
    if (taken.has(key(c, r))) continue;
    const d = (c - fromC) ** 2 + (r - fromR) ** 2;
    if (d < bd) { bd = d; best = [c, r]; }
  }
  return best || [0, 0];
}

function renderDesktop() {
  const d = $('#desktop');
  d.replaceChildren();
  const apps = catalog();
  const taken = new Set(Object.entries(pos).filter(([id]) => apps.some(a => a.id === id)).map(([, p]) => key(...p)));
  apps.forEach((a, i) => {
    if (!pos[a.id]) { const p = freeCell(taken, Math.floor(i / rows()), i % rows()); pos[a.id] = p; taken.add(key(...p)); }
  });
  apps.forEach(a => d.append(makeIcon(a)));
}

function makeIcon(a) {
  const el = document.createElement('div');
  el.className = 'icon';
  el.innerHTML = '<div class="tile"></div><span></span>';
  el.firstChild.textContent = a.icon;
  el.lastChild.textContent = a.name;
  const place = () => { el.style.left = PAD + pos[a.id][0] * CELL_W + 'px'; el.style.top = PAD + pos[a.id][1] * CELL_H + 'px'; };
  place();

  let sx, sy, ox, oy, moved;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    document.querySelectorAll('.icon.sel').forEach(x => x.classList.remove('sel'));
    el.classList.add('sel');
    el.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY; ox = el.offsetLeft; oy = el.offsetTop; moved = false;
    el.style.transition = 'none';
  });
  el.addEventListener('pointermove', e => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 5) moved = true;
    if (moved) { el.style.left = ox + e.clientX - sx + 'px'; el.style.top = oy + e.clientY - sy + 'px'; el.style.zIndex = 5; }
  });
  el.addEventListener('pointerup', async () => {
    el.style.transition = ''; el.style.zIndex = '';
    if (!moved) return;
    const c = Math.min(cols() - 1, Math.max(0, Math.round((el.offsetLeft - PAD) / CELL_W)));
    const r = Math.min(rows() - 1, Math.max(0, Math.round((el.offsetTop - PAD) / CELL_H)));
    const taken = new Set(Object.entries(pos).filter(([id]) => id !== a.id).map(([, p]) => key(...p)));
    pos[a.id] = taken.has(key(c, r)) ? freeCell(taken, c, r) : [c, r];
    place();
    await store.set('iconPos', pos);
  });
  el.addEventListener('dblclick', () => launch(a.id));
  return el;
}

/* ---------- dock, tray, clock ---------- */
const PINNED = ['files', 'browser', 'terminal', 'notes', 'settings'];

function renderDock() {
  const dock = $('#dock');
  const start = document.createElement('button');
  start.className = 'di start'; start.title = 'Start';
  start.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="9" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="15" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  start.onclick = e => { e.stopPropagation(); const s = $('#start'); s.hidden = !s.hidden; if (!s.hidden) $('#start input').focus(); };

  const apps = catalog();
  const entries = PINNED.map(id => apps.find(a => a.id === id)).filter(Boolean).map(a => ({ app: a, key: a.id }));
  wm.wins.forEach((w, k) => { if (!entries.some(e => w.key === e.key || k.startsWith(e.key + ':'))) entries.push({ app: { icon: w.icon, name: w.title }, key: k }); });

  const btns = entries.map(({ app, key: k }) => {
    const running = [...wm.wins.keys()].find(x => x === k || x.startsWith(k + ':'));
    const b = document.createElement('button');
    b.className = 'di' + (running ? ' run' : '') + (running && wm.wins.get(running).el.classList.contains('active') ? ' act' : '');
    b.title = app.name; b.textContent = app.icon;
    b.onclick = () => running ? wm.toggle(running) : launch(k);
    return b;
  });

  const tray = document.createElement('div');
  tray.className = 'tray';
  tray.innerHTML = '<span id="mem"></span><span id="clock"><b></b><small></small></span>';
  dock.replaceChildren(start, ...btns, tray);
  tick(); updateMem();
}
wm.onChange = renderDock;

function tick() {
  const n = new Date(), c = $('#clock');
  if (!c) return;
  c.querySelector('b').textContent = n.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  c.querySelector('small').textContent = n.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}
async function updateMem() {
  const m = await memory(), el = $('#mem');
  if (el && m) el.textContent = `RAM ${m.pct}%`;
}

/* ---------- start menu ---------- */
function renderStart() {
  const s = $('#start');
  s.innerHTML = '<input placeholder="Search apps" spellcheck="false"><div class="grid"></div><div class="foot"><span>BrowOS 0.2</span><button id="off">Close tab</button></div>';
  const grid = s.querySelector('.grid'), input = s.querySelector('input');
  const draw = q => {
    grid.replaceChildren(...catalog().filter(a => a.name.toLowerCase().includes(q.toLowerCase())).map(a => {
      const b = document.createElement('button');
      b.innerHTML = '<div class="tile"></div><span></span>';
      b.firstChild.textContent = a.icon; b.lastChild.textContent = a.name;
      b.onclick = () => launch(a.id);
      return b;
    }));
  };
  input.oninput = () => draw(input.value);
  input.onkeydown = e => { if (e.key === 'Enter') grid.firstChild?.click(); };
  s.querySelector('#off').onclick = () => window.close();
  draw('');
}

/* ---------- context menu & global events ---------- */
function showCtx(x, y) {
  const m = $('#ctx');
  m.innerHTML = '';
  [['Open Settings', () => launch('settings')], ['Open Terminal', () => launch('terminal')], ['Open Files', () => launch('files')],
   ['Reset icon layout', async () => { pos = {}; await store.set('iconPos', pos); renderDesktop(); }]].forEach(([t, f]) => {
    const b = document.createElement('button'); b.textContent = t; b.onclick = f; m.append(b);
  });
  m.style.left = Math.min(x, innerWidth - 200) + 'px';
  m.style.top = Math.min(y, innerHeight - 180) + 'px';
  m.hidden = false;
}
document.addEventListener('contextmenu', e => { if (e.target.closest('#desktop, #wall')) { e.preventDefault(); showCtx(e.clientX, e.clientY); } });
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#ctx')) $('#ctx').hidden = true;
  if (!e.target.closest('#start') && !e.target.closest('#dock')) $('#start').hidden = true;
  if (!e.target.closest('.icon')) document.querySelectorAll('.icon.sel').forEach(x => x.classList.remove('sel'));
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('#start').hidden = true; $('#ctx').hidden = true; } });
addEventListener('resize', () => renderDesktop());

/* ---------- boot ---------- */
(async () => {
  prefs = { ...prefs, ...(await store.get('prefs', {})) };
  custom = await store.get('customApps', []);
  pos = await store.get('iconPos', {});
  applyTheme();
  renderDesktop();
  renderStart();
  renderDock();
  store.set('iconPos', pos);
  setInterval(tick, 1000);
  setInterval(updateMem, 5000);
})();
