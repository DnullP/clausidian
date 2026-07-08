/**
 * Date utilities — timezone-aware helpers
 */

export function todayStr(tz = process.env.OA_TIMEZONE || 'UTC') {
  return new Date().toLocaleDateString('sv-SE', { timeZone: tz });
}

export function weekdayShort(dateStr) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[new Date(dateStr + 'T12:00:00Z').getDay()];
}

export function prevDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function nextDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function getWeekDates(dateStr) {
  const d = new Date((dateStr || todayStr()) + 'T12:00:00Z');
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));

  const dates = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    dates.push(dd.toISOString().slice(0, 10));
  }
  return dates;
}

export function getWeekLabel(mondayStr) {
  const d = new Date(mondayStr + 'T12:00:00Z');
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil((((d - jan1) / 86400000) + jan1.getDay() + 1) / 7);
  return {
    week: `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`,
    weekNum,
    year: d.getFullYear(),
  };
}

export function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + 'T12:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === dateStr;
}

export function getMonthRange(year, month) {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function filterRecentNotes(notes, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return notes.filter(n => n.updated >= cutoffStr);
}
