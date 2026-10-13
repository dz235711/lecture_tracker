import assert from 'node:assert/strict';
import { addDays, dateInZone, monday, occurrences, validatePlanner, zonedTimestamp, upgradePlanner, materialsUrl, recordingUrl, recordingsFolderUrl, parseFolderId, splitTags } from '../lib/model.ts';
const course = { id: 'course-1', name: 'Quantum computing', number: '70021', folderId: '4394cd01-a3d6-489a-b98c-b49b011de184', color: 'violet' };
const lecture = { id: 'lecture-1', title: 'Quantum lecture', courseId: course.id, day: 0, start: '09:00', end: '10:00', tags: [] };
const data = { schemaVersion: 2, courses: [course], term: { name: 'Autumn', start: '2026-10-12', end: '2026-11-02', timezone: 'Europe/London' }, lectures: [lecture], completed: {} };
assert.equal(validatePlanner(data), true);
const firstEnd = zonedTimestamp('2026-10-12', '10:00', 'Europe/London');
assert.equal(occurrences(data, firstEnd - 1)[0].status, 'upcoming');
assert.equal(occurrences(data, firstEnd)[0].status, 'unfinished');
assert.equal(occurrences(data, firstEnd)[1].status, 'upcoming');
const done = structuredClone(data); done.completed['lecture-1:2026-10-12'] = '2026-10-12T09:30:00Z';
assert.equal(occurrences(done, firstEnd)[0].status, 'completed');
assert.equal(occurrences(done, Date.parse('2026-10-20T12:00:00Z'))[1].status, 'unfinished');
assert.deepEqual(occurrences(data, 0).map(x => x.date), ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
const midweek = structuredClone(data); midweek.term.start = '2026-10-13';
assert.equal(occurrences(midweek, 0)[0].date, '2026-10-19');
assert.equal(new Date(zonedTimestamp('2026-10-19', '09:00', 'Europe/London')).toISOString(), '2026-10-19T08:00:00.000Z');
assert.equal(new Date(zonedTimestamp('2026-10-26', '09:00', 'Europe/London')).toISOString(), '2026-10-26T09:00:00.000Z');
assert.equal(new Date(zonedTimestamp('2026-03-23', '09:00', 'Europe/London')).toISOString(), '2026-03-23T09:00:00.000Z');
assert.equal(new Date(zonedTimestamp('2026-03-30', '09:00', 'Europe/London')).toISOString(), '2026-03-30T08:00:00.000Z');
assert.equal(dateInZone(Date.parse('2026-10-12T23:30:00Z'), 'Europe/London'), '2026-10-13');
assert.equal(monday('2026-10-18'), '2026-10-12');
assert.equal(addDays('2026-12-31', 1), '2027-01-01');
for (const mutate of [d => d.term.end = '2026-02-30', d => d.term.end = '2026-10-01', d => d.term.timezone = 'Mars/Base', d => d.lectures[0].end = '08:00', d => d.lectures[0].start = '25:00', d => d.lectures[0].day = 7, d => d.lectures.push(d.lectures[0]), d => d.lectures[0].courseId = 'missing', d => d.courses[0].folderId = 'javascript:bad', d => d.courses[0].number = '../evil', d => d.lectures[0].tags = ['x'.repeat(31)], d => d.courses.push({ ...d.courses[0], id: 'another' }), d => d.completed['unknown:2026-10-12'] = '2026-10-12T10:00:00Z']) {
 const bad = structuredClone(data); mutate(bad); assert.equal(validatePlanner(bad), false);
}
for(let day=0;day<7;day++) { const d=structuredClone(data); d.lectures[0].day=day; const list=occurrences(d,0); assert.equal(list[0].date,addDays('2026-10-12',day)); assert.ok(list.every(x=>x.date<=d.term.end)); }
console.log('Passed: recurrence, inclusive term end, independent completion, clock boundary, timezones, DST, all weekdays, and invalid data.');

const expected = 'https://imperial.cloud.panopto.eu/Panopto/Pages/Sessions/List.aspx#folderID=%224394cd01-a3d6-489a-b98c-b49b011de184%22&startDate=%2210%2F12%2F2026%22&endDate=%2210%2F12%2F2026%22';
assert.equal(materialsUrl(course), 'https://scientia.doc.ic.ac.uk/2627/modules/70021/materials');
assert.equal(recordingUrl(course, '2026-10-12'), expected);
assert.equal(recordingUrl(course, '2026-10-19'), expected.replaceAll('10%2F12%2F2026', '10%2F19%2F2026'));
assert.equal(recordingUrl(course, '2027-01-04'), expected.replaceAll('10%2F12%2F2026', '01%2F04%2F2027'));
assert.equal(parseFolderId(expected), course.folderId);
assert.equal(parseFolderId('"'+course.folderId.toUpperCase()+'"'), course.folderId);
assert.equal(parseFolderId('https://evil.example/#folderID='+course.folderId), null);
assert.equal(recordingUrl(course, '2026-02-30'), null);
assert.equal(materialsUrl({ ...course, number: '' }), null);
assert.equal(recordingsFolderUrl({ ...course, folderId: '' }), null);
assert.deepEqual(splitTags('Tutorial, Lab, Tutorial, , Revision'), ['Tutorial', 'Lab', 'Revision']);
const tutorial = structuredClone(data); tutorial.lectures.push({ ...lecture, id: 'tutorial-1', title: 'Problem class', day: 2, tags: ['Tutorial'] });
const shared = occurrences(tutorial, 0);
assert.ok(shared.every(l => l.course === tutorial.courses[0] && l.color === 'violet'));
tutorial.courses[0].color = 'blue'; tutorial.courses[0].folderId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
assert.ok(occurrences(tutorial,0).every(l => l.color === 'blue' && recordingUrl(l.course,l.date).includes('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')));
const legacy = { term: data.term, lectures: [
 { id: 'lecture-1', title: 'Quantum lecture', course: 'QC', day: 0, start: '09:00', end: '10:00', location: 'Old room', color: 'violet' },
 { id: 'tutorial-1', title: 'Quantum tutorial', course: 'QC', day: 2, start: '10:00', end: '11:00', location: 'Other room', color: 'blue' },
], completed: { 'lecture-1:2026-10-12': '2026-10-12T10:30:00Z' } };
const upgraded = upgradePlanner(legacy);
assert.ok(validatePlanner(upgraded)); assert.equal(upgraded.courses.length,1);
assert.equal(upgraded.lectures[0].courseId, upgraded.lectures[1].courseId);
assert.deepEqual(upgraded.completed, legacy.completed);
assert.equal(occurrences(upgraded,firstEnd).find(l=>l.key==='lecture-1:2026-10-12').status,'completed');
assert.equal(upgraded.lectures[0].id, legacy.lectures[0].id);
assert.equal(upgraded.lectures[0].start, legacy.lectures[0].start);
assert.deepEqual(upgradePlanner(upgraded), upgraded);
assert.equal(upgradePlanner({ ...legacy, schemaVersion: 3 }), null);
assert.equal(upgradePlanner({ term: null, lectures: [], completed: {} }).schemaVersion,2);
assert.equal(upgradePlanner({ ...legacy, lectures: [{ ...legacy.lectures[0], day: 9 }] }), null);
console.log('Passed: exact supplied links, per-occurrence dates, year boundaries, shared course metadata/colour, folder parsing, tags, and legacy timetable/backup migration with completion preserved.');
