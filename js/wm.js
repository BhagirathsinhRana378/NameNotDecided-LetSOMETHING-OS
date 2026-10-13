// Window manager: focus, drag, edge-resize, minimize, maximize, edge snapping.
const DOCK = 84;
const layer = () => document.getElementById('windows');
const snapBox = () => document.getElementById('snap');

export const wm = {
  wins: new Map(),
  z: 10,
  onChange: () => {},

  open({ key, title, icon, w = 760, h = 520, content, popout }) {
    if (this.wins.has(key)) { this.focus(key); return this.wins.get(key); }

    const el = document.createElement('div');
    el.className = 'win';
    el.innerHTML = `
      <div class="tb">
        <span class="ti"></span>
        <span class="ctl">
          ${popout ? '<button data-a="pop" title="Open in its own window">⇱</button>' : ''}
          <button data-a="min" title="Minimize">–</button>
          <button data-a="max" title="Maximize">▢</button>
          <button data-a="close" class="x" title="Close">✕</button>
        </span>
      </div>
      <div class="body"></div>
      <i class="rz r"></i><i class="rz b"></i><i class="rz br"></i>`;
    el.querySelector('.ti').textContent = `${icon || ''}  ${title}`;
    el.querySelector('.body').append(content);

    const n = this.wins.size;
    const W = Math.min(w, innerWidth - 40), H = Math.min(h, innerHeight - DOCK - 40);
    Object.assign(el.style, {
      width: W + 'px', height: H + 'px',
      left: Math.max(10, (innerWidth - W) / 2 + (n % 6) * 28 - 60) + 'px',
      top: Math.max(10, (innerHeight - DOCK - H) / 2 + (n % 6) * 24 - 30) + 'px'
    });
    layer().append(el);

    const win = { key, title, icon, el, max: false, prev: null, min: false };
    this.wins.set(key, win);

    el.addEventListener('pointerdown', () => this.focus(key), true);
    el.querySelector('.ctl').addEventListener('click', e => {
      const a = e.target.dataset.a;
      if (a === 'close') this.close(key);
      if (a === 'min') this.minimize(key);
      if (a === 'max') this.toggleMax(key);
      if (a === 'pop') popout();
    });
    el.querySelector('.tb').addEventListener('dblclick', e => {
      if (!e.target.closest('.ctl')) this.toggleMax(key);
    });
    this._drag(win);
    this._resize(win);
    this.focus(key);
    return win;
  },

  focus(key) {
    const win = this.wins.get(key);
    if (!win) return;
    win.min = false;
    win.el.classList.remove('min');
    win.el.style.zIndex = ++this.z;
    this.wins.forEach(x => x.el.classList.toggle('active', x === win));
    this.onChange();
  },

  minimize(key) {
    const win = this.wins.get(key);
    win.min = true;
    win.el.classList.add('min');
    win.el.classList.remove('active');
    this.onChange();
  },

  toggle(key) {
    const win = this.wins.get(key);
    if (win.min || !win.el.classList.contains('active')) this.focus(key);
    else this.minimize(key);
  },

  close(key) {
    const win = this.wins.get(key);
    if (!win) return;
    win.el.remove();
    this.wins.delete(key);
    this.onChange();
  },

  toggleMax(key) {
    const win = this.wins.get(key);
    const s = win.el.style;
    if (win.max) {
      Object.assign(s, win.prev);
      win.el.classList.remove('max');
      win.max = false;
    } else {
      win.prev = { left: s.left, top: s.top, width: s.width, height: s.height };
      Object.assign(s, { left: '8px', top: '8px', width: innerWidth - 16 + 'px', height: innerHeight - DOCK - 16 + 'px' });
      win.el.classList.add('max');
      win.max = true;
    }
  },

  snap(win, mode) {
    const s = win.el.style;
    if (!win.max) win.prev = win.prev && win.snapped ? win.prev : { left: s.left, top: s.top, width: s.width, height: s.height };
    const hh = innerHeight - DOCK - 16, hw = (innerWidth - 24) / 2;
    if (mode === 'top') { this.toggleMax(win.key); return; }
    Object.assign(s, { top: '8px', height: hh + 'px', width: hw + 'px', left: mode === 'left' ? '8px' : 16 + hw + 'px' });
    win.snapped = true; win.max = false;
  },

  _drag(win) {
    const tb = win.el.querySelector('.tb');
    tb.addEventListener('pointerdown', e => {
      if (e.target.closest('.ctl') || e.button !== 0) return;
      if (win.max) {
        // pull a maximized window back to its previous size under the cursor
        const ratio = e.clientX / innerWidth;
        this.toggleMax(win.key);
        win.el.style.left = e.clientX - parseFloat(win.el.style.width) * ratio + 'px';
        win.el.style.top = '0px';
      }
      const r = win.el.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      let mode = null;
      tb.setPointerCapture(e.pointerId);
      document.body.classList.add('dragging');

      const move = ev => {
        win.el.style.left = ev.clientX - dx + 'px';
        win.el.style.top = Math.max(0, ev.clientY - dy) + 'px';
        mode = ev.clientY < 8 ? 'top' : ev.clientX < 8 ? 'left' : ev.clientX > innerWidth - 8 ? 'right' : null;
        const b = snapBox();
        b.hidden = !mode;
        if (mode) {
          const hw = innerWidth / 2;
          Object.assign(b.style, mode === 'top'
            ? { left: '8px', top: '8px', width: innerWidth - 16 + 'px', height: innerHeight - DOCK - 16 + 'px' }
            : { left: (mode === 'left' ? 8 : hw + 4) + 'px', top: '8px', width: hw - 12 + 'px', height: innerHeight - DOCK - 16 + 'px' });
        }
      };
      const up = () => {
        tb.removeEventListener('pointermove', move);
        tb.removeEventListener('pointerup', up);
        document.body.classList.remove('dragging');
        snapBox().hidden = true;
        if (mode) this.snap(win, mode);
      };
      tb.addEventListener('pointermove', move);
      tb.addEventListener('pointerup', up);
    });
  },

  _resize(win) {
    win.el.querySelectorAll('.rz').forEach(h => {
      h.addEventListener('pointerdown', e => {
        if (win.max) return;
        e.preventDefault();
        h.setPointerCapture(e.pointerId);
        document.body.classList.add('dragging');
        const r = win.el.getBoundingClientRect();
        const move = ev => {
          if (!h.classList.contains('b')) win.el.style.width = Math.max(320, ev.clientX - r.left) + 'px';
          if (!h.classList.contains('r')) win.el.style.height = Math.max(200, ev.clientY - r.top) + 'px';
        };
        const up = () => {
          h.removeEventListener('pointermove', move);
          h.removeEventListener('pointerup', up);
          document.body.classList.remove('dragging');
        };
        h.addEventListener('pointermove', move);
        h.addEventListener('pointerup', up);
      });
    });
  }
};
