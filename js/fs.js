import { store } from './store.js';

const dir = () => ({ t: 'd', c: {} });
let tree = null;

async function load() {
  if (tree) return;
  tree = await store.get('fs', null);
  if (!tree) {
    tree = { t: 'd', c: {
      Desktop: dir(), Pictures: dir(), Downloads: dir(),
      Documents: { t: 'd', c: { 'welcome.txt': { t: 'f', d: 'Welcome to BrowOS.\n\nFiles here live in your browser profile (chrome.storage.local).\nOpen the Terminal and type "help".' } } }
    } };
    await save();
  }
}
const save = () => store.set('fs', tree);

export const fs = {
  norm(cwd, p) {
    const out = [];
    for (const s of (p.startsWith('/') ? p : cwd + '/' + p).split('/')) {
      if (!s || s === '.') continue;
      s === '..' ? out.pop() : out.push(s);
    }
    return '/' + out.join('/');
  },
  async node(path) {
    await load();
    let n = tree;
    for (const s of path.split('/').filter(Boolean)) {
      if (n.t !== 'd' || !(s in n.c)) throw new Error('No such file or directory: ' + path);
      n = n.c[s];
    }
    return n;
  },
  async list(path) {
    const n = await this.node(path);
    if (n.t !== 'd') throw new Error('Not a directory: ' + path);
    return Object.entries(n.c)
      .map(([name, v]) => ({ name, type: v.t, size: v.t === 'f' ? v.d.length : Object.keys(v.c).length }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'd' ? -1 : 1));
  },
  async read(path) {
    const n = await this.node(path);
    if (n.t !== 'f') throw new Error('Is a directory: ' + path);
    return n.d;
  },
  async write(path, data) {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) throw new Error('Invalid file name');
    const parent = await this.node('/' + parts.join('/'));
    if (parent.t !== 'd') throw new Error('Parent is not a directory');
    parent.c[name] = { t: 'f', d: data };
    await save();
  },
  async mkdir(path) {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    const parent = await this.node('/' + parts.join('/'));
    if (name in parent.c) throw new Error('Already exists: ' + path);
    parent.c[name] = dir();
    await save();
  },
  async rm(path) {
    const parts = path.split('/').filter(Boolean);
    const name = parts.pop();
    if (!name) throw new Error('Cannot remove root');
    const parent = await this.node('/' + parts.join('/'));
    if (!(name in parent.c)) throw new Error('No such file or directory: ' + path);
    delete parent.c[name];
    await save();
  },
  async reset() { tree = null; await store.set('fs', null); await load(); }
};
