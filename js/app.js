const App = {
  async init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }

    // Pull latest data from server so all devices stay in sync
    await Storage.syncFromServer();

    const settings = Storage.get('settings');
    if (!settings || !settings.calorieTarget) {
      this.showOnboarding();
    } else {
      this.showApp();
      if (UI.restoreActiveWorkout()) {
        this.switchTab('workout');
      } else {
        UI.renderDashboard();
      }
      // Fetch latest health data; re-render dashboard when ready
      Promise.all([Health.init(), Health.refresh()]).then(() => {
        UI.renderDashboard();
      });
    }

    if (!window.navigator.standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
      if (!Storage.get('install_dismissed')) {
        document.getElementById('install-banner').classList.remove('hidden');
      }
    }

    this._bindEvents();
  },

  _bindEvents() {
    document.getElementById('tab-bar').addEventListener('click', e => {
      const btn = e.target.closest('.tab-btn');
      if (btn) this.switchTab(btn.dataset.tab);
    });

    document.getElementById('app').addEventListener('click', e => {
      const el = e.target.closest('[data-action]');
      if (el) this.handleAction(el.dataset.action, el);
    });

    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') UI.closeModal();
      const el = e.target.closest('[data-action]');
      if (el) this.handleAction(el.dataset.action, el);
    });

    document.getElementById('onboard-form').addEventListener('submit', e => {
      e.preventDefault();
      UI.saveProfile();
      const s = Storage.get('settings');
      if (s && s.calorieTarget) {
        this.showApp();
        UI.renderDashboard();
        this.switchTab('dashboard');
        if (!window.navigator.standalone && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
          setTimeout(() => document.getElementById('install-banner').classList.remove('hidden'), 800);
        }
      }
    });

    document.getElementById('install-dismiss').addEventListener('click', () => {
      document.getElementById('install-banner').classList.add('hidden');
      Storage.set('install_dismissed', true);
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') UI.closeModal();
    });
  },

  showOnboarding() {
    document.getElementById('onboarding').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    UI.renderProfile(true);
  },

  showApp() {
    document.getElementById('onboarding').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
  },

  switchTab(tab) {
    if (UI.activeWorkout) UI._syncFromDOM(); // capture inputs before leaving workout tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.toggle('hidden', s.id !== 'tab-' + tab));

    switch (tab) {
      case 'dashboard': UI.renderDashboard(); break;
      case 'workout':   UI.activeWorkout ? UI.renderActiveWorkout() : UI.renderWorkoutList(); break;
      case 'calories':  UI.renderCaloriesDay(UI.calendarDate); break;
      case 'profile':   UI.renderProfile(); break;
    }
  },

  handleAction(action, el) {
    switch (action) {
      case 'toggle-workout-day':      UI.toggleWorkoutDay(el.dataset.date); break;
      case 'go-workout':             this.switchTab('workout'); break;
      case 'start-workout':          UI.startWorkout(); break;
      case 'finish-workout':         UI.finishWorkout(); break;
      case 'discard-workout':        UI.discardWorkout(); break;
      case 'add-exercise':           UI.showAddExerciseModal(); break;
      case 'add-set':                UI.addSet(el.dataset.exIdx); break;
      case 'delete-set':             UI.deleteSet(el.closest('.set-row')); break;
      case 'delete-exercise':        UI.deleteExercise(el.dataset.exIdx); break;
      case 'expand-session':         UI.toggleSessionExpand(el.dataset.sessionId); break;
      case 'delete-session':         UI.deleteSession(el.dataset.sessionId); break;
      case 'show-exercise-progress': UI.showExerciseProgressModal(); break;
      case 'add-food':               UI.showAddFoodModal(); break;
      case 'delete-food':            UI.deleteFood(el.dataset.entryId, el.dataset.date); break;
      case 'cal-prev':               UI.calPrev(); break;
      case 'cal-next':               UI.calNext(); break;
      case 'show-cal-history':       UI.renderCaloriesHistory(); break;
      case 'back-to-today':          UI.calendarDate = new Date().toISOString().slice(0,10); UI.renderCaloriesDay(UI.calendarDate); break;
      case 'hist-day':               UI.renderCaloriesDay(el.dataset.date); break;
      case 'save-profile':           UI.saveProfile(); break;
      case 'log-weight':             UI.showLogWeightModal(); break;
      case 'delete-bodyweight':      UI.deleteBodyweight(el.dataset.bwDate); break;
      case 'show-health-setup':      UI.closeModal(); UI.showHealthSetupModal(); break;
      case 'copy-health-url': {
        const url = Health.getSyncUrl().replace('?active=', '');
        navigator.clipboard?.writeText(url).then(() => UI.showToast('URL copied!')).catch(() => {});
        break;
      }
      case 'open-shortcuts':         window.location.href = 'shortcuts://'; break;
      case 'export-data':            this.exportData(); break;
      case 'import-data':            document.getElementById('import-file')?.click(); break;
      case 'clear-data':             this.clearData(); break;
      case 'close-modal':            UI.closeModal(); break;
    }
  },

  exportData() {
    const data = Storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gymtrack-backup-' + localDate() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('Data exported!');
  },

  clearData() {
    if (!confirm('Delete ALL your data? This cannot be undone.')) return;
    if (!confirm('Really delete everything? Workouts, calories, and settings will all be gone.')) return;
    Storage.clearAll();
    location.reload();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
