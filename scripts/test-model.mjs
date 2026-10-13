import assert from 'node:assert/strict';
import { addDays, dateInZone, monday, occurrences, validatePlanner, zonedTimestamp } from '../lib/model.ts';
const lecture = { id: 'lecture-1', title: 'Algebra', course: 'MATH', day: 0, start: '09:00', end: '10:00', location: '', color: 'sage' };
const data = { term: { name: 'Autumn', start: '2026-10-12', end: '2026-11-02', timezone: 'Europe/London' }, lectures: [lecture], completed: {} };
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
for (const mutate of [d => d.term.end = '2026-02-30', d => d.term.end = '2026-10-01', d => d.term.timezone = 'Mars/Base', d => d.lectures[0].end = '08:00', d => d.lectures[0].start = '25:00', d => d.lectures[0].day = 7, d => d.lectures.push(d.lectures[0]), d => d.completed['unknown:2026-10-12'] = '2026-10-12T10:00:00Z']) {
 const bad = structuredClone(data); mutate(bad); assert.equal(validatePlanner(bad), false);
}
for(let day=0;day<7;day++) { const d=structuredClone(data); d.lectures[0].day=day; const list=occurrences(d,0); assert.equal(list[0].date,addDays('2026-10-12',day)); assert.ok(list.every(x=>x.date<=d.term.end)); }
console.log('Passed: recurrence, inclusive term end, independent completion, clock boundary, timezones, DST, all weekdays, and invalid data.');
