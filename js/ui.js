const UI = {
  calendarDate: localDate(),
  activeWorkout: null,
  _timerInterval: null,
  _timerStart: null,
  _toastTimer: null,

  // ── Helpers ──────────────────────────────────────────────────────────────

  getSettings() { return Storage.get('settings') || {}; },

  formatDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  },

  formatDateLong(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  },

  weightUnit() { return this.getSettings().weightUnit === 'lbs' ? 'lbs' : 'kg'; },

  displayWeight(kg) {
    const s = this.getSettings();
    if (s.weightUnit === 'lbs') return (kg * 2.20462).toFixed(1);
    return kg % 1 === 0 ? String(kg) : String(kg);
  },

  storeKg(displayVal) {
    const num = parseFloat(displayVal) || 0;
    return this.getSettings().weightUnit === 'lbs' ? parseFloat((num / 2.20462).toFixed(4)) : num;
  },

  // ── Charts ───────────────────────────────────────────────────────────────

  createBarChart(data, { statusFn, maxVal } = {}) {
    if (!data.length) return '<div class="chart-empty">No data yet</div>';
    const max = maxVal || Math.max(...data.map(d => d.value)) || 1;
    return '<div class="bar-chart">' + data.map(d => {
      const pct = Math.round((d.value / max) * 100);
      const st = statusFn ? statusFn(d) : '';
      return `<div class="bar-col">
        <div class="bar-wrap"><div class="bar-fill${st ? ' bar-' + st : ''}" style="height:${pct}%"></div></div>
        <div class="bar-label">${d.label}</div>
      </div>`;
    }).join('') + '</div>';
  },

  createSparkline(values) {
    if (!values.length) return '';
    const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
    return '<div class="sparkline-wrap">' + values.map(v => {
      const pct = Math.max(Math.round(((v - min) / range) * 100), 8);
      return `<div class="spark-bar" style="height:${pct}%"></div>`;
    }).join('') + '</div>';
  },

  // ── Modal ─────────────────────────────────────────────────────────────────

  showModal(html) {
    document.getElementById('modal-content').innerHTML = html;
    document.getElementById('modal-overlay').classList.remove('hidden');
    setTimeout(() => {
      const f = document.querySelector('#modal-content input, #modal-content select');
      if (f) f.focus();
    }, 50);
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.getElementById('modal-content').innerHTML = '';
  },

  // ── Toast ─────────────────────────────────────────────────────────────────

  showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast toast-' + type + ' visible';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.classList.remove('visible'), 2500);
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────

  renderDashboard() {
    const settings = this.getSettings();
    if (!settings.calorieTarget) return;
    const today = localDate();
    const calStatus = Dashboard.getCalorieStatus(settings, Calories.getDay(today).total);
    const wkStatus = Dashboard.getWorkoutStatus(settings);
    const recent = Workouts.getAll()[0];
    const bwHistory = (Storage.get('bodyweight') || []).slice(-7);
    const comparison = Workouts.getWeeklyComparison();
    const unit = this.weightUnit();
    const calPct = Math.min(100, Math.round((calStatus.consumed / calStatus.target) * 100));
    const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const weekStart = Workouts._weekBounds(0).start;

    document.getElementById('tab-dashboard').innerHTML =
      `<div class="page-header"><h2>${this.formatDateLong(today)}</h2></div>

      <div class="card status-border-${calStatus.status}">
        <div class="card-row">
          <span class="card-title">Calories Today</span>
          <span class="badge badge-${calStatus.status}">${calStatus.label}</span>
        </div>
        <div class="big-numbers">
          <span class="big-num">${calStatus.consumed.toLocaleString()}</span>
          <span class="big-sep"> / ${calStatus.target.toLocaleString()} kcal</span>
        </div>
        <div class="progress-bar"><div class="progress-fill fill-${calStatus.status}" style="width:${calPct}%"></div></div>
        <div class="card-sub ${calStatus.remaining < 0 ? 'text-red' : 'text-muted'}">
          ${calStatus.remaining >= 0 ? calStatus.remaining.toLocaleString() + ' kcal remaining' : Math.abs(calStatus.remaining).toLocaleString() + ' kcal over target'}
        </div>
      </div>

      <div class="card status-border-${wkStatus.status}">
        <div class="card-row">
          <span class="card-title">Workouts This Week</span>
          <span class="badge badge-${wkStatus.status}">${wkStatus.status === 'green' ? '✓' : wkStatus.status === 'orange' ? '~' : '!'}</span>
        </div>
        <div class="big-numbers">
          <span class="big-num">${wkStatus.done}</span>
          <span class="big-sep"> / ${wkStatus.target} sessions</span>
        </div>
        <div class="day-dots-row">${days.map((d, i) => {
          const dotD = new Date(weekStart + 'T00:00:00');
          dotD.setDate(dotD.getDate() + i);
          const dotDate = localDate(dotD);
          const isFuture = dotDate > today;
          const isOn = wkStatus.dayDots[i];
          return `<div class="day-dot-col${isFuture ? ' dot-future' : ''}" ${!isFuture ? `data-action="toggle-workout-day" data-date="${dotDate}"` : ''}>
            <div class="day-dot${isOn ? ' dot-on' : ''}"></div>
            <span class="dot-label">${d}</span>
          </div>`;
        }).join('')}</div>
        <div class="card-sub text-muted">${wkStatus.label.split('—')[1]?.trim() || wkStatus.label}</div>
      </div>

      ${recent ? `
      <div class="card card-tap" data-action="go-workout">
        <div class="card-row"><span class="card-title">Last Workout</span><span class="card-arrow">›</span></div>
        <div class="recent-name">${recent.name || 'Workout'}</div>
        <div class="text-muted small">${this.formatDate(recent.date)}${recent.durationMin ? ' · ' + recent.durationMin + ' min' : ''}</div>
        ${recent.exercises.length ? `<div class="text-muted small mt4">${recent.exercises.slice(0,3).map(ex => {
          const mw = ex.sets.length ? Math.max(...ex.sets.map(s => s.weightKg)) : 0;
          return ex.name + (mw ? ' (' + this.displayWeight(mw) + unit + ')' : '');
        }).join(' · ')}</div>` : ''}
      </div>` : `
      <div class="card card-empty"><div class="empty-icon">🏋️</div><div>No workouts yet — tap <strong>Workout</strong> to start!</div></div>`}

      ${comparison.length ? `
      <div class="card">
        <div class="card-title mb8">Week-over-Week Progress</div>
        ${comparison.slice(0,5).map(ex => `
        <div class="comp-row">
          <span class="comp-name">${ex.name}</span>
          <span class="comp-right">
            ${ex.lastWeekMax !== null ? `<span class="text-muted">${this.displayWeight(ex.lastWeekMax)}${unit} → </span>` : ''}
            <span>${this.displayWeight(ex.thisWeekMax)}${unit}</span>
            ${ex.delta !== null
              ? `<span class="delta ${ex.delta > 0 ? 'delta-up' : ex.delta < 0 ? 'delta-down' : 'delta-same'}">${ex.delta > 0 ? '+' : ''}${ex.delta === 0 ? '–' : this.displayWeight(Math.abs(ex.delta)) + unit}</span>`
              : '<span class="delta delta-new">new</span>'}
          </span>
        </div>`).join('')}
      </div>` : ''}

      ${bwHistory.length ? `
      <div class="card">
        <div class="card-row">
          <span class="card-title">Body Weight</span>
          <span class="text-muted">${this.displayWeight(bwHistory[bwHistory.length-1].weightKg)}${unit}
          ${bwHistory.length > 1 ? (() => {
            const d = bwHistory[bwHistory.length-1].weightKg - bwHistory[0].weightKg;
            return ` <span class="${d >= 0 ? 'delta-up' : 'delta-down'}">(${d >= 0 ? '+' : ''}${this.displayWeight(Math.abs(d))}${unit})</span>`;
          })() : ''}</span>
        </div>
        ${this.createSparkline(bwHistory.map(b => b.weightKg))}
      </div>` : ''}

      ${this._weightGoalCard(settings)}

      ${this._healthCard(settings)}

      <div class="bottom-spacer"></div>`;
  },

  toggleWorkoutDay(dateStr) {
    const existing = Workouts.getAll().filter(s => s.date === dateStr);
    if (existing.length) {
      const hasExercises = existing.some(s => s.exercises.length > 0);
      if (hasExercises) {
        this.showToast('Full workout logged — edit in Workout tab');
        return;
      }
      if (!confirm('Remove workout for this day?')) return;
      existing.forEach(s => Workouts.delete(s.id));
      this.renderDashboard();
      this.showToast('Workout day removed');
    } else {
      Workouts.save({
        id: crypto.randomUUID(),
        date: dateStr,
        name: 'Workout',
        exercises: [],
        durationMin: 0,
        notes: ''
      });
      this.renderDashboard();
      this.showToast('Workout day marked!');
    }
  },

  // ── Weight goal card ─────────────────────────────────────────────────────

  _weightGoalCard(settings) {
    if (!settings.goalWeightKg) return '';
    const unit = this.weightUnit();
    const bwLogs = Storage.get('bodyweight') || [];
    const currentKg = bwLogs.length ? bwLogs[bwLogs.length - 1].weightKg : settings.weightKg;
    const startKg = settings.weightKg;
    const goalKg = settings.goalWeightKg;
    const disp = kg => unit === 'lbs' ? (kg * 2.20462).toFixed(1) : kg.toFixed(1);
    const remaining = goalKg - currentKg;
    const gained = currentKg - startKg;
    const totalNeeded = goalKg - startKg;
    const pct = totalNeeded <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((gained / totalNeeded) * 100)));
    const reached = currentKg >= goalKg;
    const dispRemaining = Math.abs(disp(Math.abs(remaining)));

    return `<div class="card${reached ? ' status-border-green' : ''}">
      <div class="card-row">
        <span class="card-title">Weight Goal</span>
        <span class="text-muted small">${disp(startKg)} → ${disp(goalKg)} ${unit}</span>
      </div>
      <div class="big-numbers">
        <span class="big-num">${disp(currentKg)}</span>
        <span class="big-sep"> / ${disp(goalKg)} ${unit}</span>
      </div>
      <div class="progress-bar"><div class="progress-fill fill-green" style="width:${pct}%"></div></div>
      <div class="card-sub text-muted">
        ${reached
          ? '<span style="color:var(--green)">Goal reached!</span>'
          : `${dispRemaining} ${unit} to go · ${pct}% there`}
      </div>
    </div>`;
  },

  // ── Health card ───────────────────────────────────────────────────────────

  _healthCard(settings) {
    const hd = Health.getToday();
    if (!hd) {
      const syncUrl = Health.getSyncUrl();
      return `<div class="card">
        <div class="card-row"><span class="card-title">Energy Balance</span><span class="badge badge-orange">Not connected</span></div>
        <div class="text-muted small" style="margin-bottom:12px">Sync Apple Health to see your exact calories burned vs consumed.</div>
        <button class="btn-outline" style="width:100%" data-action="show-health-setup">View setup guide</button>
      </div>`;
    }
    const consumed = Calories.getTodayTotal();
    const burned = Health.totalBurned(hd);
    const bal = Dashboard.getEnergyBalanceStatus(settings, consumed, burned);
    const updTime = hd.updatedAt ? new Date(hd.updatedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
    return `<div class="card status-border-${bal.status}">
      <div class="card-row">
        <span class="card-title">Energy Balance</span>
        <span class="badge badge-${bal.status}">${bal.label}</span>
      </div>
      <div class="energy-grid">
        <div class="energy-col">
          <div class="energy-lbl">Consumed</div>
          <div class="energy-num">${consumed.toLocaleString()}</div>
          <div class="energy-unit">kcal in</div>
        </div>
        <div class="energy-op">−</div>
        <div class="energy-col">
          <div class="energy-lbl">Burned</div>
          <div class="energy-num">${burned.toLocaleString()}</div>
          <div class="energy-unit">kcal out</div>
        </div>
        <div class="energy-op">=</div>
        <div class="energy-col">
          <div class="energy-lbl">Net</div>
          <div class="energy-num ${bal.net < 0 ? 'text-red' : bal.net >= bal.surplusTarget * 0.6 ? 'text-green' : 'text-orange'}">${bal.net >= 0 ? '+' : ''}${bal.net.toLocaleString()}</div>
          <div class="energy-unit">kcal</div>
        </div>
      </div>
      <div class="health-meta text-muted small mt8">
        <span>Active: ${Math.round(hd.activeEnergy || 0)} kcal</span>
        <span> · Resting: ${Math.round(hd.restingEnergy || 0)} kcal</span>
        ${hd.steps ? `<span> · ${Math.round(hd.steps).toLocaleString()} steps</span>` : ''}
        ${hd.exerciseMinutes ? `<span> · ${Math.round(hd.exerciseMinutes)} min exercise</span>` : ''}
      </div>
      <div class="text-muted small mt4">Target surplus: +${bal.surplusTarget} kcal${updTime ? ' · Updated ' + updTime : ''}</div>
    </div>`;
  },

  showHealthSetupModal() {
    const base = Health.getSyncUrl().replace('?active=', '');
    const fullUrl = `${base}?active=[ActiveEnergy]&resting=[RestingEnergy]&steps=[Steps]`;
    this.showModal(`
      <div class="modal-header">Connect Apple Health</div>
      <p class="text-muted small" style="margin-bottom:16px">Build this Shortcut — it only needs <strong>4 actions</strong>.</p>

      <div class="setup-steps">
        <div class="setup-step"><span class="step-num">1</span><span>Open <strong>Shortcuts</strong> → tap <strong>+</strong></span></div>
        <div class="setup-step"><span class="step-num">2</span><span>Add: <strong>Find Health Samples</strong> → Type: <em>Active Energy</em> → Date: <em>Today</em><br>Then add: <strong>Calculate Statistics</strong> → <em>Sum</em></span></div>
        <div class="setup-step"><span class="step-num">3</span><span>Repeat for <em>Resting Energy</em> → <strong>Calculate Statistics</strong> → Sum<br>Repeat for <em>Steps</em> → <strong>Calculate Statistics</strong> → Sum</span></div>
        <div class="setup-step"><span class="step-num">4</span><span>Add: <strong>Get Contents of URL</strong><br>
          — tap the URL field and type:<br>
          <code style="font-size:0.75rem;word-break:break-all">${base}?active=</code><br>
          — tap <strong>Select Variable</strong> → pick the <em>first Sum</em> (Active Energy)<br>
          — type <code>&amp;resting=</code> → Select Variable → <em>second Sum</em><br>
          — type <code>&amp;steps=</code> → Select Variable → <em>third Sum</em><br>
          — Method stays <strong>GET</strong>, no other settings needed
        </span></div>
      </div>

      <div class="url-copy-row mt16">
        <span class="url-mono">${base}</span>
        <button class="btn-primary-sm" data-action="copy-health-url">Copy base URL</button>
      </div>

      <div class="modal-actions">
        <button class="btn-ghost" data-action="close-modal">Close</button>
        <button class="btn-outline" data-action="open-shortcuts">Open Shortcuts App</button>
      </div>
    `);
  },

  // ── Workout list ──────────────────────────────────────────────────────────

  renderWorkoutList() {
    const all = Workouts.getAll();
    const groups = Workouts.groupByWeek(all);
    const unit = this.weightUnit();
    const bounds0 = Workouts._weekBounds(0);
    const bounds1 = Workouts._weekBounds(1);

    const weekLabel = (mondayStr) => {
      if (mondayStr === bounds0.start) return 'This Week';
      if (mondayStr === bounds1.start) return 'Last Week';
      return new Date(mondayStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' week';
    };

    document.getElementById('tab-workout').innerHTML =
      `<div class="page-header">
        <h2>Workouts</h2>
        <div style="display:flex;gap:8px">
          <button class="btn-outline" data-action="show-exercise-progress">Progress</button>
          <button class="btn-primary" data-action="start-workout">+ Start</button>
        </div>
      </div>

      ${!all.length ? `<div class="card card-empty"><div class="empty-icon">💪</div><div>No workouts logged yet. Tap <strong>+ Start</strong> to begin!</div></div>` :
        groups.map(([weekStart, sessions]) =>
          `<div class="week-group">
            <div class="week-label">${weekLabel(weekStart)}</div>
            ${sessions.map(s =>
              `<div class="card session-card" data-session-id="${s.id}">
                <div class="card-row session-header" data-action="expand-session" data-session-id="${s.id}">
                  <div>
                    <div class="session-name">${s.name || 'Workout'}</div>
                    <div class="text-muted small">${this.formatDate(s.date)}${s.durationMin ? ' · ' + s.durationMin + ' min' : ''} · ${s.exercises.length} exercise${s.exercises.length !== 1 ? 's' : ''}</div>
                  </div>
                  <span class="card-arrow expand-arrow">›</span>
                </div>
                <div class="session-detail hidden" id="detail-${s.id}">
                  ${s.exercises.map(ex =>
                    `<div class="ex-summary">
                      <div class="ex-sum-name">${ex.name}</div>
                      <div class="ex-sum-sets text-muted small">${ex.sets.map((set, i) => 'Set ' + (i+1) + ': ' + set.reps + '×' + this.displayWeight(set.weightKg) + unit).join(' · ')}</div>
                    </div>`
                  ).join('')}
                  <div class="session-actions"><button class="btn-danger-sm" data-action="delete-session" data-session-id="${s.id}">Delete workout</button></div>
                </div>
              </div>`
            ).join('')}
          </div>`
        ).join('')}

      <div class="bottom-spacer"></div>`;
  },

  toggleSessionExpand(id) {
    const detail = document.getElementById('detail-' + id);
    const arrow = document.querySelector('[data-session-id="' + id + '"] .expand-arrow');
    if (!detail) return;
    const expanded = !detail.classList.contains('hidden');
    detail.classList.toggle('hidden', expanded);
    if (arrow) arrow.textContent = expanded ? '›' : '⌄';
  },

  deleteSession(id) {
    if (!confirm('Delete this workout?')) return;
    Workouts.delete(id);
    this.renderWorkoutList();
    this.showToast('Workout deleted');
  },

  // ── Active workout ────────────────────────────────────────────────────────

  _saveActiveWorkout() {
    if (this.activeWorkout) {
      Storage.set('active_workout', { workout: this.activeWorkout, timerStart: this._timerStart });
    }
  },

  _clearActiveWorkout() {
    Storage.remove('active_workout');
  },

  restoreActiveWorkout() {
    const saved = Storage.get('active_workout');
    if (!saved || !saved.workout) return false;
    if (saved.workout.date !== localDate()) {
      Storage.remove('active_workout');
      return false;
    }
    this.activeWorkout = saved.workout;
    this._timerStart = saved.timerStart || Date.now();
    this._timerInterval = setInterval(() => this._tickTimer(), 1000);
    return true;
  },

  startWorkout() {
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    this.activeWorkout = {
      id: crypto.randomUUID(),
      date: localDate(),
      name: days[new Date().getDay()] + ' Workout',
      exercises: [],
      durationMin: 0,
      notes: ''
    };
    this._timerStart = Date.now();
    this._saveActiveWorkout();
    this.renderActiveWorkout();
    this._timerInterval = setInterval(() => this._tickTimer(), 1000);
  },

  _tickTimer() {
    const el = document.getElementById('workout-timer');
    if (!el || !this._timerStart) return;
    const sec = Math.floor((Date.now() - this._timerStart) / 1000);
    el.textContent = String(Math.floor(sec / 60)).padStart(2,'0') + ':' + String(sec % 60).padStart(2,'0');
  },

  stopTimer() {
    clearInterval(this._timerInterval);
    this._timerInterval = null;
  },

  renderActiveWorkout() {
    const aw = this.activeWorkout;
    if (!aw) { this.renderWorkoutList(); return; }
    const unit = this.weightUnit();
    document.getElementById('tab-workout').innerHTML =
      `<div class="active-workout-header">
        <input id="workout-name" class="workout-name-input" value="${aw.name}" placeholder="Workout name">
        <div class="timer-box"><span class="timer-label">Time</span><span id="workout-timer" class="timer-display">00:00</span></div>
      </div>
      <div id="exercises-container">${aw.exercises.map((ex, i) => this._exBlock(ex, i, unit)).join('')}</div>
      <div class="workout-actions"><button class="btn-outline" data-action="add-exercise">+ Add Exercise</button></div>
      <div class="workout-footer">
        <button class="btn-ghost" data-action="discard-workout">Discard</button>
        <button class="btn-primary btn-finish" data-action="finish-workout">Finish Workout</button>
      </div>
      <div class="bottom-spacer"></div>`;
  },

  _exBlock(ex, exIdx, unit) {
    return `<div class="ex-block" data-ex-idx="${exIdx}">
      <div class="ex-block-header">
        <input class="ex-name-input" data-ex-idx="${exIdx}" value="${ex.name}" placeholder="Exercise name">
        <button class="btn-icon delete-ex-btn" data-action="delete-exercise" data-ex-idx="${exIdx}">✕</button>
      </div>
      <div class="sets-table">
        <div class="sets-header"><span>Set</span><span>Reps</span><span>Weight (${unit})</span><span></span></div>
        <div class="sets-body" data-ex-idx="${exIdx}">
          ${ex.sets.map((s, si) => this._setRow(s, exIdx, si)).join('')}
        </div>
      </div>
      <button class="btn-add-set" data-action="add-set" data-ex-idx="${exIdx}">+ Add Set</button>
    </div>`;
  },

  _setRow(set, exIdx, setIdx) {
    const displayW = this.getSettings().weightUnit === 'lbs'
      ? (set.weightKg ? (set.weightKg * 2.20462).toFixed(1) : '')
      : (set.weightKg || '');
    return `<div class="set-row" data-ex-idx="${exIdx}" data-set-idx="${setIdx}">
      <span class="set-num">${setIdx + 1}</span>
      <input class="input-reps" type="number" inputmode="numeric" min="1" value="${set.reps || ''}" placeholder="8">
      <input class="input-weight" type="number" inputmode="decimal" min="0" step="0.5" value="${displayW}" placeholder="0">
      <button class="btn-icon" data-action="delete-set" data-ex-idx="${exIdx}" data-set-idx="${setIdx}">✕</button>
    </div>`;
  },

  _syncFromDOM() {
    if (!this.activeWorkout) return;
    const nameEl = document.getElementById('workout-name');
    if (nameEl) this.activeWorkout.name = nameEl.value;
    this.activeWorkout.exercises.forEach((ex, exIdx) => {
      const ni = document.querySelector('.ex-name-input[data-ex-idx="' + exIdx + '"]');
      if (ni) ex.name = ni.value;
      const rows = document.querySelectorAll('.set-row[data-ex-idx="' + exIdx + '"]');
      ex.sets = [];
      rows.forEach(row => {
        const reps = parseInt(row.querySelector('.input-reps')?.value) || 0;
        const w = parseFloat(row.querySelector('.input-weight')?.value) || 0;
        ex.sets.push({ reps, weightKg: parseFloat(this.storeKg(w).toFixed(4)) });
      });
    });
  },

  showAddExerciseModal() {
    const known = Workouts.getUniqueExerciseNames();
    this.showModal(`
      <div class="modal-header">Add Exercise</div>
      <form id="add-ex-form">
        <label>Exercise name</label>
        <input id="ex-name-field" list="ex-datalist" placeholder="e.g. Bench Press" autocomplete="off">
        <datalist id="ex-datalist">${known.map(n => '<option value="' + n + '">').join('')}</datalist>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn-primary">Add</button>
        </div>
      </form>`);
    document.getElementById('add-ex-form').addEventListener('submit', e => {
      e.preventDefault();
      const name = document.getElementById('ex-name-field').value.trim();
      if (!name) return;
      this._syncFromDOM();
      this.activeWorkout.exercises.push({ id: crypto.randomUUID(), name, sets: [] });
      this._saveActiveWorkout();
      this.closeModal();
      this.renderActiveWorkout();
      if (!this._timerInterval && this._timerStart) {
        this._timerInterval = setInterval(() => this._tickTimer(), 1000);
      }
    });
  },

  addSet(exIdxStr) {
    const exIdx = parseInt(exIdxStr);
    if (isNaN(exIdx) || !this.activeWorkout) return;
    this._syncFromDOM();
    const ex = this.activeWorkout.exercises[exIdx];
    if (!ex) return;
    const last = ex.sets[ex.sets.length - 1];
    ex.sets.push({ reps: last?.reps || 8, weightKg: last?.weightKg || 0 });
    this._saveActiveWorkout();
    const body = document.querySelector('.sets-body[data-ex-idx="' + exIdx + '"]');
    if (body) {
      const newSet = ex.sets[ex.sets.length - 1];
      const div = document.createElement('div');
      div.innerHTML = this._setRow(newSet, exIdx, ex.sets.length - 1);
      body.appendChild(div.firstElementChild);
    }
    document.querySelectorAll('.set-row[data-ex-idx="' + exIdx + '"] .set-num').forEach((el, i) => { el.textContent = i + 1; });
  },

  deleteSet(rowEl) {
    if (!rowEl || !this.activeWorkout) return;
    this._syncFromDOM();
    const exIdx = parseInt(rowEl.dataset.exIdx);
    const setIdx = parseInt(rowEl.dataset.setIdx);
    const ex = this.activeWorkout.exercises[exIdx];
    if (!ex) return;
    ex.sets.splice(setIdx, 1);
    this._saveActiveWorkout();
    rowEl.remove();
    document.querySelectorAll('.set-row[data-ex-idx="' + exIdx + '"]').forEach((el, i) => {
      el.dataset.setIdx = i;
      el.querySelector('.set-num').textContent = i + 1;
      const btn = el.querySelector('[data-action="delete-set"]');
      if (btn) btn.dataset.setIdx = i;
    });
  },

  deleteExercise(exIdxStr) {
    const exIdx = parseInt(exIdxStr);
    if (isNaN(exIdx) || !this.activeWorkout) return;
    this._syncFromDOM();
    this.activeWorkout.exercises.splice(exIdx, 1);
    this._saveActiveWorkout();
    this.renderActiveWorkout();
    if (!this._timerInterval && this._timerStart) {
      this._timerInterval = setInterval(() => this._tickTimer(), 1000);
    }
  },

  finishWorkout() {
    if (!this.activeWorkout) return;
    this._syncFromDOM();
    this.activeWorkout.durationMin = this._timerStart ? Math.round((Date.now() - this._timerStart) / 60000) : 0;
    this.activeWorkout.exercises = this.activeWorkout.exercises.filter(ex => ex.name.trim());
    Workouts.save(this.activeWorkout);
    this.stopTimer();
    this.activeWorkout = null;
    this._timerStart = null;
    this._clearActiveWorkout();
    this.renderWorkoutList();
    this.showToast('Workout saved!');
  },

  discardWorkout() {
    if (!confirm('Discard this workout? All data will be lost.')) return;
    this.stopTimer();
    this.activeWorkout = null;
    this._timerStart = null;
    this._clearActiveWorkout();
    this.renderWorkoutList();
  },

  showExerciseProgressModal() {
    const names = Workouts.getUniqueExerciseNames();
    if (!names.length) {
      this.showModal('<div class="modal-header">No exercises logged yet</div><div class="modal-actions"><button class="btn-primary" data-action="close-modal">OK</button></div>');
      return;
    }
    const unit = this.weightUnit();
    const buildContent = (name) => {
      const h = Workouts.getExerciseHistory(name);
      const chartData = h.slice(0, 8).reverse().map(entry => ({
        value: this.getSettings().weightUnit === 'lbs' ? parseFloat((entry.maxWeight * 2.20462).toFixed(1)) : entry.maxWeight,
        label: entry.date.slice(5)
      }));
      return `<div class="progress-chart-wrap">${chartData.length > 1 ? this.createBarChart(chartData) : '<div class="chart-empty">Log more sessions to see chart</div>'}</div>
      <div class="progress-table">${h.slice(0, 8).map(entry =>
        `<div class="prog-row">
          <span class="prog-date text-muted">${this.formatDate(entry.date)}</span>
          <span class="prog-detail">${entry.sets.map(s => s.reps + '×' + this.displayWeight(s.weightKg) + unit).join(' · ')}</span>
          <span class="prog-max">Max: ${this.displayWeight(entry.maxWeight)}${unit}</span>
        </div>`
      ).join('')}</div>`;
    };
    this.showModal(`
      <div class="modal-header">Exercise Progress</div>
      <select id="prog-sel" class="select-full"><option disabled>Choose exercise...</option>
        ${names.map(n => `<option value="${n}">${n}</option>`).join('')}
      </select>
      <div id="prog-content"><div class="chart-empty">Select an exercise above</div></div>
      <div class="modal-actions"><button class="btn-ghost" data-action="close-modal">Close</button></div>`);
    document.getElementById('prog-sel').addEventListener('change', e => {
      document.getElementById('prog-content').innerHTML = buildContent(e.target.value);
    });
  },

  // ── Calories ──────────────────────────────────────────────────────────────

  renderCaloriesDay(dateStr) {
    this.calendarDate = dateStr;
    const settings = this.getSettings();
    const target = settings.calorieTarget || 2000;
    const macroTargets = TDEE.calculateMacros(settings);
    const day = Calories.getDay(dateStr);
    const macros = Calories.getDayMacros(dateStr);
    const today = localDate();
    const prevD = new Date(dateStr + 'T00:00:00'); prevD.setDate(prevD.getDate() - 1);
    const nextD = new Date(dateStr + 'T00:00:00'); nextD.setDate(nextD.getDate() + 1);
    const nextStr = localDate(nextD);
    const pct = Math.min(100, Math.round(day.total / target * 100));
    const st = this._dayStatus(day.total, target, dateStr);

    const macroBar = (name, consumed, goal, cls) => {
      const p = goal ? Math.min(100, Math.round(consumed / goal * 100)) : 0;
      const over = consumed > goal;
      return `<div class="macro-row">
        <div class="macro-head">
          <span class="macro-name ${cls}">${name}</span>
          <span class="macro-nums${over ? ' text-orange' : ''}">${consumed}g / ${goal}g</span>
        </div>
        <div class="macro-bar"><div class="macro-fill macro-${cls}" style="width:${p}%"></div></div>
      </div>`;
    };

    document.getElementById('tab-calories').innerHTML =
      `<div class="page-header"><h2>Calories</h2><button class="btn-outline" data-action="show-cal-history">History</button></div>
      <div class="date-nav">
        <button class="btn-icon-lg" data-action="cal-prev">‹</button>
        <span class="date-nav-label">${dateStr === today ? 'Today' : this.formatDate(dateStr)}</span>
        <button class="btn-icon-lg${nextStr > today ? ' invisible' : ''}" data-action="cal-next">›</button>
      </div>
      <div class="cal-summary-card">
        <div class="cal-big"><span class="cal-num">${day.total.toLocaleString()}</span><span class="cal-of"> / ${target.toLocaleString()} kcal</span></div>
        <div class="progress-bar mt8"><div class="progress-fill fill-${st}" style="width:${pct}%"></div></div>
        <div class="cal-stats">
          <span class="text-muted">${pct}% of goal</span>
          <span class="${day.total > target ? 'text-red' : 'text-muted'}">${day.total <= target ? (target - day.total).toLocaleString() + ' remaining' : (day.total - target).toLocaleString() + ' over'}</span>
        </div>
      </div>

      ${macroTargets ? `<div class="macro-grid">
        ${macroBar('Protein', macros.proteinG, macroTargets.proteinG, 'protein')}
        ${macroBar('Carbs',   macros.carbsG,   macroTargets.carbsG,   'carbs')}
        ${macroBar('Fat',     macros.fatG,     macroTargets.fatG,     'fat')}
      </div>` : ''}

      <div class="food-list-header"><span>Food entries</span><button class="btn-primary-sm" data-action="add-food">+ Add</button></div>
      ${!day.entries.length ? '<div class="card card-empty small-empty">No food logged for this day.</div>' :
        `<div class="food-list">
          ${day.entries.map(e => {
            const hasMacros = e.proteinG || e.carbsG || e.fatG;
            return `<div class="food-row" data-entry-id="${e.id}">
              <div class="food-info">
                <span class="food-label">${e.label}</span>
                ${hasMacros ? `<span class="food-macros">P: ${e.proteinG||0}g · C: ${e.carbsG||0}g · F: ${e.fatG||0}g</span>` : ''}
                <span class="food-time text-muted small">${e.time || ''}</span>
              </div>
              <div class="food-right"><span class="food-kcal">${e.kcal} kcal</span><button class="btn-icon" data-action="delete-food" data-entry-id="${e.id}" data-date="${dateStr}">✕</button></div>
            </div>`;
          }).join('')}
          <div class="food-total-row"><span>Total</span><span class="food-total-num">${day.total.toLocaleString()} kcal</span></div>
        </div>`}
      <div class="bottom-spacer"></div>`;
  },

  _dayStatus(consumed, target, dateStr) {
    const today = localDate();
    if (dateStr < today) {
      const r = consumed / target;
      return r >= 0.90 ? 'green' : r >= 0.70 ? 'orange' : 'red';
    }
    return Dashboard.getCalorieStatus(this.getSettings(), consumed).status;
  },

  calPrev() {
    const d = new Date(this.calendarDate + 'T00:00:00'); d.setDate(d.getDate() - 1);
    this.renderCaloriesDay(localDate(d));
  },

  calNext() {
    const d = new Date(this.calendarDate + 'T00:00:00'); d.setDate(d.getDate() + 1);
    const next = localDate(d);
    if (next > localDate()) return;
    this.renderCaloriesDay(next);
  },

  showAddFoodModal() {
    const dateStr = this.calendarDate;
    this.showModal(`
      <div class="modal-header">Add Food</div>
      <form id="add-food-form">
        <label>Food name</label>
        <input id="food-label" placeholder="e.g. Chicken + rice" required>
        <label>Calories (kcal)</label>
        <input id="food-kcal" type="number" inputmode="numeric" min="1" placeholder="Auto-calc or enter manually">
        <div class="macro-inputs-row">
          <div class="macro-input-col">
            <label>Protein (g)</label>
            <input id="food-protein" type="number" inputmode="decimal" min="0" step="0.1" placeholder="0">
          </div>
          <div class="macro-input-col">
            <label>Carbs (g)</label>
            <input id="food-carbs" type="number" inputmode="decimal" min="0" step="0.1" placeholder="0">
          </div>
          <div class="macro-input-col">
            <label>Fat (g)</label>
            <input id="food-fat" type="number" inputmode="decimal" min="0" step="0.1" placeholder="0">
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn-ghost" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn-primary">Add</button>
        </div>
      </form>`);

    const autoKcal = () => {
      const p = parseFloat(document.getElementById('food-protein').value) || 0;
      const c = parseFloat(document.getElementById('food-carbs').value) || 0;
      const f = parseFloat(document.getElementById('food-fat').value) || 0;
      if (p || c || f) document.getElementById('food-kcal').value = Math.round(p * 4 + c * 4 + f * 9);
    };
    ['food-protein','food-carbs','food-fat'].forEach(id =>
      document.getElementById(id)?.addEventListener('input', autoKcal)
    );

    document.getElementById('add-food-form').addEventListener('submit', e => {
      e.preventDefault();
      const label = document.getElementById('food-label').value.trim();
      const proteinG = parseFloat(document.getElementById('food-protein').value) || 0;
      const carbsG   = parseFloat(document.getElementById('food-carbs').value)   || 0;
      const fatG     = parseFloat(document.getElementById('food-fat').value)     || 0;
      const kcal = parseInt(document.getElementById('food-kcal').value) ||
                   Math.round(proteinG * 4 + carbsG * 4 + fatG * 9);
      if (!label || !kcal) return;
      Calories.addEntry(dateStr, {
        id: crypto.randomUUID(),
        label,
        kcal,
        proteinG: proteinG || undefined,
        carbsG:   carbsG   || undefined,
        fatG:     fatG     || undefined,
        time: new Date().toTimeString().slice(0, 5)
      });
      this.closeModal();
      this.renderCaloriesDay(dateStr);
      this.showToast('Added ' + kcal + ' kcal');
    });
  },

  deleteFood(entryId, dateStr) {
    if (!entryId) return;
    const d = dateStr || this.calendarDate;
    Calories.removeEntry(d, entryId);
    this.renderCaloriesDay(d);
  },

  renderCaloriesHistory() {
    const settings = this.getSettings();
    const target = settings.calorieTarget || 2000;
    const history = Calories.getHistory(14);
    const chartData = history.map(day => ({
      value: day.total, label: day.date.slice(5), date: day.date,
      status: this._dayStatus(day.total, target, day.date)
    }));
    document.getElementById('tab-calories').innerHTML =
      `<div class="page-header"><h2>History</h2><button class="btn-outline" data-action="back-to-today">Today</button></div>
      <div class="card">
        <div class="card-title mb8">Last 14 Days</div>
        ${this.createBarChart(chartData, { statusFn: d => d.status, maxVal: Math.max(target * 1.3, ...chartData.map(d => d.value)) })}
        <div class="target-line-label text-muted small">Target: ${target.toLocaleString()} kcal/day</div>
      </div>
      <div class="card">
        ${history.slice().reverse().map(day => {
          const pct = Math.round(day.total / target * 100);
          const st = this._dayStatus(day.total, target, day.date);
          return `<div class="hist-row${day.date === this.calendarDate ? ' hist-row-active' : ''}" data-action="hist-day" data-date="${day.date}">
            <span class="hist-date">${this.formatDate(day.date)}</span>
            <span class="hist-right"><span class="hist-kcal">${day.total.toLocaleString()} kcal</span><span class="badge badge-${st} badge-sm">${pct}%</span></span>
          </div>`;
        }).join('')}
      </div>
      <div class="bottom-spacer"></div>`;
  },

  // ── Profile ───────────────────────────────────────────────────────────────

  renderProfile(fromOnboarding = false) {
    const s = this.getSettings();
    const tdee = s.activityLevel && s.weightKg ? TDEE.calculateTDEE(s) : (s.tdee || null);
    const surplus = s.surplusKcal || 350;
    const calTarget = tdee ? tdee + surplus : (s.calorieTarget || null);
    const macros = calTarget ? TDEE.calculateMacros({ ...s, calorieTarget: calTarget }) : null;
    const bwList = (Storage.get('bodyweight') || []).slice().reverse().slice(0, 7);
    const unit = s.weightUnit === 'lbs' ? 'lbs' : 'kg';
    const dispBW = kg => s.weightUnit === 'lbs' ? (kg * 2.20462).toFixed(1) : kg;
    const container = fromOnboarding ? document.getElementById('onboard-fields') : document.getElementById('tab-profile');
    if (!container) return;

    container.innerHTML =
      `${fromOnboarding ? '' : '<div class="page-header"><h2>Profile & Settings</h2></div>'}

      <div class="card">
        <div class="card-title mb12">Personal Stats</div>
        <label>Name</label>
        <input id="p-name" value="${s.name || ''}" placeholder="Your name">
        <div class="form-row">
          <div class="form-col">
            <label>Gender</label>
            <select id="p-gender">
              <option value="male"${s.gender !== 'female' ? ' selected' : ''}>Male</option>
              <option value="female"${s.gender === 'female' ? ' selected' : ''}>Female</option>
            </select>
          </div>
          <div class="form-col">
            <label>Age</label>
            <input id="p-age" type="number" inputmode="numeric" min="10" max="100" value="${s.age || ''}" placeholder="25">
          </div>
        </div>
        <div class="form-row">
          <div class="form-col">
            <label>Current Weight (${unit})</label>
            <input id="p-weight" type="number" inputmode="decimal" step="0.1" value="${s.weightKg ? dispBW(s.weightKg) : ''}" placeholder="${unit === 'lbs' ? '176' : '80'}">
          </div>
          <div class="form-col">
            <label>Goal Weight (${unit})</label>
            <input id="p-goal-weight" type="number" inputmode="decimal" step="0.1" value="${s.goalWeightKg ? (unit === 'lbs' ? (s.goalWeightKg * 2.20462).toFixed(1) : s.goalWeightKg) : ''}" placeholder="${unit === 'lbs' ? '170' : '77'}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-col">
            <label>Height (cm)</label>
            <input id="p-height" type="number" inputmode="numeric" min="100" max="250" value="${s.heightCm || ''}" placeholder="178">
          </div>
        </div>
        <label>Activity Level</label>
        <select id="p-activity">
          ${TDEE.getActivityOptions().map(o => `<option value="${o.value}"${s.activityLevel === o.value ? ' selected' : ''}>${o.label}</option>`).join('')}
        </select>
        <label>Weight Units</label>
        <select id="p-unit">
          <option value="kg"${s.weightUnit !== 'lbs' ? ' selected' : ''}>kg</option>
          <option value="lbs"${s.weightUnit === 'lbs' ? ' selected' : ''}>lbs</option>
        </select>
      </div>

      <div class="card">
        <div class="card-title mb12">Calorie & Macro Targets</div>
        ${tdee ? `<div class="tdee-display">Your TDEE: <strong>${tdee.toLocaleString()} kcal/day</strong><div class="text-muted small">Basal metabolic rate × activity multiplier</div></div>` : ''}
        <label>Calorie surplus (added on top of TDEE)</label>
        <div class="stepper-row">
          <button class="btn-step" id="surplus-minus" type="button">−</button>
          <span id="surplus-val" class="step-val">+${surplus} kcal</span>
          <button class="btn-step" id="surplus-plus" type="button">+</button>
          <input id="p-surplus" type="hidden" value="${surplus}">
        </div>
        ${calTarget ? `<div class="target-display">Daily target: <strong>${calTarget.toLocaleString()} kcal</strong></div>` : ''}
        ${macros ? `<div class="macro-targets-grid mt12">
          <div class="macro-target-item"><div class="macro-target-val macro-p">${macros.proteinG}g</div><div class="macro-target-lbl">Protein</div></div>
          <div class="macro-target-item"><div class="macro-target-val macro-c">${macros.carbsG}g</div><div class="macro-target-lbl">Carbs</div></div>
          <div class="macro-target-item"><div class="macro-target-val macro-f">${macros.fatG}g</div><div class="macro-target-lbl">Fat</div></div>
        </div>
        <div class="text-muted small mt8">Protein: 1g/lb · Fat: 25% · Carbs: remainder</div>` : ''}
      </div>

      <div class="card">
        <div class="card-title mb12">Weekly Workout Goal</div>
        <div class="stepper-row">
          <button class="btn-step" id="wk-minus" type="button">−</button>
          <span id="wk-val" class="step-val">${s.weeklyWorkoutTarget || 4}</span>
          <button class="btn-step" id="wk-plus" type="button">+</button>
          <span class="text-muted">sessions / week</span>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn-primary btn-full" data-action="save-profile" type="button">Save Settings</button>
      </div>

      ${!fromOnboarding ? `
      <div class="card">
        <div class="card-title mb12">Log Body Weight</div>
        <div class="form-row">
          <input id="bw-input" type="number" inputmode="decimal" step="0.1" placeholder="${unit === 'lbs' ? 'e.g. 176.4' : 'e.g. 80.2'}" class="flex1">
          <button class="btn-primary-sm ml8" data-action="log-weight" type="button">Log</button>
        </div>
        ${bwList.length ? `<div class="bw-list mt12">${bwList.map(b =>
          `<div class="bw-row"><span>${this.formatDate(b.date)}</span><span>${dispBW(b.weightKg)} ${unit}</span><button class="btn-icon" data-action="delete-bodyweight" data-bw-date="${b.date}" type="button">✕</button></div>`
        ).join('')}</div>` : ''}
      </div>
      <div class="card">
        <div class="card-title mb12">Apple Health Integration</div>
        <p class="text-muted small" style="margin-bottom:12px">Sync Active Energy, Resting Energy, and Steps from the Health app to see your exact daily calorie balance.</p>
        ${Health.isConnected() ? `<div class="badge badge-green" style="display:inline-block;margin-bottom:12px">Connected — data syncing</div>` : `<div class="badge badge-orange" style="display:inline-block;margin-bottom:12px">Not connected yet</div>`}
        <label>Shortcut endpoint URL</label>
        <div class="url-copy-row">
          <span class="url-mono" id="profile-health-url">${Health.getSyncUrl().replace('?active=','')}</span>
          <button class="btn-primary-sm" data-action="copy-health-url" type="button">Copy</button>
        </div>
        <div class="mt12" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-outline" data-action="show-health-setup" type="button">Setup Guide</button>
          <button class="btn-outline" data-action="open-shortcuts" type="button">Open Shortcuts App</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title mb12">Data</div>
        <div class="data-actions">
          <button class="btn-outline" data-action="export-data" type="button">Export JSON</button>
          <label class="btn-outline btn-file-label">Import JSON<input type="file" id="import-file" accept=".json" class="hidden"></label>
          <button class="btn-danger" data-action="clear-data" type="button">Clear All Data</button>
        </div>
      </div>` : ''}

      <div class="bottom-spacer"></div>`;

    document.getElementById('surplus-minus')?.addEventListener('click', () => {
      const el = document.getElementById('p-surplus');
      const newVal = Math.max(100, parseInt(el.value) - 50);
      el.value = newVal;
      document.getElementById('surplus-val').textContent = '+' + newVal + ' kcal';
    });
    document.getElementById('surplus-plus')?.addEventListener('click', () => {
      const el = document.getElementById('p-surplus');
      const newVal = Math.min(600, parseInt(el.value) + 50);
      el.value = newVal;
      document.getElementById('surplus-val').textContent = '+' + newVal + ' kcal';
    });
    document.getElementById('wk-minus')?.addEventListener('click', () => {
      const el = document.getElementById('wk-val');
      const cur = parseInt(el.textContent);
      if (cur > 1) el.textContent = cur - 1;
    });
    document.getElementById('wk-plus')?.addEventListener('click', () => {
      const el = document.getElementById('wk-val');
      const cur = parseInt(el.textContent);
      if (cur < 7) el.textContent = cur + 1;
    });
    document.getElementById('import-file')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try { Storage.importAll(JSON.parse(ev.target.result)); location.reload(); }
        catch { this.showToast('Invalid file', 'error'); }
      };
      reader.readAsText(file);
    });
  },

  saveProfile() {
    const s = this.getSettings();
    const unit = document.getElementById('p-unit')?.value || s.weightUnit || 'kg';
    const rawW = parseFloat(document.getElementById('p-weight')?.value) || 0;
    const weightKg = unit === 'lbs' ? rawW / 2.20462 : rawW;
    const rawGW = parseFloat(document.getElementById('p-goal-weight')?.value);
    const goalWeightKg = rawGW ? parseFloat((unit === 'lbs' ? rawGW / 2.20462 : rawGW).toFixed(2)) : (s.goalWeightKg || null);
    const ns = {
      ...s,
      name: document.getElementById('p-name')?.value || s.name || '',
      gender: document.getElementById('p-gender')?.value || s.gender || 'male',
      age: parseInt(document.getElementById('p-age')?.value) || s.age || 25,
      weightKg: parseFloat(weightKg.toFixed(2)) || s.weightKg || 70,
      heightCm: parseInt(document.getElementById('p-height')?.value) || s.heightCm || 175,
      activityLevel: document.getElementById('p-activity')?.value || s.activityLevel || 'moderate',
      surplusKcal: parseInt(document.getElementById('p-surplus')?.value) || s.surplusKcal || 350,
      weeklyWorkoutTarget: parseInt(document.getElementById('wk-val')?.textContent) || s.weeklyWorkoutTarget || 4,
      weightUnit: unit,
      goalWeightKg
    };
    ns.tdee = TDEE.calculateTDEE(ns);
    ns.calorieTarget = ns.tdee + ns.surplusKcal;
    ns.updatedAt = new Date().toISOString();
    Storage.set('settings', ns);
    this.showToast('Settings saved!');
    if (document.getElementById('tab-profile') && !document.getElementById('tab-profile').classList.contains('hidden')) {
      this.renderProfile();
    }
  },

  showLogWeightModal() {
    const s = this.getSettings();
    const unit = s.weightUnit === 'lbs' ? 'lbs' : 'kg';
    const input = document.getElementById('bw-input');
    const val = parseFloat(input?.value);
    if (!val) { this.showToast('Enter a weight value', 'error'); return; }
    const kg = unit === 'lbs' ? val / 2.20462 : val;
    const today = localDate();
    const bw = Storage.get('bodyweight') || [];
    const idx = bw.findIndex(b => b.date === today);
    const entry = { date: today, weightKg: parseFloat(kg.toFixed(2)) };
    if (idx >= 0) bw[idx] = entry; else bw.push(entry);
    Storage.set('bodyweight', bw);
    if (input) input.value = '';
    this.renderProfile();
    this.showToast('Weight logged!');
  },

  deleteBodyweight(dateStr) {
    Storage.set('bodyweight', (Storage.get('bodyweight') || []).filter(b => b.date !== dateStr));
    this.renderProfile();
    this.showToast('Entry removed');
  }
};
