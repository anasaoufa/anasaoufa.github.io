const Dashboard = {
  getCalorieStatus(settings, consumed) {
    const target = settings.calorieTarget || (TDEE.calculateTDEE(settings) + (settings.surplusKcal || 350));
    const remaining = target - consumed;
    let status, label;

    if (consumed > target * 1.25) {
      status = 'red'; label = 'Significantly over';
    } else if (consumed > target * 1.10) {
      status = 'orange'; label = 'Over target';
    } else {
      const hour = new Date().getHours();
      if (hour >= 20) {
        const r = consumed / target;
        if (r >= 0.90)      { status = 'green';  label = 'Goal reached!'; }
        else if (r >= 0.70) { status = 'orange'; label = 'Almost there'; }
        else                { status = 'red';    label = 'Behind on calories'; }
      } else {
        const fraction = Math.max(hour / 24, 0.25);
        const r = consumed / (target * fraction);
        if (r >= 0.85)      { status = 'green';  label = 'On track'; }
        else if (r >= 0.60) { status = 'orange'; label = 'A little behind'; }
        else                { status = 'red';    label = 'Behind pace'; }
      }
    }

    return { status, label, consumed, target, remaining };
  },

  getWorkoutStatus(settings) {
    const target = settings.weeklyWorkoutTarget || 4;
    const done = Workouts.getThisWeek().length;
    const dayDots = Workouts.getWeekDayDots();

    const dow = new Date().getDay();
    const daysElapsed = dow === 0 ? 7 : dow;
    const daysRemaining = 7 - daysElapsed;
    const needed = target - done;
    const feasible = needed <= daysRemaining;

    let status, label;
    if (done >= target) {
      status = 'green';  label = `${done}/${target} — Weekly goal hit!`;
    } else if (!feasible || (dow === 0 && done < target)) {
      status = 'red';    label = `${done}/${target} — Goal missed this week`;
    } else if (done >= target * 0.5) {
      status = 'green';  label = `${done}/${target} — On track`;
    } else {
      status = 'orange'; label = `${done}/${target} — Need to pick it up`;
    }

    return { status, label, done, target, dayDots };
  },

  getEnergyBalanceStatus(settings, consumed, burned) {
    const surplus = settings.surplusKcal || 350;
    const net = consumed - burned;
    let status, label;

    if (net <= 0) {
      status = 'red';    label = 'In a deficit — eat more!';
    } else if (net < surplus * 0.6) {
      status = 'orange'; label = 'Surplus below target';
    } else if (net <= surplus * 1.7) {
      status = 'green';  label = 'In your surplus zone!';
    } else {
      status = 'orange'; label = 'Above target surplus';
    }

    return { status, label, net, consumed, burned, surplusTarget: surplus };
  }
};
