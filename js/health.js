const Health = {
  async init() { /* no-op — no LAN IP needed with Supabase */ },

  async refresh() {
    try {
      const cache = {};
      const today = new Date();
      const fetches = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = localDate(d);
        fetches.push(
          fetch(`${SUPABASE_URL}/storage/v1/object/healthdata/${dateStr}.json`, {
            headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY }
          })
            .then(r => r.ok ? r.json().then(data => { cache[dateStr] = data; }) : null)
            .catch(() => null)
        );
      }
      await Promise.all(fetches);
      if (Object.keys(cache).length > 0) Storage.set('health_cache', cache);
      return Object.keys(cache).length > 0;
    } catch { return false; }
  },

  getSyncUrl() {
    return `${SUPABASE_URL}/storage/v1/object/healthdata/`;
  },

  getSyncKey() { return SUPABASE_KEY; },

  getCache() { return Storage.get('health_cache') || {}; },
  getDay(dateStr) { return this.getCache()[dateStr] || null; },
  getToday() { return this.getDay(localDate()); },

  totalBurned(entry) {
    if (!entry) return 0;
    return Math.round((entry.activeEnergy || 0) + (entry.restingEnergy || 0));
  },

  isConnected() { return Object.keys(this.getCache()).length > 0; }
};
