const Health = {
  async init() {
    // Fetch the server's LAN IP so the Shortcut URL works from iPhone
    try {
      const info = await fetch('/api/info').then(r => r.json());
      if (info.ip) Storage.set('server_info', info);
    } catch {}
  },

  async refresh() {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) return false;
      const all = await res.json();
      Storage.set('health_cache', all);
      return true;
    } catch {
      return false;
    }
  },

  // Base sync URL for the Shortcut (uses LAN IP so iPhone can reach the Mac)
  getSyncUrl() {
    const info = Storage.get('server_info');
    const base = (info && info.ip && info.ip !== 'localhost' && info.ip !== '127.0.0.1')
      ? `http://${info.ip}:${info.port || 8080}`
      : window.location.origin;
    return `${base}/api/sync?active=`;
  },

  getCache() {
    return Storage.get('health_cache') || {};
  },

  getDay(dateStr) {
    return this.getCache()[dateStr] || null;
  },

  getToday() {
    return this.getDay(localDate());
  },

  totalBurned(entry) {
    if (!entry) return 0;
    return Math.round((entry.activeEnergy || 0) + (entry.restingEnergy || 0));
  },

  isConnected() {
    return Object.keys(this.getCache()).length > 0;
  }
};
