export type Term = { name: string; start: string; end: string; timezone: string };
export type Lecture = { id: string; title: string; course: string; day: number; start: string; end: string; location: string; color: string };
export type Planner = { term: Term | null; lectures: Lecture[]; completed: Record<string, string> };
export type Occurrence = Lecture & { key: string; date: string; startAt: number; endAt: number; status: 'upcoming' | 'unfinished' | 'completed' };
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const COLORS = ['sage', 'violet', 'blue', 'rose', 'amber'];
export const emptyPlanner = (): Planner => ({ term: null, lectures: [], completed: {} });
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function weekday(date: string) { return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; }
export function monday(date: string) { return addDays(date, -weekday(date)); }
export function dateInZone(now: number, timezone: string) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (name: string) => p.find(x => x.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const zoneFormatters = new Map<string, Intl.DateTimeFormat>();
export function zonedTimestamp(date: string, time: string, timezone: string) {
  const target = Date.parse(`${date}T${time}:00Z`);
  let candidate = target;
  let formatter = zoneFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    if (zoneFormatters.size > 16) zoneFormatters.clear();
    zoneFormatters.set(timezone, formatter);
  }
  for (let i = 0; i < 4; i++) {
    const parts = formatter.formatToParts(candidate);
    const p = (name: string) => parts.find(x => x.type === name)!.value;
    const represented = Date.parse(`${p('year')}-${p('month')}-${p('day')}T${p('hour')}:${p('minute')}:${p('second')}Z`);
    const correction = target - represented;
    if (!correction) break;
    candidate += correction;
  }
  return candidate;
}
export function occurrences(data: Planner, now: number): Occurrence[] {
  if (!data.term) return [];
  const out: Occurrence[] = [];
  const { start, end, timezone } = data.term;
  for (const lecture of data.lectures) {
    let date = addDays(start, (lecture.day - weekday(start) + 7) % 7);
    while (date <= end) {
      const key = `${lecture.id}:${date}`;
      const endAt = zonedTimestamp(date, lecture.end, timezone);
      out.push({ ...lecture, date, key, startAt: zonedTimestamp(date, lecture.start, timezone), endAt,
        status: data.completed[key] ? 'completed' : now >= endAt ? 'unfinished' : 'upcoming' });
      date = addDays(date, 7);
    }
  }
  return out.sort((a, b) => a.startAt - b.startAt || a.title.localeCompare(b.title));
}
export function validDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}
export function validatePlanner(value: unknown): value is Planner {
  if (!value || typeof value !== 'object') return false;
  const d = value as Planner;
  if (!Array.isArray(d.lectures) || d.lectures.length > 100 || !d.completed || typeof d.completed !== 'object' || Array.isArray(d.completed)) return false;
  if (d.term === null) return d.lectures.length === 0 && Object.keys(d.completed).length === 0;
  const t = d.term;
  if (!t || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 80 || !validDate(t.start) || !validDate(t.end) || t.end < t.start || Date.parse(t.end) - Date.parse(t.start) > 366 * 2 * 86400000 || typeof t.timezone !== 'string') return false;
  try { new Intl.DateTimeFormat('en', { timeZone: t.timezone }); } catch { return false; }
  const ids = new Set<string>();
  for (const l of d.lectures) {
    if (!l || typeof l.id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(l.id) || ids.has(l.id) || typeof l.title !== 'string' || !l.title.trim() || l.title.length > 100 || typeof l.course !== 'string' || l.course.length > 60 || typeof l.location !== 'string' || l.location.length > 100 || !Number.isInteger(l.day) || l.day < 0 || l.day > 6 || !COLORS.includes(l.color)) return false;
    if (![l.start, l.end].every(v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) || l.end <= l.start) return false;
    ids.add(l.id);
  }
  if (Object.keys(d.completed).length > 20000) return false;
  return Object.entries(d.completed).every(([key, v]) => {
    const split = key.lastIndexOf(':'); const id = key.slice(0, split); const date = key.slice(split + 1);
    return ids.has(id) && validDate(date) && typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
  });
}
