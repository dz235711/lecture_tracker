'use client';

import { useState, type FormEvent } from 'react';
import { BookOpen, Plus, Pencil, Trash2, ExternalLink, Video, Repeat2, Check, Loader2, Sparkles } from 'lucide-react';
import { COLORS, DAYS, QUANTUM_COURSE, materialsUrl, recordingsFolderUrl, parseFolderId, splitTags, sessionDescription, type Course, type Lecture, type Occurrence, type Planner } from '../lib/model';

export function CourseLinks({ course, onConfigure }: { course: Course; onConfigure?: () => void }) {
  const materials = materialsUrl(course);
  const recordings = recordingsFolderUrl(course);
  return <div className="course-links">
    {materials && <a href={materials} target="_blank" rel="noopener noreferrer" aria-label={`Course materials for ${course.name}`}><BookOpen size={14} />Course materials<ExternalLink size={11} /></a>}
    {recordings && <a href={recordings} target="_blank" rel="noopener noreferrer" aria-label={`All recordings for ${course.name}`}><Video size={14} />All recordings<ExternalLink size={11} /></a>}
    {(!materials || !recordings) && onConfigure && <button type="button" onClick={onConfigure}><Plus size={13} />Add course links</button>}
  </div>;
}
export function Tags({ tags }: { tags: string[] }) {
  return <span className="session-tags">{(tags.length ? tags : ['Lecture']).map(tag => <span key={tag}>{tag}</span>)}</span>;
}

export function CoursesPanel({ data, all, busy, onAddCourse, onEditCourse, onDeleteCourse, onAddLecture, onEditLecture, onDeleteLecture }: {
  data: Planner; all: Occurrence[]; busy: boolean;
  onAddCourse: () => void; onEditCourse: (course: Course) => void; onDeleteCourse: (course: Course) => void;
  onAddLecture: (courseId: string) => void; onEditLecture: (lecture: Lecture) => void; onDeleteLecture: (lecture: Lecture) => void;
}) {
  if (!data.courses.length) return <div className="empty-panel"><BookOpen size={34} /><h2>Start with a course.</h2><p>Add its name, course number, and Panopto folder ID. Then add the lectures or tutorials you want to track.</p><button className="button primary" disabled={busy} onClick={onAddCourse}>Add your first course <Plus size={16} /></button></div>;
  return <div className="courses-grid">{data.courses.map(course => {
    const lectures = data.lectures.filter(l => l.courseId === course.id).sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
    const instances = all.filter(l => l.courseId === course.id);
    const counts = { unfinished: instances.filter(l => l.status === 'unfinished').length, completed: instances.filter(l => l.status === 'completed').length, upcoming: instances.filter(l => l.status === 'upcoming').length };
    return <section className={`course-card theme-${course.color}`} key={course.id}>
      <div className="course-card-heading"><span className={`course-avatar ${course.color}`}><BookOpen size={22} /></span><div><h2>{course.name}</h2><p>{lectures.length} weekly session{lectures.length !== 1 ? 's' : ''}</p></div><div className="course-card-actions"><button className="icon-button" disabled={busy} onClick={() => onEditCourse(course)} aria-label={`Edit course ${course.name}`}><Pencil size={15} /></button><button className="icon-button" disabled={busy} onClick={() => onDeleteCourse(course)} aria-label={`Remove course ${course.name}`}><Trash2 size={15} /></button></div></div>
      <CourseLinks course={course} onConfigure={() => onEditCourse(course)} />
      <div className="course-progress-summary"><span><i className="status-dot unfinished" />{counts.unfinished} unfinished</span><span><i className="status-dot upcoming" />{counts.upcoming} upcoming</span><span><i className="status-dot completed" />{counts.completed} completed</span></div>
      <div className="course-sessions">{lectures.length ? lectures.map(lecture => <div className="course-session" key={lecture.id}><div className="course-session-info"><Tags tags={lecture.tags} /><p><Repeat2 size={12} />{DAYS[lecture.day]} · {lecture.start}–{lecture.end}</p></div><div className="session-edit-actions"><button className="icon-button" disabled={busy} onClick={() => onEditLecture(lecture)} aria-label={`Edit session ${sessionDescription(lecture, course)}`}><Pencil size={14} /></button><button className="icon-button" disabled={busy} onClick={() => onDeleteLecture(lecture)} aria-label={`Remove session ${sessionDescription(lecture, course)}`}><Trash2 size={14} /></button></div></div>) : <div className="no-course-sessions">Add a weekly lecture or tutorial to start tracking this course.</div>}</div>
      <button className="course-add-session" disabled={busy || data.lectures.length >= 100} onClick={() => onAddLecture(course.id)}><Plus size={15} />Add weekly session</button>
    </section>;
  })}</div>;
}

export function CourseForm({ course, existingCourses, saving, error, onError, onSave, onClose }: {
  course: Course; existingCourses: Course[]; saving: boolean; error: string;
  onError: (message: string) => void; onSave: (course: Course) => Promise<boolean>; onClose: () => void;
}) {
  const [draft, setDraft] = useState(course);
  const [folderInput, setFolderInput] = useState(course.folderId);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const folderId = parseFolderId(folderInput);
    if (!folderId) { onError('Enter a valid Panopto folder ID, or paste its Imperial Panopto folder link.'); return; }
    const number = draft.number.trim();
    if (!/^\d{1,10}$/.test(number)) { onError('Enter the numeric course number from the Scientia URL, such as 70021.'); return; }
    if (existingCourses.some(c => c.id !== draft.id && c.number === number)) { onError('That course number is already in your tracker. Add sessions to the existing course instead.'); return; }
    await onSave({ ...draft, name: draft.name.trim(), number, folderId });
  }
  return <form onSubmit={submit}>
    <label className="field">Course name<input autoFocus required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Quantum computing" /></label>
    <label className="field">Course number<input required inputMode="numeric" pattern="[0-9]{1,10}" maxLength={10} value={draft.number} onChange={e => setDraft({ ...draft, number: e.target.value })} placeholder="e.g. 70021" /><span className="field-help">The number in your Scientia materials URL: /modules/70021/materials. Materials use the 2627 course year.</span></label>
    <label className="field">Panopto folder ID<input required value={folderInput} onChange={e => setFolderInput(e.target.value)} maxLength={2000} placeholder="4394cd01-a3d6-489a-b98c-b49b011de184" /><span className="field-help">Paste the folderID value, or the full Imperial Panopto folder link. Each session’s recording link will be filtered to its own date.</span></label>
    {!existingCourses.some(c => c.id === course.id) && <button type="button" className="example-course-button" onClick={() => { setDraft({ ...draft, ...QUANTUM_COURSE }); setFolderInput(QUANTUM_COURSE.folderId); onError(''); }}><Sparkles size={13} />Use your Quantum computing example</button>}
    <fieldset className="color-field"><legend>Course colour</legend>{COLORS.map(color => <button key={color} type="button" className={`color-choice ${color} ${draft.color === color ? 'active' : ''}`} aria-label={`${color} course colour`} aria-pressed={draft.color === color} onClick={() => setDraft({ ...draft, color })}>{draft.color === color && <Check size={17} />}</button>)}</fieldset>
    <p className="form-note"><BookOpen size={15} />These details are shared by every session in this course.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-footer"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}Save course</button></div>
  </form>;
}

export function LectureForm({ lecture, courses, termEnd, timezone, saving, error, onError, onSave, onClose }: {
  lecture: Lecture; courses: Course[]; termEnd: string; timezone: string; saving: boolean; error: string;
  onError: (message: string) => void; onSave: (lecture: Lecture) => Promise<boolean>; onClose: () => void;
}) {
  const [draft, setDraft] = useState(lecture);
  const [tagInput, setTagInput] = useState(lecture.tags.join(', '));
  const tags = splitTags(tagInput);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.end <= draft.start) { onError('The end time must be later than the start time.'); return; }
    if (tags.length > 8 || tags.some(tag => tag.length > 30)) { onError('Use up to 8 tags, with no more than 30 characters each.'); return; }
    await onSave({ ...draft, tags });
  }
  return <form onSubmit={submit}>
    <label className="field">Course<select autoFocus required value={draft.courseId} onChange={e => setDraft({ ...draft, courseId: e.target.value })}>{courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="field">Day of the week<select value={draft.day} onChange={e => setDraft({ ...draft, day: Number(e.target.value) })}>{DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}</select></label>
    <div className="field-row"><label className="field">Start time<input type="time" required value={draft.start} onInput={e => setDraft({ ...draft, start: e.currentTarget.value })} onChange={e => setDraft({ ...draft, start: e.target.value })} /></label><label className="field">End time<input type="time" required value={draft.end} onInput={e => setDraft({ ...draft, end: e.currentTarget.value })} onChange={e => setDraft({ ...draft, end: e.target.value })} /></label></div>
    <label className="field">Session tags <span className="optional">optional</span><input value={tagInput} onChange={e => setTagInput(e.target.value)} maxLength={255} placeholder="Lecture, Tutorial, Lab" /><span className="field-help">Separate tags with commas. These identify the session within its course. Leave blank for a regular lecture.</span></label>
    <div className="suggested-tags">{['Lecture', 'Tutorial', 'Lab', 'Seminar', 'Revision'].map(tag => <button type="button" key={tag} aria-pressed={tags.includes(tag)} className={tags.includes(tag) ? 'active' : ''} onClick={() => setTagInput((tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]).join(', '))}>{tags.includes(tag) ? <Check size={12} /> : <Plus size={12} />}{tag}</button>)}</div>
    <p className="form-note"><Repeat2 size={15} />Repeats weekly until {termEnd} · {timezone.replaceAll('_', ' ')}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-footer"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="button primary" disabled={saving}>{saving ? <Loader2 size={16} className="spin" /> : <Check size={16} />}Save session</button></div>
  </form>;
}
