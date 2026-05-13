// Local date helper — avoids UTC offset shifting the day at night
function localDate(d = new Date()) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// Polyfill for iOS < 15.4
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = () => ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
}

const Storage = {
  _p: 'gym_',
  _pushTimer: null,

  get(key) {
    try {
      const val = localStorage.getItem(this._p + key);
      return val !== null ? JSON.parse(val) : null;
    } catch { return null; }
  },

  set(key, value) {
    try {
      localStorage.setItem(this._p + key, JSON.stringify(value));
      this._schedulePush();
      return true;
    } catch { return false; }
  },

  _schedulePush() {
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this._pushToServer(), 600);
  },

  async _pushToServer() {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.exportAll())
      });
    } catch {}
  },

  async syncFromServer() {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) return false;
      const data = await res.json();
      if (Object.keys(data).length === 0) return false;
      for (const [k, v] of Object.entries(data)) {
        localStorage.setItem(this._p + k, JSON.stringify(v));
      }
      return true;
    } catch { return false; }
  },

  remove(key) {
    localStorage.removeItem(this._p + key);
  },

  exportAll() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this._p)) {
        try { data[k.slice(this._p.length)] = JSON.parse(localStorage.getItem(k)); } catch {}
      }
    }
    return data;
  },

  importAll(data) {
    if (typeof data !== 'object' || data === null) return false;
    for (const [k, v] of Object.entries(data)) this.set(k, v);
    return true;
  },

  clearAll() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this._p)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }
};
