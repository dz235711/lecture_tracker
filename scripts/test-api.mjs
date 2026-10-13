import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:5173';
assert.equal((await fetch(`${base}/api/planner`)).status, 401);
const signIn = await fetch(`${base}/signin-with-chatgpt?return_to=/`, { redirect: 'manual' });
const cookie = signIn.headers.get('set-cookie').split(';')[0];
const headers = { 'Content-Type': 'application/json', Origin: base, Cookie: cookie };
const get = async () => (await fetch(`${base}/api/planner`, { headers: { Cookie: cookie } })).json();
const put = (data, revision, extraHeaders = {}) => fetch(`${base}/api/planner`, { method: 'PUT', headers: { ...headers, ...extraHeaders }, body: JSON.stringify({ data, revision }) });
const initial = await get();
let revision = initial.revision;
const testData = {
  schemaVersion: 2,
  term: { name: 'Local course integration test', start: '2026-10-12', end: '2026-11-02', timezone: 'Europe/London' },
  courses: [{ id: 'qc-api-test', name: 'Quantum computing', number: '70021', folderId: '4394cd01-a3d6-489a-b98c-b49b011de184', color: 'violet' }],
  lectures: [
    { id: 'qc-lecture', courseId: 'qc-api-test', title: 'Quantum lecture', day: 0, start: '09:30', end: '11:00', tags: [] },
    { id: 'qc-tutorial', courseId: 'qc-api-test', title: 'Problem class', day: 2, start: '10:00', end: '11:00', tags: ['Tutorial'] },
  ], completed: { 'qc-lecture:2026-10-12': '2026-10-13T10:00:00Z' },
};
try {
  assert.equal((await put(testData,revision,{ Origin:'https://another.example' })).status,403);
  const invalid = structuredClone(testData); invalid.lectures[0].courseId = 'missing-course';
  assert.equal((await put(invalid,revision)).status,400);
  assert.equal((await put({ term: initial.data.term, lectures: [], completed: {} },revision)).status,409);
  const save = await put(testData,revision); assert.equal(save.status,200); revision=(await save.json()).revision;
  assert.deepEqual((await get()).data,testData);
  assert.equal((await put(testData,revision-1)).status,409);
  const edited = structuredClone(testData); edited.courses[0].name='Quantum computing · renamed'; edited.courses[0].color='blue';
  const update = await put(edited,revision); assert.equal(update.status,200); revision=(await update.json()).revision;
  const after = await get(); assert.deepEqual(after.data,edited);
  assert.deepEqual(after.data.completed,testData.completed);
  assert.deepEqual(after.data.lectures[1].tags,['Tutorial']);
  assert.equal(after.data.lectures[0].courseId,after.data.lectures[1].courseId);
  console.log('Passed: courses/tags/completion persist, shared metadata edits retain history, invalid references and legacy writes rejected, sign-in/origin checks, and conflicting saves prevented.');
} finally {
  const restored=await put(initial.data,revision);
  assert.equal(restored.status,200,'Could not restore the local test state; reload before continuing.');
}
