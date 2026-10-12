// Calendar arithmetic uses date-only values, independent of the browser's timezone.
export const DAY_NAMES = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
export function dateOnly(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Almaty',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const p = Object.fromEntries(parts.map(item => [item.type,item.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function addDays(value, count) {
  if (!validDate(value)) throw new Error('Invalid date');
  const date = new Date(value + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0,10);
}
export function dayIndex(value) { return (new Date(value + 'T12:00:00Z').getUTCDay() + 6) % 7; }
export function weekStart(value) { return addDays(value, -dayIndex(value)); }
export function normalizeLessons(events) {
  return events.map(e => ({id:e.id, day_index:e.day_index ?? e.dayIndex ?? DAY_NAMES.indexOf(e.day), start_time:e.start_time || e.start, end_time:e.end_time || e.end, subject:e.subject, type:e.type || '', teacher:e.teacher || '', room:e.room || '', group_name:e.group_name ?? e.group ?? '', source:e.source || 'academic', conflict:!!e.conflict, conflict_note:e.conflict_note ?? e.conflictNote ?? '', active:e.active !== false, updated_at:e.updated_at}));
}
