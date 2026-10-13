'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { BookOpen, LayoutDashboard, CalendarDays, Settings2, Plus, ArrowRight, ChevronLeft, ChevronRight, Check, Clock3, CircleDashed, Search, Video, ExternalLink, Repeat2, X, Pencil, Trash2, CloudCheck, Loader2, Download, Upload, CheckCheck, Sparkles, GraduationCap, ArrowUpRight } from 'lucide-react';
import { addDays, COLORS, dateInZone, DAYS, emptyPlanner, monday, occurrences, validatePlanner, upgradePlanner, materialsUrl, recordingUrl, sessionLabel, sessionDescription, QUANTUM_COURSE, type Course, type Lecture, type Occurrence, type Planner, type Term } from '../lib/model';

import { CourseForm, CoursesPanel, LectureForm, Tags } from './course-components';
import { desktop } from './desktop';
import { Power } from 'lucide-react';

type View = 'overview' | 'schedule' | 'settings';
type Filter = 'all' | 'unfinished' | 'upcoming' | 'completed';
const labels = { all: 'All sessions', unfinished: 'Unfinished', upcoming: 'Upcoming', completed: 'Completed' };
const dateLabel = (date: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) => new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const formatTime = (time: string) => time;
const newLecture = (courseId: string): Lecture => ({ id: crypto.randomUUID(), courseId, day: 0, start: '09:00', end: '10:00', tags: [] });
const newCourse = (index: number): Course => ({ id: crypto.randomUUID(), name: '', number: '', folderId: '', color: COLORS[index % COLORS.length] });

function demoPlanner(now: number, timezone: string): Planner {
  const week = monday(dateInZone(now, timezone));
  const data: Planner = {
    schemaVersion: 2,
    term: { name: 'Example autumn term', start: addDays(week, -14), end: addDays(week, 55), timezone },
    courses: [
      { id: 'example-quantum', ...QUANTUM_COURSE, color: 'violet' },
      { id: 'example-study', name: 'Independent study', number: '', folderId: '', color: 'sage' },
    ],
    lectures: [
      { id: 'example-1', courseId: 'example-quantum', day: 0, start: '09:00', end: '10:00', tags: [] },
      { id: 'example-2', courseId: 'example-study', day: 0, start: '14:00', end: '15:00', tags: ['Reading'] },
      { id: 'example-3', courseId: 'example-quantum', day: 1, start: '11:00', end: '12:00', tags: [] },
      { id: 'example-4', courseId: 'example-quantum', day: 2, start: '10:00', end: '11:30', tags: ['Tutorial'] },
      { id: 'example-5', courseId: 'example-study', day: 3, start: '09:00', end: '10:00', tags: ['Revision'] },
    ], completed: {},
  };
  occurrences(data, now).filter(x => x.endAt <= now).forEach((x, i) => { if (i % 5 !== 2) data.completed[x.key] = new Date(now).toISOString(); });
  return data;
}

function Modal({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); dialog.querySelector<HTMLInputElement>('input, select')?.focus(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="modal" onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="dialog-title">
    <div className="modal-inner"><div className="modal-heading"><div><h2 id="dialog-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>{children}</div>
  </dialog>;
}

export default function Tracker() {
  const [data, setData] = useState<Planner>(emptyPlanner);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [example, setExample] = useState<Planner | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<View>('overview');
  const [scope, setScope] = useState<'week' | 'term'>('week');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [week, setWeek] = useState('');
  const [termEditor, setTermEditor] = useState<Term | null>(null);
  const [courseEditor, setCourseEditor] = useState<Course | null>(null);
  const [addSessionAfterCourse, setAddSessionAfterCourse] = useState(false);
  const [lectureEditor, setLectureEditor] = useState<Lecture | null>(null);
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState<{ title: string; text: string; action: () => Promise<void>; label: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const active = example ?? data;
  const timezone = active.term?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = dateInZone(now, timezone);
  const currentWeek = monday(today);
  const defaultWeek = active.term ? currentWeek < monday(active.term.start) ? monday(active.term.start) : currentWeek > monday(active.term.end) ? monday(active.term.end) : currentWeek : currentWeek;
  const selectedWeek = week || defaultWeek;
  const scheduled = useMemo(() => occurrences(active, 0), [active]);
  const all: Occurrence[] = useMemo(() => scheduled.map(item => ({ ...item, status: active.completed[item.key] ? 'completed' : now >= item.endAt ? 'unfinished' : 'upcoming' })), [scheduled, now, active.completed]);
  const counts = { unfinished: all.filter(x => x.status === 'unfinished').length, upcoming: all.filter(x => x.status === 'upcoming').length, completed: all.filter(x => x.status === 'completed').length };
  const weekItems = all.filter(x => x.date >= selectedWeek && x.date <= addDays(selectedWeek, 6));
  const scoped = scope === 'term' ? all : weekItems;
  const scopedCounts = { unfinished: scoped.filter(x => x.status === 'unfinished').length, upcoming: scoped.filter(x => x.status === 'upcoming').length, completed: scoped.filter(x => x.status === 'completed').length };
  const filtered = scoped.filter(x => (filter === 'all' || x.status === filter) && `${x.course.name} ${sessionLabel(x)}`.toLowerCase().includes(search.toLowerCase()));
  const groups = active.courses.filter(course => filtered.some(item => item.courseId === course.id));
  const next = all.find(x => x.status === 'upcoming');
  const due = counts.completed + counts.unfinished;
  const progress = due ? Math.round(counts.completed / due * 100) : 0;
  const termDays = active.term ? Math.ceil((Date.parse(active.term.end) - Date.parse(active.term.start)) / 86400000) + 1 : 0;
  const termWeeks = Math.ceil(termDays / 7);
  const busy = saving || loading || !!loadError;

  async function load() {
    setLoading(true); setLoadError(''); setError('');
    try {
      const response = await fetch('/api/planner', { cache: 'no-store' });
      const result = await response.json() as { data: unknown; revision: number; error?: string };
      if (!response.ok) throw new Error(result.error || 'Your timetable could not be loaded.');
      if (!validatePlanner(result.data)) throw new Error('Your saved timetable could not be read.');
      setData(result.data); setRevision(result.revision);
    } catch (err) { setLoadError(err instanceof Error ? err.message : 'Could not connect. Please try again.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => desktop?.onNavigate(view => {
    if (view === 'catchup') { setView('overview'); setScope('term'); setFilter('unfinished'); setSearch(''); }
    else setView(view);
  }), []);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); };
  }, []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => { if (saving) event.preventDefault(); };
    window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent);
  }, [saving]);

  async function save(nextData: Planner, message: string) {
    if (saving) return false;
    if (!validatePlanner(nextData)) { setFormError('Please check the course details, session times, tags, and term dates. A term can be up to two years.'); return false; }
    if (example) { setFormError(''); setExample(nextData); setNotice(`${message} · Example only`); return true; }
    const previous = data;
    setSaving(true); setError(''); setFormError(''); setData(nextData);
    try {
      const response = await fetch('/api/planner', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: nextData, revision }) });
      const result = await response.json() as { data: unknown; revision: number; error?: string };
      if (!response.ok) throw new Error(result.error || 'Your change could not be saved.');
      setRevision(result.revision); setNotice(message); return true;
    } catch (err) {
      setData(previous);
      const message = `${err instanceof Error ? err.message : 'Could not connect.'} Your change was undone.`;
      setError(message); setFormError(message);
      return false;
    } finally { setSaving(false); }
  }
  function editTerm() {
    setFormError('');
    setTermEditor(active.term ?? { name: 'My term', start: currentWeek, end: addDays(currentWeek, 83), timezone });
  }
  function editCourse(course?: Course) {
    if (!active.term) { editTerm(); return; }
    setFormError(''); setAddSessionAfterCourse(false); setCourseEditor(course ?? newCourse(active.courses.length));
  }
  function editLecture(lecture?: Lecture, courseId?: string) {
    if (!active.term) { editTerm(); return; }
    if (!active.courses.length) { setFormError(''); setAddSessionAfterCourse(true); setCourseEditor(newCourse(0)); return; }
    setFormError(''); setLectureEditor(lecture ?? newLecture(courseId ?? active.courses[0].id));
  }
  async function submitCourse(course: Course) {
    const exists = active.courses.some(c => c.id === course.id);
    const courses = exists ? active.courses.map(c => c.id === course.id ? course : c) : [...active.courses, course];
    const ok = await save({ ...active, courses }, exists ? 'Course updated for all its sessions' : 'Course added');
    if (ok) { setCourseEditor(null); if (addSessionAfterCourse) { setAddSessionAfterCourse(false); setLectureEditor(newLecture(course.id)); } }
    return ok;
  }
  async function submitTerm(event: FormEvent) {
    event.preventDefault(); if (!termEditor || saving) return;
    const updated = { ...active, term: { ...termEditor, name: termEditor.name.trim() } };
    if (await save(updated, 'Term saved')) { setTermEditor(null); setWeek(''); if (!active.term) setView('schedule'); }
  }
  async function submitLecture(lecture: Lecture) {
    const exists = active.lectures.some(x => x.id === lecture.id);
    const lectures = exists ? active.lectures.map(x => x.id === lecture.id ? lecture : x) : [...active.lectures, lecture];
    const ok = await save({ ...active, lectures }, exists ? 'Session updated' : 'Session added for the whole term');
    if (ok) setLectureEditor(null);
    return ok;
  }
  async function toggle(item: Occurrence) {
    const completed = { ...active.completed };
    if (completed[item.key]) delete completed[item.key]; else completed[item.key] = new Date(now).toISOString();
    await save({ ...active, completed }, item.status === 'completed' ? 'Completion undone' : 'Lecture marked complete');
  }
  function deleteLecture(lecture: Lecture) {
    setFormError('');
    const course = active.courses.find(course => course.id === lecture.courseId)!;
    setConfirm({ title: 'Remove this session?', text: `“${sessionDescription(lecture, course)}” will be removed from every week, along with its completion history.`, label: 'Remove session', action: async () => {
      const completed = Object.fromEntries(Object.entries(active.completed).filter(([key]) => !key.startsWith(`${lecture.id}:`)));
      if (await save({ ...active, lectures: active.lectures.filter(x => x.id !== lecture.id), completed }, 'Lecture removed')) setConfirm(null);
    } });
  }
  function deleteCourse(course: Course) {
    setFormError('');
    setConfirm({ title: 'Remove this course?', text: `“${course.name}” and all its weekly sessions and completion history will be removed.`, label: 'Remove course', action: async () => {
      const removed = new Set(active.lectures.filter(l => l.courseId === course.id).map(l => l.id));
      const completed = Object.fromEntries(Object.entries(active.completed).filter(([key]) => !removed.has(key.slice(0, key.lastIndexOf(':')))));
      if (await save({ ...active, courses: active.courses.filter(c => c.id !== course.id), lectures: active.lectures.filter(l => l.courseId !== course.id), completed }, 'Course removed')) setConfirm(null);
    } });
  }
  function exportBackup() {
    if (!example) { const a = document.createElement('a'); a.href = '/api/backup'; a.download = 'lecture-ledger-backup.json'; a.click(); setNotice('Backup download started'); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: 'lecture-ledger', version: 2, data: active }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'lecture-ledger-backup.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice('Backup downloaded');
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('This backup is too large.');
      const parsed = JSON.parse(await file.text());
      const restored = upgradePlanner(parsed.data);
      if (parsed.format !== 'lecture-ledger' || ![1, 2].includes(parsed.version) || !restored) throw new Error('Choose a valid Lecture Ledger backup.');
      setFormError('');
      setConfirm({ title: 'Restore this timetable?', text: 'This will replace your current term, weekly schedule, and completion history with the backup.', label: 'Restore backup', action: async () => { if (await save(restored, 'Backup restored')) { setConfirm(null); setWeek(''); } } });
    } catch (err) { setError(err instanceof Error ? err.message : 'This backup could not be opened.'); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }
  function showUnfinished() { setView('overview'); setScope('term'); setFilter('unfinished'); setSearch(''); }
  function startExample() { setExample(demoPlanner(now, timezone)); setView('overview'); setWeek(''); setScope('week'); setFilter('all'); }
  const statIcons = { unfinished: CircleDashed, upcoming: Clock3, completed: CheckCheck };

  return <div className={`app-shell${desktop ? ' desktop-app' : ''}`}>
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Lecture Ledger home"><span className="brand-icon"><BookOpen size={25} strokeWidth={1.7} /></span><span>lecture<span className="brand-second">ledger<span className="brand-dot">.</span></span></span></a>
      <div className="nav-label">YOUR STUDY SPACE</div>
      <nav aria-label="Main navigation">
        <button className={view === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setView('overview')}><LayoutDashboard size={18} />Overview</button>
        <button className={view === 'schedule' ? 'nav-item active' : 'nav-item'} onClick={() => setView('schedule')}><BookOpen size={18} />Courses & lectures</button>
        <button className="nav-item" onClick={showUnfinished}><CircleDashed size={18} />Catch up{counts.unfinished > 0 && <span className="nav-count">{counts.unfinished}</span>}</button>
      </nav>
      {active.term && <div className="sidebar-term"><span className="eyebrow">CURRENT TERM</span><strong>{active.term.name}</strong><span>{dateLabel(active.term.start)} — {dateLabel(active.term.end, { day: 'numeric', month: 'short', year: 'numeric' })}</span><div className="term-track"><span style={{ width: `${Math.max(0, Math.min(100, (Date.parse(today) - Date.parse(active.term.start)) / (termDays * 86400000) * 100))}%` }} /></div><span>{today < active.term.start ? 'Your term starts soon' : today > active.term.end ? 'Term finished' : `Week ${Math.floor((Date.parse(today) - Date.parse(active.term.start)) / (7 * 86400000)) + 1} of ${termWeeks}`}</span></div>}
      <div className="sidebar-bottom">{!desktop && <div className="small-note"><Sparkles size={20} /><p>One lecture at a time.<br /><strong>You’ve got this.</strong></p></div>}<button className={view === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => setView('settings')}><Settings2 size={18} />Term & settings</button>{desktop && <button className="nav-item quit-app" disabled={saving} onClick={() => desktop?.quit()}><Power size={18} />Quit app</button>}<div className="save-state" role="status">{loading || saving ? <Loader2 size={15} className="spin" /> : <CloudCheck size={15} />}<span>{example ? 'Exploring an example' : loading ? 'Loading your timetable' : saving ? 'Saving your progress…' : loadError ? 'Could not connect' : error ? 'Save needs attention' : 'Saved on this computer'}</span></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="topbar-label"><GraduationCap size={18} /><span>{desktop ? 'Lecture Ledger' : 'A little progress, every week.'}</span></div><div className="topbar-date"><span className="live-dot" />{dateLabel(today, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div></header>
      <main>
        {example && <div className="example-banner"><span><Sparkles size={16} />You’re exploring an example. Changes here aren’t saved on this computer.</span><button onClick={() => { setExample(null); setWeek(''); setScope('week'); setFilter('all'); }}>Exit example <X size={15} /></button></div>}
        {error && <div className="alert" role="alert"><span>{error}</span><button className="text-button" onClick={() => { void load(); }}>Reload saved data</button><button className="icon-button" onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
        <div className="page-heading"><div><div className="eyebrow">{view === 'overview' ? 'THE BIG PICTURE' : view === 'schedule' ? 'YOUR COURSES, TOGETHER' : 'MAKE IT YOURS'}</div><h1>{desktop ? view === 'overview' ? 'Overview' : view === 'schedule' ? 'Courses & lectures' : 'Term & settings' : view === 'overview' ? 'Your week, at a glance.' : view === 'schedule' ? 'Your courses & lectures.' : 'Your term & settings.'}</h1><p>{view === 'overview' ? 'Know what’s ahead, see what’s done, and pick up where you left off.' : view === 'schedule' ? 'Shared resources, a colour for each course, and sessions you can make your own.' : 'A few details to keep your study space running smoothly.'}</p></div>{view !== 'settings' && <div className="heading-actions">{view === 'schedule' && <button className="button secondary" disabled={busy || active.lectures.length >= 100} onClick={() => editLecture()}><Plus size={16} />Add session</button>}<button className="button primary" disabled={busy || (view === 'schedule' ? active.courses.length >= 100 : active.lectures.length >= 100)} onClick={() => view === 'schedule' ? editCourse() : editLecture()}><Plus size={18} />{view === 'schedule' ? 'Add course' : 'Add lecture'}</button></div>}</div>
        {loading ? <div className="loading-panel"><Loader2 size={26} className="spin" /><p>Opening your study space…</p></div> : loadError ? <div className="empty-panel"><CloudCheck size={32} /><h2>Let’s reconnect.</h2><p>{loadError}</p><button className="button primary" onClick={() => { void load(); }}>Try again</button></div> : <>
          {view === 'overview' && <>
            <div className="stats-grid">{(['unfinished', 'upcoming', 'completed'] as const).map(status => { const Icon = statIcons[status]; return <button key={status} className={`stat-card ${status} ${filter === status ? 'selected' : ''}`} onClick={() => { setFilter(filter === status ? 'all' : status); setScope('term'); setSearch(''); }}><div className="stat-top"><span className={`stat-icon ${status}`}><Icon size={20} /></span><span className="stat-scope">THIS TERM <ArrowUpRight size={14} /></span></div><div className="stat-value">{counts[status]}<span>{labels[status]}</span></div><p>{status === 'unfinished' ? 'Ready for a little catch-up' : status === 'upcoming' ? 'Still ahead of you' : 'One more thing off your list'}</p></button>; })}</div>
            {!active.term ? <div className="onboarding"><div className="onboarding-copy"><span className="welcome-icon"><Repeat2 size={25} /></span><div className="eyebrow">WELCOME TO YOUR STUDY SPACE</div><h2>One week.<br />The whole term.</h2><p>Set your term dates, add your courses, and track their lectures and tutorials in one place.</p><div className="onboarding-actions"><button className="button primary" onClick={editTerm}>Set up my term <ArrowRight size={17} /></button><button className="text-button" onClick={startExample}>Explore an example</button></div></div><div className="onboarding-steps"><div><span>01</span><section><strong>Set your term dates</strong><p>Choose when your lectures start and finish.</p></section><CalendarDays size={21} /></div><div><span>02</span><section><strong>Connect your courses</strong><p>One colour and resource links for each course.</p></section><Repeat2 size={21} /></div><div><span>03</span><section><strong>Track lectures & tutorials</strong><p>Add weekly sessions, tag them, and mark them done.</p></section><CheckCheck size={21} /></div><p className="onboarding-note"><CloudCheck size={15} />Your timetable and progress are saved on this computer.</p></div></div> : <div className="overview-grid"><section className="lecture-panel">
              <div className="panel-heading"><div><h2>Your lectures & tutorials</h2><p>{scope === 'term' ? 'Every occurrence in your term' : `${dateLabel(selectedWeek)} – ${dateLabel(addDays(selectedWeek, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`}</p></div><div className="scope-toggle"><button className={scope === 'week' ? 'active' : ''} onClick={() => setScope('week')}>Week</button><button className={scope === 'term' ? 'active' : ''} onClick={() => setScope('term')}>Term</button></div></div>
              {scope === 'week' && <div className="week-navigation"><button className="icon-button" onClick={() => setWeek(addDays(selectedWeek, -7))} aria-label="Previous week" disabled={selectedWeek <= monday(active.term.start)}><ChevronLeft size={18} /></button><span>{selectedWeek === currentWeek ? 'This week' : selectedWeek === addDays(currentWeek, -7) ? 'Last week' : selectedWeek === addDays(currentWeek, 7) ? 'Next week' : `Week of ${dateLabel(selectedWeek)}`}</span><button className="text-button" onClick={() => setWeek('')} disabled={selectedWeek === defaultWeek}>Today</button><button className="icon-button" onClick={() => setWeek(addDays(selectedWeek, 7))} aria-label="Next week" disabled={selectedWeek >= monday(active.term.end)}><ChevronRight size={18} /></button></div>}
              <div className="filter-tabs" aria-label="Filter lectures">{(['all', 'unfinished', 'upcoming', 'completed'] as Filter[]).map(key => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)} aria-pressed={filter === key}>{labels[key]}<span>{key === 'all' ? scoped.length : scopedCounts[key]}</span></button>)}</div>
              <div className="search-box"><Search size={17} /><input aria-label="Search sessions" placeholder="Find a course or tag…" value={search} onChange={e => setSearch(e.target.value)} />{search && <button className="icon-button" aria-label="Clear search" onClick={() => setSearch('')}><X size={15} /></button>}</div>
              <div className="lecture-list">{groups.length === 0 ? <div className="list-empty"><span className="empty-icon">{filter === 'unfinished' ? <CheckCheck size={26} /> : <BookOpen size={26} />}</span><h3>{search ? 'No matching lectures' : !active.lectures.length ? 'Your week starts here.' : filter === 'unfinished' ? 'Nothing to catch up on.' : filter === 'completed' ? 'Progress starts with one lecture.' : filter === 'upcoming' ? 'Nothing coming up in this view.' : 'A little breathing room.'}</h3><p>{search ? 'Try another course or tag.' : !active.lectures.length ? 'Add a course and its first weekly session to begin.' : 'Try another week or switch to the full term view.'}</p>{!active.lectures.length && <button className="button secondary" disabled={busy} onClick={() => editLecture()}>Add your first lecture <Plus size={16} /></button>}</div> : groups.map(course => <div className={`course-occurrence-group theme-${course.color}`} key={course.id}><div className="course-group-heading"><span className={`course-avatar ${course.color}`}><BookOpen size={17} /></span><div><h3>{course.name}</h3><span>{filtered.filter(x => x.courseId === course.id).length} session{filtered.filter(x => x.courseId === course.id).length !== 1 ? 's' : ''} in this view</span></div>{materialsUrl(course) ? <a className="group-materials-link" href={materialsUrl(course)!} target="_blank" rel="noopener noreferrer" aria-label={`Materials for ${course.name}`}><BookOpen size={13} />Materials<ExternalLink size={11} /></a> : <button className="text-button" disabled={busy} onClick={() => editCourse(course)}>Add links <Plus size={12} /></button>}</div>{filtered.filter(x => x.courseId === course.id).map(item => <LectureRow key={item.key} item={item} now={now} busy={busy} onToggle={() => { void toggle(item); }} />)}</div>)}</div>
              <div className="panel-footnote"><Clock3 size={14} /><span>Lectures become unfinished after their scheduled end time.</span></div>
            </section><aside className="insights">
              <div className={`next-card theme-${next?.color ?? 'sage'}`}><div className="eyebrow"><span className="live-dot" />{next && next.startAt <= now ? 'HAPPENING NOW' : 'UP NEXT'}</div>{next ? <><h2>{next.course.name}</h2><p className="next-date">{next.date === today ? 'Today' : next.date === addDays(today, 1) ? 'Tomorrow' : dateLabel(next.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {next.start}–{next.end}</p><Tags tags={next.tags} />{materialsUrl(next.course) && <a className="next-materials-link" href={materialsUrl(next.course)!} target="_blank" rel="noopener noreferrer"><BookOpen size={14} />Course materials <ExternalLink size={11} /></a>}<div className="next-divider" /><button className="text-button" onClick={() => { setWeek(monday(next.date)); setScope('week'); setFilter('all'); setSearch(''); }}>See in your week <ArrowRight size={16} /></button></> : <><h2>{active.lectures.length ? 'That’s everything ahead.' : 'Make room for learning.'}</h2><p>{active.lectures.length ? 'No upcoming lectures left in this term.' : 'Your next lecture will appear here when you add your timetable.'}</p><BookOpen className="next-illustration" size={55} strokeWidth={1} /></>}</div>
              <div className="progress-card"><div className="panel-heading"><h2>Term progress</h2><GraduationCap size={19} /></div><div className="progress-donut" style={{ background: `conic-gradient(#46785b ${progress}%, #edf0e9 0)` }}><div><strong>{progress}%</strong><span>completed</span></div></div><p><strong>{counts.completed} of {due}</strong> due sessions completed</p><span className="muted">Upcoming lectures don’t count against you.</span>{counts.unfinished > 0 ? <button className="catch-up-button" onClick={showUnfinished}>{counts.unfinished} lecture{counts.unfinished !== 1 ? 's' : ''} to catch up on <ArrowRight size={15} /></button> : <div className="caught-up"><Check size={16} />{due ? 'You’re all caught up!' : 'A fresh start for your term'}</div>}</div>
              <div className="how-it-works"><Repeat2 size={19} /><div><strong>A timetable that takes care of itself.</strong><p>Your sessions repeat weekly until {dateLabel(active.term.end)}. Check them off at your own pace.</p></div></div>
            </aside></div>}
          </>}
          {view === 'schedule' && <>{!active.term ? <div className="empty-panel"><BookOpen size={34} /><h2>Start with your term.</h2><p>Set your start and end dates, then add courses and their weekly sessions.</p><button className="button primary" onClick={editTerm}>Set up my term <ArrowRight size={16} /></button></div> : <><div className="schedule-summary"><span><Repeat2 size={18} /><strong>{active.courses.length} course{active.courses.length !== 1 ? 's' : ''} · {active.lectures.length} weekly session{active.lectures.length !== 1 ? 's' : ''}</strong><span>Repeats {dateLabel(active.term.start)} – {dateLabel(active.term.end)}</span></span><button className="text-button" onClick={editTerm}>Edit term <Pencil size={14} /></button></div><CoursesPanel data={active} all={all} busy={busy} onAddCourse={() => editCourse()} onEditCourse={editCourse} onDeleteCourse={deleteCourse} onAddLecture={courseId => editLecture(undefined, courseId)} onEditLecture={lecture => editLecture(lecture)} onDeleteLecture={deleteLecture} /><div className="schedule-note"><BookOpen size={18} /><p>Course materials and recording folders are saved once per course. Each occurrence has a recording link for its own date. Tags such as <strong>Tutorial</strong> belong to individual weekly sessions.</p></div></>}</>}
          {view === 'settings' && <div className="settings-grid"><section className="settings-card"><span className="setting-icon"><CalendarDays size={24} /></span><h2>Your current term</h2>{active.term ? <><dl><div><dt>Term name</dt><dd>{active.term.name}</dd></div><div><dt>Start date</dt><dd>{dateLabel(active.term.start, { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div><div><dt>End date</dt><dd>{dateLabel(active.term.end, { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div><div><dt>Timezone</dt><dd>{active.term.timezone.replaceAll('_', ' ')}</dd></div></dl><button className="button secondary" disabled={busy} onClick={editTerm}><Pencil size={16} />Edit term details</button></> : <><p>Set your term dates to start building your timetable.</p><button className="button primary" onClick={editTerm}>Set up my term</button></>}</section><section className="settings-card"><span className="setting-icon"><CloudCheck size={24} /></span><h2>Saved on your computer.</h2><p>Your timetable and completion history are stored in a local SQLite database. They stay saved when you close and reopen the app. Export a backup to move your progress to another computer.</p><div className="rule-note"><Clock3 size={20} /><div><strong>The clock does the organising.</strong><p>A lecture stays upcoming until its end time passes. Then it becomes unfinished, unless you’ve marked that occurrence done.</p></div></div><h3>Keep a copy</h3><p>Download a backup of your timetable and progress, or restore one you saved earlier.</p><div className="backup-actions"><button className="button secondary" disabled={busy} onClick={exportBackup}><Download size={16} />Export backup</button><button className="button secondary" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={16} />Restore backup</button><input ref={fileRef} type="file" accept=".json,application/json" hidden aria-label="Choose backup" onChange={e => { void importBackup(e.target.files?.[0]); }} /></div></section></div>}
        </>}
        {!desktop && <footer className="page-footer"><span>lecture ledger<span className="brand-dot">.</span></span><span>A clearer week. A calmer term.</span></footer>}
      </main>
    </div>
    {notice && <div className="toast" role="status"><Check size={17} />{notice}</div>}
    {termEditor && <Modal title={active.term ? 'Edit your term' : 'Let’s set up your term.'} subtitle="Your weekly lectures will repeat between these dates, including the end date." onClose={() => { if (!saving) setTermEditor(null); }}><form onSubmit={submitTerm}><label className="field">Term name<input required autoFocus maxLength={80} value={termEditor.name} onChange={e => setTermEditor({ ...termEditor, name: e.target.value })} placeholder="e.g. Autumn term 2026" /></label><div className="field-row"><label className="field">Start date<input type="date" required value={termEditor.start} onInput={e => setTermEditor({ ...termEditor, start: e.currentTarget.value })} onChange={e => setTermEditor({ ...termEditor, start: e.target.value })} /></label><label className="field">End date<input type="date" required min={termEditor.start} value={termEditor.end} onInput={e => setTermEditor({ ...termEditor, end: e.currentTarget.value })} onChange={e => setTermEditor({ ...termEditor, end: e.target.value })} /></label></div><label className="field">Lecture timezone<input required list="timezones" value={termEditor.timezone} onChange={e => setTermEditor({ ...termEditor, timezone: e.target.value })} /><datalist id="timezones">{[...new Set([timezone, 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'UTC'])].map(zone => <option key={zone} value={zone} />)}</datalist><span className="field-help">Detected from your device. Use the timezone where your lectures take place.</span></label>{active.term && <p className="form-note">Changing the dates updates the lectures shown in your term. Saved completion records are kept.</p>}{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-footer"><button type="button" className="button secondary" disabled={saving} onClick={() => setTermEditor(null)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}Save term</button></div></form></Modal>}
    {courseEditor && <Modal title={active.courses.some(c => c.id === courseEditor.id) ? 'Edit course' : 'Add a course.'} subtitle="Save its resources once. Every lecture and tutorial will share them." onClose={() => { if (!saving) setCourseEditor(null); }}><CourseForm course={courseEditor} existingCourses={active.courses} saving={saving} error={formError} onError={setFormError} onSave={submitCourse} onClose={() => setCourseEditor(null)} /></Modal>}
    {lectureEditor && active.term && <Modal title={active.lectures.some(l => l.id === lectureEditor.id) ? 'Edit weekly session' : 'Add a weekly session.'} subtitle="Each week gets its own completion record and date-filtered recording link." onClose={() => { if (!saving) setLectureEditor(null); }}><LectureForm lecture={lectureEditor} courses={active.courses} termEnd={dateLabel(active.term.end)} timezone={timezone} saving={saving} error={formError} onError={setFormError} onSave={submitLecture} onClose={() => setLectureEditor(null)} /></Modal>}
    {confirm && <Modal title={confirm.title} onClose={() => { if (!saving) setConfirm(null); }}><p className="confirm-text">{confirm.text}</p>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-footer"><button className="button secondary" disabled={saving} onClick={() => setConfirm(null)}>Cancel</button><button className="button danger" disabled={saving} onClick={() => { void confirm.action(); }}>{saving && <Loader2 size={16} className="spin" />}{confirm.label}</button></div></Modal>}
  </div>;
}

function LectureRow({ item, now, busy, onToggle }: { item: Occurrence; now: number; busy: boolean; onToggle: () => void }) {
  const inProgress = item.status === 'upcoming' && item.startAt <= now;
  const minutes = (time: string) => Number(time.split(':')[0]) * 60 + Number(time.split(':')[1]);
  const duration = minutes(item.end) - minutes(item.start);
  const recording = recordingUrl(item.course, item.date);
  return <div className={`lecture-row course-lecture-row ${item.status}`}>
    <div className="occurrence-date" title={dateLabel(item.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}><strong>{dateLabel(item.date, { day: 'numeric' })}</strong><span>{dateLabel(item.date, { month: 'short' })}</span></div>
    <div className="lecture-info"><div className="session-title-line"><Tags tags={item.tags} /></div><div className="session-resource-line"><span>{DAYS[(new Date(`${item.date}T12:00:00Z`).getUTCDay() + 6) % 7]}</span>{recording && <a href={recording} target="_blank" rel="noopener noreferrer" aria-label={`Recording for ${sessionLabel(item)}, ${item.course.name}, ${dateLabel(item.date, { day: 'numeric', month: 'short', year: 'numeric' })}`}><Video size={13} />Recording<ExternalLink size={10} /></a>}</div></div>
    <div className="lecture-time"><span>{formatTime(item.start)} — {formatTime(item.end)}</span><span>{duration} min</span></div>
    <span className={`status-badge ${item.status}`}><span />{inProgress ? 'In progress' : labels[item.status]}</span>
    <button className={`complete-button ${item.status === 'completed' ? 'checked' : ''}`} title={item.status === 'completed' ? 'Undo completion' : 'Mark complete'} aria-label={`${item.status === 'completed' ? 'Undo completion of' : 'Mark complete:'} ${sessionLabel(item)}, ${item.course.name}, ${dateLabel(item.date)}`} aria-pressed={item.status === 'completed'} disabled={busy} onClick={onToggle}><Check size={17} /></button>
  </div>;
}
