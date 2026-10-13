export type Term = { name: string; start: string; end: string; timezone: string };
export type Course = { id: string; name: string; number: string; folderId: string; color: string };
export type Lecture = { id: string; courseId: string; title: string; day: number; start: string; end: string; tags: string[] };
export type Planner = { schemaVersion: 2; term: Term | null; courses: Course[]; lectures: Lecture[]; completed: Record<string, string> };
export type Occurrence = Lecture & { course: Course; color: string; key: string; date: string; startAt: number; endAt: number; status: 'upcoming' | 'unfinished' | 'completed' };
type LegacyPlanner = { term: Term | null; lectures: { id: string; title: string; course: string; day: number; start: string; end: string; location: string; color: string }[]; completed: Record<string, string> };
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const COLORS = ['sage', 'violet', 'blue', 'rose', 'amber'];
export const QUANTUM_COURSE = { name: 'Quantum computing', number: '70021', folderId: '4394cd01-a3d6-489a-b98c-b49b011de184' };
export const emptyPlanner = (): Planner => ({ schemaVersion: 2, term: null, courses: [], lectures: [], completed: {} });
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
export function validDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
}
export function occurrences(data: Planner, now: number): Occurrence[] {
  if (!data.term) return [];
  const out: Occurrence[] = [];
  const { start, end, timezone } = data.term;
  const courses = new Map(data.courses.map(course => [course.id, course]));
  for (const lecture of data.lectures) {
    const course = courses.get(lecture.courseId);
    if (!course) continue;
    let date = addDays(start, (lecture.day - weekday(start) + 7) % 7);
    while (date <= end) {
      const key = `${lecture.id}:${date}`;
      const endAt = zonedTimestamp(date, lecture.end, timezone);
      out.push({ ...lecture, course, color: course.color, date, key, startAt: zonedTimestamp(date, lecture.start, timezone), endAt,
        status: data.completed[key] ? 'completed' : now >= endAt ? 'unfinished' : 'upcoming' });
      date = addDays(date, 7);
    }
  }
  return out.sort((a, b) => a.startAt - b.startAt || a.title.localeCompare(b.title));
}
const folderPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idPattern = /^[a-zA-Z0-9-]{1,64}$/;
export function parseFolderId(input: string): string | null {
  let value = input.trim().replace(/^['"{]+|['"}]+$/g, '');
  if (folderPattern.test(value)) return value.toLowerCase();
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'imperial.cloud.panopto.eu') return null;
    const parameter = new URLSearchParams(url.hash.slice(1)).get('folderID');
    if (!parameter) return null;
    value = parameter.replace(/^"|"$/g, '');
    return folderPattern.test(value) ? value.toLowerCase() : null;
  } catch { return null; }
}
export function materialsUrl(course: Course): string | null {
  return /^\d{1,10}$/.test(course.number) ? `https://scientia.doc.ic.ac.uk/2627/modules/${course.number}/materials` : null;
}
export function recordingsFolderUrl(course: Course): string | null {
  if (!folderPattern.test(course.folderId)) return null;
  return `https://imperial.cloud.panopto.eu/Panopto/Pages/Sessions/List.aspx#folderID=${encodeURIComponent(JSON.stringify(course.folderId))}`;
}
export function recordingUrl(course: Course, date: string): string | null {
  const folder = recordingsFolderUrl(course);
  if (!folder || !validDate(date)) return null;
  const [year, month, day] = date.split('-');
  const encodedDate = encodeURIComponent(JSON.stringify(`${month}/${day}/${year}`));
  return `${folder}&startDate=${encodedDate}&endDate=${encodedDate}`;
}
export function splitTags(value: string) { return [...new Set(value.split(',').map(tag => tag.trim()).filter(Boolean))]; }
export function validatePlanner(value: unknown): value is Planner {
  if (!value || typeof value !== 'object') return false;
  const d = value as Planner;
  if (d.schemaVersion !== 2 || !Array.isArray(d.courses) || d.courses.length > 100 || !Array.isArray(d.lectures) || d.lectures.length > 100 || !d.completed || typeof d.completed !== 'object' || Array.isArray(d.completed)) return false;
  if (d.term === null) return d.courses.length === 0 && d.lectures.length === 0 && Object.keys(d.completed).length === 0;
  const t = d.term;
  if (!t || typeof t.name !== 'string' || !t.name.trim() || t.name.length > 80 || !validDate(t.start) || !validDate(t.end) || t.end < t.start || Date.parse(t.end) - Date.parse(t.start) > 366 * 2 * 86400000 || typeof t.timezone !== 'string') return false;
  try { new Intl.DateTimeFormat('en', { timeZone: t.timezone }); } catch { return false; }
  const courseIds = new Set<string>();
  const numbers = new Set<string>();
  for (const c of d.courses) {
    if (!c || typeof c.id !== 'string' || !idPattern.test(c.id) || courseIds.has(c.id) || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 100 || typeof c.number !== 'string' || (c.number !== '' && !/^\d{1,10}$/.test(c.number)) || typeof c.folderId !== 'string' || (c.folderId !== '' && !folderPattern.test(c.folderId)) || !COLORS.includes(c.color)) return false;
    if (c.number && numbers.has(c.number)) return false;
    if (c.number) numbers.add(c.number);
    courseIds.add(c.id);
  }
  const ids = new Set<string>();
  for (const l of d.lectures) {
    if (!l || typeof l.id !== 'string' || !idPattern.test(l.id) || ids.has(l.id) || !courseIds.has(l.courseId) || typeof l.title !== 'string' || !l.title.trim() || l.title.length > 100 || !Number.isInteger(l.day) || l.day < 0 || l.day > 6 || !Array.isArray(l.tags) || l.tags.length > 8 || l.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 30)) return false;
    if (![l.start, l.end].every(v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) || l.end <= l.start) return false;
    ids.add(l.id);
  }
  if (Object.keys(d.completed).length > 20000) return false;
  return Object.entries(d.completed).every(([key, v]) => {
    const split = key.lastIndexOf(':'); const id = key.slice(0, split); const date = key.slice(split + 1);
    return ids.has(id) && validDate(date) && typeof v === 'string' && v.length <= 40 && Number.isFinite(Date.parse(v));
  });
}
export function upgradePlanner(value: unknown): Planner | null {
  if (validatePlanner(value)) return value;
  if (!value || typeof value !== 'object' || 'schemaVersion' in value || !validateLegacyPlanner(value)) return null;
  const legacy = value as LegacyPlanner;
  if (!legacy.term) return emptyPlanner();
  const courses: Course[] = [];
  const grouped = new Map<string, string>();
  const lectures: Lecture[] = legacy.lectures.map(l => {
    const name = l.course.trim() || l.title;
    const groupKey = name.toLowerCase();
    let courseId = grouped.get(groupKey);
    if (!courseId) {
      courseId = `legacy-course-${courses.length + 1}`;
      grouped.set(groupKey, courseId);
      courses.push({ id: courseId, name, number: '', folderId: '', color: l.color });
    }
    return { id: l.id, courseId, title: l.title, day: l.day, start: l.start, end: l.end, tags: [] };
  });
  const upgraded: Planner = { schemaVersion: 2, term: { ...legacy.term }, courses, lectures, completed: { ...legacy.completed } };
  return validatePlanner(upgraded) ? upgraded : null;
}
function validateLegacyPlanner(value: unknown): value is LegacyPlanner {
  if (!value || typeof value !== 'object') return false;
  const d = value as LegacyPlanner;
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
