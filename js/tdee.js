const TDEE = {
  multipliers: {
    sedentary:   1.2,
    light:       1.375,
    moderate:    1.55,
    active:      1.725,
    very_active: 1.9
  },

  labels: {
    sedentary:   'Sedentary (little/no exercise)',
    light:       'Lightly active (1–3 days/week)',
    moderate:    'Moderately active (3–4 days/week)',
    active:      'Active (5–6 days/week) ← your level',
    very_active: 'Very active (hard daily training or physical job)'
  },

  calculateBMR(s) {
    const base = (10 * s.weightKg) + (6.25 * s.heightCm) - (5 * s.age);
    return s.gender === 'female' ? base - 161 : base + 5;
  },

  calculateTDEE(s) {
    return Math.round(this.calculateBMR(s) * (this.multipliers[s.activityLevel] || 1.55));
  },

  getActivityLabel(level) {
    return this.labels[level] || level;
  },

  getActivityOptions() {
    return Object.entries(this.labels).map(([v, l]) => ({ value: v, label: l }));
  },

  calculateMacros(settings) {
    const kcal = settings.calorieTarget;
    if (!kcal) return null;
    const lbs = (settings.weightKg || 70) * 2.20462;
    const proteinG = Math.round(lbs);           // 1g per lb bodyweight
    const proteinKcal = proteinG * 4;
    const fatKcal = Math.round(kcal * 0.25);    // 25% from fat
    const fatG = Math.round(fatKcal / 9);
    const carbsG = Math.max(0, Math.round((kcal - proteinKcal - fatKcal) / 4));
    return { proteinG, carbsG, fatG };
  }
};
