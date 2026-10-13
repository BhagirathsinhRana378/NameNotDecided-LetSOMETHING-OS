export const store = {
  async get(key, fallback) {
    const r = await chrome.storage.local.get(key);
    return r[key] ?? fallback;
  },
  set(key, value) {
    return chrome.storage.local.set({ [key]: value });
  }
};
