const Calories = {
  getDay(dateStr) {
    const all = Storage.get('calories') || [];
    return all.find(d => d.date === dateStr) || { date: dateStr, entries: [], total: 0 };
  },

  _save(day) {
    const all = Storage.get('calories') || [];
    day.total = day.entries.reduce((sum, e) => sum + (e.kcal || 0), 0);
    const idx = all.findIndex(d => d.date === day.date);
    if (idx >= 0) all[idx] = day;
    else all.push(day);
    Storage.set('calories', all);
  },

  addEntry(dateStr, entry) {
    const day = this.getDay(dateStr);
    day.entries.push(entry);
    this._save(day);
  },

  removeEntry(dateStr, entryId) {
    const day = this.getDay(dateStr);
    day.entries = day.entries.filter(e => e.id !== entryId);
    this._save(day);
  },

  getHistory(days = 14) {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return this.getDay(localDate(d));
    });
  },

  getTodayTotal() {
    return this.getDay(localDate()).total;
  },

  getDayMacros(dateStr) {
    const day = this.getDay(dateStr);
    return {
      proteinG: Math.round(day.entries.reduce((s, e) => s + (e.proteinG || 0), 0)),
      carbsG:   Math.round(day.entries.reduce((s, e) => s + (e.carbsG   || 0), 0)),
      fatG:     Math.round(day.entries.reduce((s, e) => s + (e.fatG     || 0), 0))
    };
  }
};
