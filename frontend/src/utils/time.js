// Shared time utilities — the whole site renders in Eastern Time (America/New_York).
// Backend timestamps are stored in UTC (SQLite datetime('now')) or arrive as ISO strings;
// parseDate normalizes them, fmt*ET force ET display regardless of the viewer's machine.

export const ET = 'America/New_York';

// UTC/format-aware parser
export function parseDate(input) {
  if (input == null || input === '') return null;
  if (input instanceof Date) return input;
  if (typeof input === 'number') return new Date(input > 1e12 ? input : input * 1000);
  if (typeof input === 'string') {
    if (/^\d+\.\d+$/.test(input)) return new Date(parseFloat(input) * 1000); // Slack ts
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(input)) return new Date(input.replace(' ', 'T') + 'Z'); // SQLite UTC
  }
  return new Date(input); // ISO with timezone info
}

// Relative time, clamped so clock skew never shows negatives
export function timeAgo(input) {
  const d = parseDate(input);
  if (!d || isNaN(d.getTime())) return '';
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Clock time in ET, e.g. "2:45 PM"
export function fmtTimeET(input, opts = {}) {
  const d = parseDate(input);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ET, ...opts });
}

// Calendar date in ET, e.g. "Jun 10" / "Tue"
export function fmtDateET(input, opts = {}) {
  const d = parseDate(input);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { timeZone: ET, ...opts });
}

// "YYYY-MM-DD" of a moment as seen in ET — for today/yesterday comparisons
export function etDayKey(input) {
  const d = input === undefined ? new Date() : parseDate(input);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: ET });
}

// "Today 2:45 PM" / "Yesterday 9:01 AM" / "Tue 4:30 PM" / "Jun 3 1:15 PM" — all in ET
export function fmtSmartET(input) {
  const d = parseDate(input);
  if (!d || isNaN(d.getTime())) return '';
  const time = fmtTimeET(d);
  const dayKey = etDayKey(d);
  const todayKey = etDayKey();
  if (dayKey === todayKey) return `Today ${time}`;
  const yesterday = new Date(Date.now() - 86400000);
  if (dayKey === etDayKey(yesterday)) return `Yesterday ${time}`;
  const ageDays = (Date.now() - d.getTime()) / 86400000;
  if (ageDays < 7) return `${fmtDateET(d, { weekday: 'short' })} ${time}`;
  return `${fmtDateET(d, { month: 'short', day: 'numeric' })} ${time}`;
}

// ---- Date-only helpers (e.g. task due dates stored as "YYYY-MM-DD") ----
// A date-only string is a calendar date in ET: parse to the ET-local moment.

// Midnight ET of a "YYYY-MM-DD" string, as a Date
export function dateOnlyToDate(dateStr) {
  if (!dateStr) return null;
  const ymd = String(dateStr).slice(0, 10);
  // Build from the ET calendar: noon UTC of that date is always the same calendar day in ET
  return new Date(ymd + 'T12:00:00Z');
}

// Days from today (ET calendar) to a date-only string: 0 = today, 1 = tomorrow, -1 = yesterday
export function daysFromTodayET(dateStr) {
  if (!dateStr) return null;
  const target = etDayKey(dateOnlyToDate(dateStr));
  const today = etDayKey();
  const [ty, tm, td] = target.split('-').map(Number);
  const [cy, cm, cd] = today.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(cy, cm - 1, cd)) / 86400000);
}

// Is a date-only due date past? (overdue only once the day is over in ET)
export function isPastDueET(dateStr) {
  const days = daysFromTodayET(dateStr);
  return days !== null && days < 0;
}
