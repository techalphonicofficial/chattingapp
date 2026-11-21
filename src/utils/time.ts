// One place for turning server times into what the user sees.
// Server sends UTC ISO strings ("2026-11-20T11:58:22.000Z"); they are shown in the phone's local time.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "2026-11-20 11:58:22" (no timezone) is a UTC MySQL value -> treat it as UTC, not local time
export const parseServerDate = (value: any): Date | null => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  let str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

const daysAgo = (d: Date) => Math.round((startOfDay(new Date()) - startOfDay(d)) / DAY_MS);

// "5:28 PM" (manual formatting: Intl output differs between Android versions)
export const formatClock = (value: any): string => {
  const d = parseServerDate(value);
  if (!d) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m < 10 ? '0' : ''}${m} ${h < 12 ? 'AM' : 'PM'}`;
};

// "20 Nov 2026" (year only when it isn't this year)
export const formatShortDate = (value: any): string => {
  const d = parseServerDate(value);
  if (!d) return '';
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`;
};

// Chat day separator: "Today", "Yesterday", "Monday" (this week), else "20 Nov 2026"
export const formatDayLabel = (value: any): string => {
  const d = parseServerDate(value);
  if (!d) return '';
  const diff = daysAgo(d);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return WEEKDAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

// Chat list: time for today, "Yesterday", weekday this week, else short date
export const formatListTime = (value: any): string => {
  const d = parseServerDate(value);
  if (!d) return '';
  const diff = daysAgo(d);
  if (diff === 0) return formatClock(d);
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return WEEKDAYS[d.getDay()];
  return formatShortDate(d);
};

// Chat header: "last seen today at 5:28 PM", "last seen yesterday at 9:10 AM",
// "last seen Monday at 4:00 PM", "last seen 20 Nov at 4:00 PM". Empty when the time is unknown.
export const formatLastSeen = (value: any): string => {
  const d = parseServerDate(value);
  if (!d) return '';
  const diff = daysAgo(d);
  const clock = formatClock(d);
  if (diff <= 0) return `last seen today at ${clock}`;
  if (diff === 1) return `last seen yesterday at ${clock}`;
  if (diff < 7) return `last seen ${WEEKDAYS[d.getDay()]} at ${clock}`;
  return `last seen ${formatShortDate(d)} at ${clock}`;
};

export const isSameDay =(a: any, b: any): boolean => {
  const da = parseServerDate(a);
  const db = parseServerDate(b);
  if (!da || !db) return false;
  return startOfDay(da) === startOfDay(db);
};
