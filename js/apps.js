import { fs } from './fs.js';
import { store } from './store.js';
import { WALLPAPERS } from './catalog.js';
import { wm } from './wm.js';

export const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e[k] = v;
  }
  e.append(...kids);
  return e;
};
const fmtSize = (t, n) => (t === 'd' ? `${n} item${n === 1 ? '' : 's'}` : `${n} B`);

/* ---------- Files ---------- */
const files = {
  id: 'files', name: 'Files', icon: '📁',
  open(ctx, start = '/') {
    let cwd = start, sel = null;
    const bar = h('div', { class: 'path' });
    const list = h('div', { class: 'flist' });
    const go = p => { cwd = p; sel = null; render(); };
    const side = h('div', { class: 'fside' },
      ...['/', '/Desktop', '/Documents', '/Pictures', '/Downloads'].map(p =>
        h('button', { text: p === '/' ? '🖥  Root' : '📁  ' + p.slice(1), onclick: () => go(p) })));
    const tool = (label, fn) => h('button', { text: label, onclick: fn });
    const toolbar = h('div', { class: 'ftool' },
      tool('↑ Up', () => go(fs.norm(cwd, '..'))),
      tool('+ Folder', async () => { const n = prompt('Folder name'); if (n) { try { await fs.mkdir(fs.norm(cwd, n)); } catch (e) { alert(e.message); } render(); } }),
      tool('+ File', async () => { const n = prompt('File name'); if (n) { await fs.write(fs.norm(cwd, n), ''); render(); } }),
      tool('Delete', async () => { if (sel && confirm('Delete ' + sel + '?')) { await fs.rm(fs.norm(cwd, sel)); sel = null; render(); } }),
      bar);
    async function render() {
      bar.textContent = cwd;
      const items = await fs.list(cwd);
      list.replaceChildren(...(items.length ? items.map(it => {
        const row = h('div', { class: 'frow' + (sel === it.name ? ' sel' : '') },
          h('span', { text: it.type === 'd' ? '📁' : '📄' }), h('b', { text: it.name }), h('em', { text: fmtSize(it.type, it.size) }));
        row.addEventListener('click', () => { sel = it.name; render(); });
        row.addEventListener('dblclick', () => it.type === 'd' ? go(fs.norm(cwd, it.name)) : ctx.launch('notes', fs.norm(cwd, it.name)));
        return row;
      }) : [h('p', { class: 'empty', text: 'This folder is empty. Use + File or + Folder to add something.' })]));
    }
    render();
    return { content: h('div', { class: 'files' }, side, h('div', { class: 'fmain' }, toolbar, list)), w: 760, h: 480 };
  }
};

/* ---------- Notes ---------- */
const notes = {
  id: 'notes', name: 'Notes', icon: '📝',
  open(ctx, path) {
    const pathIn = h('input', { value: path || '/Documents/untitled.txt', spellcheck: false });
    const area = h('textarea', { placeholder: 'Start typing. Ctrl+S saves.', spellcheck: false });
    const status = h('span', { class: 'status', text: path ? 'Loading…' : 'New note' });
    const save = async () => {
      try { await fs.write(fs.norm('/', pathIn.value), area.value); status.textContent = 'Saved ' + new Date().toLocaleTimeString(); }
      catch (e) { status.textContent = e.message; }
    };
    if (path) fs.read(path).then(t => { area.value = t; status.textContent = 'Opened'; }).catch(e => status.textContent = e.message);
    area.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); } });
    return {
      key: 'notes' + (path ? ':' + path : ''),
      title: path ? 'Notes – ' + path.split('/').pop() : 'Notes',
      content: h('div', { class: 'notes' }, h('div', { class: 'ftool' }, pathIn, h('button', { text: 'Save', onclick: save }), status), area),
      w: 640, h: 480
    };
  }
};

/* ---------- Terminal ---------- */
const terminal = {
  id: 'terminal', name: 'Terminal', icon: '⌨️',
  open(ctx) {
    let cwd = '/', hist = [], hi = 0;
    const out = h('div', { class: 'tout' });
    const input = h('input', { spellcheck: false, autocomplete: 'off' });
    const ps = h('span', { class: 'ps' });
    const setPs = () => ps.textContent = `bro@os ${cwd} $`;
    const print = (t = '') => { out.append(h('div', { text: t })); out.scrollTop = out.scrollHeight; };
    const apps = () => ctx.catalog();
    const cmds = {
      help: () => print('help  ls  cd  cat  mkdir  touch  rm  echo  pwd  clear  date  open <app>  apps  mem  neofetch'),
      pwd: () => print(cwd),
      date: () => print(new Date().toString()),
      clear: () => out.replaceChildren(),
      echo: a => print(a.join(' ')),
      apps: () => print(apps().map(a => a.id).join('  ')),
      ls: async a => { const l = await fs.list(fs.norm(cwd, a[0] || '.')); print(l.map(i => i.type === 'd' ? i.name + '/' : i.name).join('  ') || '(empty)'); },
      cd: async a => { const p = fs.norm(cwd, a[0] || '/'); if ((await fs.node(p)).t !== 'd') throw new Error('Not a directory'); cwd = p; setPs(); },
      cat: async a => (await fs.read(fs.norm(cwd, a[0] || ''))).split('\n').forEach(print),
      mkdir: async a => fs.mkdir(fs.norm(cwd, a[0] || '')),
      touch: async a => fs.write(fs.norm(cwd, a[0] || ''), ''),
      rm: async a => fs.rm(fs.norm(cwd, a[0] || '')),
      open: a => { const t = (a[0] || '').toLowerCase(); const app = apps().find(x => x.id === t || x.name.toLowerCase() === t); if (!app) throw new Error('No such app: ' + t); ctx.launch(app.id); },
      mem: async () => { const m = await ctx.memory(); print(m ? `used ${m.usedGB} GB of ${m.totalGB} GB (${m.pct}%)` : 'Memory API unavailable'); },
      neofetch: () => ['BrowOS 0.2', 'Host: ' + navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0], 'Windows open: ' + wm.wins.size, 'Apps: ' + apps().length, 'Cores: ' + navigator.hardwareConcurrency].forEach(print)
    };
    input.addEventListener('keydown', async e => {
      if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); input.value = hist[hi] || ''; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; e.preventDefault(); }
      else if (e.key === 'Enter') {
        const line = input.value.trim(); input.value = '';
        if (!line) return;
        hist.push(line); hi = hist.length;
        print(`${ps.textContent} ${line}`);
        const [c, ...a] = line.split(/\s+/);
        try { if (!cmds[c]) throw new Error(c + ': command not found'); await cmds[c](a); } catch (err) { print(err.message); }
      }
    });
    setPs(); print('BrowOS terminal. Type "help".');
    const root = h('div', { class: 'term', onclick: () => input.focus() }, out, h('div', { class: 'tin' }, ps, input));
    setTimeout(() => input.focus(), 50);
    return { content: root, w: 640, h: 400 };
  }
};

/* ---------- Browser (framing only works for sites that allow it) ---------- */
const browser = {
  id: 'browser', name: 'Browser', icon: '🧭',
  open(ctx) {
    const frame = h('iframe', { src: 'https://en.wikipedia.org/' });
    const addr = h('input', { value: 'https://en.wikipedia.org/', spellcheck: false });
    const go = () => {
      let v = addr.value.trim();
      if (!/^https?:\/\//.test(v)) v = v.includes('.') && !v.includes(' ') ? 'https://' + v : 'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(v);
      addr.value = v; frame.src = v;
    };
    addr.addEventListener('keydown', e => e.key === 'Enter' && go());
    const note = h('div', { class: 'hint', text: 'Blank page? That site forbids being embedded. Use ⇱ to open it in its own window, or add it in Settings → Web apps.' });
    return {
      content: h('div', { class: 'browser' }, h('div', { class: 'ftool' }, addr, h('button', { text: 'Go', onclick: go })), note, frame),
      w: 900, h: 600, popout: () => chrome.windows.create({ url: addr.value, type: 'popup', width: 1100, height: 760 })
    };
  }
};

/* ---------- System monitor (honest RAM numbers for your benchmarks) ---------- */
const monitor = {
  id: 'monitor', name: 'Monitor', icon: '📈',
  open(ctx) {
    const bar = h('div', { class: 'bar' }, h('i'));
    const txt = h('p', { class: 'big' });
    const wlist = h('div', { class: 'flist' });
    const snaps = h('div', { class: 'flist' });
    const tip = h('p', { class: 'hint', text: 'This shows whole-system memory. For per-tab and per-process cost, open Brave Task Manager (Shift+Esc). Record a snapshot with and without your apps open to compare fairly.' });
    async function tick() {
      const m = await ctx.memory();
      if (m) { txt.textContent = `${m.usedGB} GB used of ${m.totalGB} GB  (${m.pct}%)`; bar.firstChild.style.width = m.pct + '%'; }
      wlist.replaceChildren(...[...wm.wins.values()].map(w => h('div', { class: 'frow' }, h('span', { text: w.icon }), h('b', { text: w.title }), h('em', { text: w.min ? 'minimized' : 'running' }))));
    }
    async function drawSnaps() {
      const s = await store.get('snapshots', []);
      snaps.replaceChildren(...s.map(x => h('div', { class: 'frow' }, h('span', { text: '📌' }), h('b', { text: x.label }), h('em', { text: x.usedGB + ' GB' }))));
    }
    const label = h('input', { placeholder: 'Label, e.g. "Windows apps open"' });
    const rec = h('button', { text: 'Record snapshot', onclick: async () => {
      const m = await ctx.memory(); if (!m) return;
      const s = await store.get('snapshots', []);
      s.push({ label: label.value || new Date().toLocaleTimeString(), usedGB: m.usedGB });
      await store.set('snapshots', s); label.value = ''; drawSnaps();
    } });
    const clr = h('button', { text: 'Clear', onclick: async () => { await store.set('snapshots', []); drawSnaps(); } });
    const iv = setInterval(() => { if (!document.body.contains(root)) clearInterval(iv); else tick(); }, 2000);
    const root = h('div', { class: 'mon' }, txt, bar, h('h4', { text: 'Open windows' }), wlist, h('h4', { text: 'Snapshots' }), h('div', { class: 'ftool' }, label, rec, clr), snaps, tip);
    tick(); drawSnaps();
    return { content: root, w: 520, h: 540 };
  }
};

/* ---------- Settings ---------- */
const settings = {
  id: 'settings', name: 'Settings', icon: '⚙️',
  open(ctx) {
    const sw = h('div', { class: 'swatches' }, ...WALLPAPERS.map((w, i) =>
      h('button', { class: 'sw', title: w.name, style: 'background:' + w.css, onclick: () => ctx.setWallpaper({ type: 'preset', v: i }) })));
    const upload = h('input', { type: 'file', accept: 'image/*', onchange: e => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = () => ctx.setWallpaper({ type: 'img', v: r.result }); r.readAsDataURL(f);
    } });
    const accent = h('input', { type: 'color', value: ctx.accent(), oninput: e => ctx.setAccent(e.target.value) });

    const name = h('input', { placeholder: 'Name' });
    const url = h('input', { placeholder: 'https://example.com' });
    const embed = h('input', { type: 'checkbox', checked: true });
    const msg = h('p', { class: 'hint' });
    const clist = h('div', { class: 'flist' });
    const drawCustom = () => clist.replaceChildren(...ctx.getCustom().map(a => h('div', { class: 'frow' }, h('span', { text: a.icon }), h('b', { text: a.name }), h('em', { text: new URL(a.url).hostname }),
      h('button', { text: 'Remove', onclick: async () => { await ctx.setCustom(ctx.getCustom().filter(x => x.id !== a.id)); drawCustom(); } }))));
    const add = h('button', { text: 'Add web app', onclick: async () => {
      let u; try { u = new URL(url.value); if (u.protocol !== 'https:') throw 0; } catch { msg.textContent = 'Enter a full https:// address.'; return; }
      const ok = await chrome.permissions.request({ origins: [u.origin + '/*'] });
      if (!ok) { msg.textContent = 'Permission was declined, so the app was not added.'; return; }
      await ctx.setCustom([...ctx.getCustom(), { id: 'c' + Date.now(), name: name.value || u.hostname, url: u.href, icon: '🌐', embed: embed.checked }]);
      name.value = url.value = ''; msg.textContent = 'Added. Find it on your desktop.'; drawCustom();
    } });
    const reset = h('button', { class: 'danger', text: 'Reset files', onclick: async () => { if (confirm('Erase all virtual files?')) { await fs.reset(); } } });
    drawCustom();
    return {
      content: h('div', { class: 'settings' },
        h('h4', { text: 'Wallpaper' }), sw, h('div', { class: 'ftool' }, h('span', { text: 'Or use your own' }), upload),
        h('h4', { text: 'Accent colour' }), accent,
        h('h4', { text: 'Web apps' }),
        h('p', { class: 'hint', text: 'Each app you add asks for permission to its own site only. Apps that cannot be embedded still open in a popup window.' }),
        h('div', { class: 'ftool' }, name, url), h('label', { class: 'chk' }, embed, ' Embed in a window'), add, msg, clist,
        h('h4', { text: 'Data' }), reset),
      w: 560, h: 560
    };
  }
};

export const NATIVE = [files, notes, terminal, browser, monitor, settings];
