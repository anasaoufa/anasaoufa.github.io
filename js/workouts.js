const Workouts = {
  getAll() {
    return (Storage.get('workouts') || []).sort((a, b) => b.date.localeCompare(a.date));
  },

  _weekBounds(offsetWeeks = 0) {
    const d = new Date();
    d.setDate(d.getDate() - offsetWeeks * 7);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return {
      start: localDate(mon),
      end: localDate(sun)
    };
  },

  getThisWeek() {
    const { start, end } = this._weekBounds(0);
    return this.getAll().filter(s => s.date >= start && s.date <= end);
  },

  getLastWeek() {
    const { start, end } = this._weekBounds(1);
    return this.getAll().filter(s => s.date >= start && s.date <= end);
  },

  save(session) {
    const all = Storage.get('workouts') || [];
    const idx = all.findIndex(s => s.id === session.id);
    if (idx >= 0) all[idx] = session;
    else all.push(session);
    Storage.set('workouts', all);
  },

  delete(id) {
    Storage.set('workouts', (Storage.get('workouts') || []).filter(s => s.id !== id));
  },

  getUniqueExerciseNames() {
    const names = new Set();
    this.getAll().forEach(s => s.exercises.forEach(e => names.add(e.name.trim())));
    return [...names].sort((a, b) => a.localeCompare(b));
  },

  getExerciseHistory(exerciseName) {
    const norm = exerciseName.trim().toLowerCase();
    return this.getAll()
      .map(session => {
        const ex = session.exercises.find(e => e.name.trim().toLowerCase() === norm);
        if (!ex || !ex.sets.length) return null;
        return {
          date: session.date,
          maxWeight: Math.max(...ex.sets.map(s => s.weightKg)),
          totalVolume: ex.sets.reduce((sum, s) => sum + s.reps * s.weightKg, 0),
          sets: ex.sets
        };
      })
      .filter(Boolean)
      .slice(0, 20);
  },

  getWeeklyComparison() {
    const buildMaxes = (sessions) => {
      const maxes = {};
      sessions.forEach(session =>
        session.exercises.forEach(ex => {
          if (!ex.sets.length) return;
          const norm = ex.name.trim().toLowerCase();
          const max = Math.max(...ex.sets.map(s => s.weightKg));
          maxes[norm] = Math.max(maxes[norm] || 0, max);
        })
      );
      return maxes;
    };

    const thisMaxes = buildMaxes(this.getThisWeek());
    const lastMaxes = buildMaxes(this.getLastWeek());

    return Object.entries(thisMaxes).map(([norm, thisMax]) => ({
      name: norm.charAt(0).toUpperCase() + norm.slice(1),
      thisWeekMax: thisMax,
      lastWeekMax: lastMaxes[norm] ?? null,
      delta: lastMaxes[norm] != null ? thisMax - lastMaxes[norm] : null
    }));
  },

  getWeekDayDots() {
    const { start } = this._weekBounds(0);
    const sessions = this.getThisWeek();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start + 'T00:00:00');
      d.setDate(d.getDate() + i);
      const dateStr = localDate(d);
      return sessions.some(s => s.date === dateStr);
    });
  },

  groupByWeek(sessions) {
    const groups = {};
    sessions.forEach(s => {
      const d = new Date(s.date + 'T00:00:00');
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const mon = new Date(d);
      mon.setDate(d.getDate() + diff);
      const key = localDate(mon);
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }
};
