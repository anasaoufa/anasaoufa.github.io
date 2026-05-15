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

  async _pushToServer(data) {
    try {
      await fetch(`${SUPABASE_URL}/storage/v1/object/gymdata/data.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'apikey': SUPABASE_KEY,
          'Content-Type': 'application/json',
          'x-upsert': 'true'
        },
        body: JSON.stringify(data || this.exportAll())
      });
    } catch {}
  },

  // Merge remote data into local — never blindly overwrite, always union
  _merge(local, remote) {
    const result = { ...remote };

    // Workouts: union by session id, local wins on same id
    const wMap = {};
    for (const w of (remote.workouts || [])) wMap[w.id] = w;
    for (const w of (local.workouts  || [])) wMap[w.id] = w;
    result.workouts = Object.values(wMap).sort((a, b) => a.date < b.date ? 1 : -1);

    // Calories: union by date; within each date union entries by id
    const cMap = {};
    for (const day of (remote.calories || [])) cMap[day.date] = { ...day };
    for (const day of (local.calories  || [])) {
      if (!cMap[day.date]) {
        cMap[day.date] = { ...day };
      } else {
        const eMap = {};
        for (const e of (cMap[day.date].entries || [])) eMap[e.id] = e;
        for (const e of (day.entries           || [])) eMap[e.id] = e;
        const entries = Object.values(eMap).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        cMap[day.date] = {
          ...cMap[day.date],
          entries,
          total: entries.reduce((s, e) => s + (e.kcal || 0), 0)
        };
      }
    }
    result.calories = Object.values(cMap).sort((a, b) => a.date.localeCompare(b.date));

    // Bodyweight: union by date, local wins on same date
    const bMap = {};
    for (const e of (remote.bodyweight || [])) bMap[e.date] = e;
    for (const e of (local.bodyweight  || [])) bMap[e.date] = e;
    result.bodyweight = Object.values(bMap).sort((a, b) => a.date.localeCompare(b.date));

    // Settings: keep whichever was saved more recently (updatedAt), local wins if tied
    const ls = local.settings, rs = remote.settings;
    if (ls && rs) {
      result.settings = (rs.updatedAt && ls.updatedAt && rs.updatedAt > ls.updatedAt) ? rs : ls;
    } else {
      result.settings = ls || rs || result.settings;
    }

    // All other keys: local wins
    const handled = new Set(['workouts', 'calories', 'bodyweight', 'settings']);
    for (const [k, v] of Object.entries(local)) {
      if (!handled.has(k)) result[k] = v;
    }

    return result;
  },

  async syncFromServer() {
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/gymdata/data.json`, {
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
      });
      if (!res.ok) {
        // Nothing on server yet — push local data up
        this._pushToServer();
        return false;
      }
      const remote = await res.json();
      if (Object.keys(remote).length === 0) {
        this._pushToServer();
        return false;
      }
      const merged = this._merge(this.exportAll(), remote);
      // Write merged result to localStorage (bypass set() to avoid triggering extra pushes)
      for (const [k, v] of Object.entries(merged)) {
        localStorage.setItem(this._p + k, JSON.stringify(v));
      }
      // Push merged result back so server matches the union of both devices
      await this._pushToServer(merged);
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
