// Computes whether a user is currently available, from their manual
// override and their availability rules. All times are server-local.
//
// Precedence:
//   1. Manual override ("go online/offline for N hours") wins outright.
//   2. Date rules for today (custom hours or unavailable) REPLACE the
//      weekly schedule for that date.
//   3. Otherwise the weekly rules apply.

function localYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ruleDateYMD(specificDate) {
  if (!specificDate) return null;
  if (typeof specificDate === 'string') return specificDate.slice(0, 10);
  return localYMD(specificDate);
}

function inWindow(minute, start, end) {
  if (end > start) return minute >= start && minute < end;
  return minute >= start; // window runs to (or past) midnight
}

// Returns { online: bool, source: 'override' | 'schedule' }
function computeStatus(user, rules, now = new Date()) {
  if (user && user.override_status && user.override_until && new Date(user.override_until) > now) {
    return { online: user.override_status === 'on', source: 'override' };
  }

  const day = now.getDay();                       // 0 = Sunday
  const prevDay = (day + 6) % 7;
  const minute = now.getHours() * 60 + now.getMinutes();
  const today = localYMD(now);
  const active = (rules || []).filter(r => r.enabled);

  // Date overrides for today replace the weekly schedule entirely.
  const todayRules = active.filter(r => r.kind === 'date' && ruleDateYMD(r.specific_date) === today);
  if (todayRules.length) {
    if (todayRules.some(r => r.unavailable)) return { online: false, source: 'schedule' };
    const online = todayRules.some(r => inWindow(minute, r.start_minute, r.end_minute));
    return { online, source: 'schedule' };
  }

  for (const r of active.filter(r => r.kind === 'weekly')) {
    const days = String(r.days_of_week || '').split(',').map(Number);
    const overnight = r.end_minute <= r.start_minute;
    if (!overnight) {
      if (days.includes(day) && minute >= r.start_minute && minute < r.end_minute) {
        return { online: true, source: 'schedule' };
      }
    } else if ((days.includes(day) && minute >= r.start_minute) ||
               (days.includes(prevDay) && minute < r.end_minute)) {
      return { online: true, source: 'schedule' };
    }
  }
  return { online: false, source: 'schedule' };
}

module.exports = { computeStatus, ruleDateYMD };
