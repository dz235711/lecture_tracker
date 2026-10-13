import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { startLedger } from '../server/index.mjs';
import { openStore, readBackup } from '../server/store.mjs';

const data = {
  schemaVersion: 2,
  term: { name: 'Autumn test', start: '2026-10-12', end: '2026-11-02', timezone: 'Europe/London' },
  courses: [{ id: 'qc-test', name: 'Quantum computing', number: '70021', folderId: '4394cd01-a3d6-489a-b98c-b49b011de184', color: 'violet' }],
  lectures: [{ id: 'lecture-test', courseId: 'qc-test', day: 0, start: '09:00', end: '10:00', tags: [] }, { id: 'tutorial-test', courseId: 'qc-test', day: 2, start: '10:00', end: '11:00', tags: ['Tutorial'] }],
  completed: { 'lecture-test:2026-10-12': '2026-10-13T10:00:00Z' },
};
test('local storage persists across restarts and protects updates and private files', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lecture-ledger-test-'));
  const databasePath = join(folder, 'private', 'lecture-ledger.sqlite');
  const staticDirectory = join(folder, 'dist');
  await mkdir(staticDirectory); await mkdir(join(folder, 'private')); await writeFile(join(staticDirectory,'index.html'),'<h1>Lecture Ledger test</h1>');
  await writeFile(join(folder,'private','private.json'), 'private timetable');
  let app;
  try {
    app = await startLedger({ port: 0, databasePath, staticDirectory });
    let origin = app.origin;
    let get = async () => (await fetch(origin+'/api/planner')).json();
    let put = (body, headers = {}) => fetch(origin+'/api/planner', { method:'PUT', headers:{ Origin:origin, 'Content-Type':'application/json', ...headers }, body:JSON.stringify(body) });
    assert.equal((await fetch(origin+'/')).status,200);
    assert.equal((await (await fetch(origin+'/')).text()),'<h1>Lecture Ledger test</h1>');
    assert.equal((await get()).revision,0);
    const saved = await put({data,revision:0}); assert.equal(saved.status,200); assert.equal((await saved.json()).revision,1);
    assert.deepEqual((await get()).data,data);
    assert.equal((await put({data,revision:0})).status,409);
    assert.equal((await put({data,revision:1},{Origin:'https://another.example'})).status,403);
    assert.equal((await fetch(origin+'/api/planner',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data,revision:1})})).status,403);
    const rejectedHost = await new Promise((done, reject) => {
      const call = request(origin+'/api/planner', { headers: { Host: 'not-local.example' } }, response => { response.resume(); done(response.statusCode); });
      call.on('error', reject); call.end();
    });
    assert.equal(rejectedHost,403);
    assert.equal((await put({data:{...data,schemaVersion:1},revision:1})).status,409);
    const invalid = structuredClone(data); invalid.lectures[0].courseId='unknown';
    assert.equal((await put({data:invalid,revision:1})).status,400);
    const large = await fetch(origin+'/api/planner',{method:'PUT',headers:{Origin:origin,'Content-Type':'application/json'},body:' '.repeat(2_000_001)}); assert.equal(large.status,413);
    for (const path of ['/.git/config','/data/lecture-ledger.sqlite','/%2e%2e%2fprivate%2fprivate.json','/api/unknown']) assert.equal((await fetch(origin+path)).status,404);
    const backupResponse = await fetch(origin+'/api/backup'); assert.equal(backupResponse.status,200);
    assert.match(backupResponse.headers.get('content-disposition'),/attachment/);
    const backup = await backupResponse.text(); assert.deepEqual(readBackup(backup),data);
    assert.throws(()=>readBackup('{"bad":true}'));
    const second = structuredClone(data); second.courses[0].color='blue';
    const third = structuredClone(data); third.courses[0].color='rose';
    const simultaneous = await Promise.all([put({data:second,revision:1}),put({data:third,revision:1})]);
    assert.deepEqual(simultaneous.map(r=>r.status).sort(),[200,409]);
    const persisted = await get(); assert.equal(persisted.revision,2);
    assert.deepEqual(persisted.data.completed,data.completed);
    await app.close(); app=undefined;
    app = await startLedger({port:0,databasePath,staticDirectory}); origin=app.origin;
    assert.deepEqual(await get(),persisted);
    if(process.platform!=='win32') assert.equal((await stat(databasePath)).mode & 0o777,0o600);
  } finally { await app?.close(); await rm(folder,{recursive:true,force:true}); }
});
test('old hosted backups can be restored to a new local database', async () => {
  const folder=await mkdtemp(join(tmpdir(),'ledger-migrate-'));
  let store;
  try {
    const legacy={format:'lecture-ledger',version:1,data:{term:data.term,lectures:[{id:'old-lecture',title:'Quantum lecture',course:'Quantum computing',day:0,start:'09:00',end:'10:00',location:'Old room',color:'violet'}],completed:{'old-lecture:2026-10-12':'2026-10-13T10:00:00Z'}}};
    const restored=readBackup(JSON.stringify(legacy));
    store=openStore(join(folder,'lecture-ledger.sqlite'));store.save(restored,0);
    assert.equal(store.load().data.courses.length,1);
    assert.deepEqual(store.load().data.completed,legacy.data.completed);
    assert.equal(store.load().data.lectures[0].id,'old-lecture');
  } finally {store?.close();await rm(folder,{recursive:true,force:true});}
});
