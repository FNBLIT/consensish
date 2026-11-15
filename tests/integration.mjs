// Run against an isolated, running production server (see README).
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:9001';
function client() { const cookies = new Map(); return async (path, body, expected = 200, extra = {}) => { const r = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : {'content-type':'application/json'}), cookie: [...cookies].map(([k,v])=>`${k}=${v}`).join('; '), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) }); for (const c of r.headers.getSetCookie()) { const [k,...v] = c.split(';')[0].split('='); cookies.set(k,v.join('=')); } const result = await r.json(); assert.equal(r.status,expected,JSON.stringify(result)); return result } }
const owner=client(), participant=client(), outsider=client();
const created=await owner('/api/groups',{name:'Integration collective',description:'An isolated test group',password:'group-pass-123'});
const g=created.group.id; assert.ok(created.adminToken); assert.equal(created.group.passwordHash,undefined);
assert.equal((await outsider(`/api/groups/${g}`)).locked,true);
await outsider(`/api/groups/${g}/unlock`,{password:'wrong-pass'},403);
await participant(`/api/groups/${g}/unlock`,{password:'group-pass-123'});
await participant(`/api/groups/${g}/proposals`,{},403);
await owner(`/api/groups/${g}/proposals`,{},400);
const p=await owner(`/api/groups/${g}/proposals`,{title:'Shared garden tools',description:'Private proposal content',budget:250,type:'Purchase',facilitator:'Sam',password:'decision-pass-123'});
assert.equal(p.passwordHash,undefined); assert.equal((await outsider(`/api/proposals/${p.id}`)).locked,true);
const summary=await participant(`/api/groups/${g}`);assert.equal(summary.proposals[0].description,undefined);
await participant(`/api/proposals/${p.id}/unlock`,{password:'decision-pass-123'});
await participant(`/api/proposals/${p.id}/responses`,{name:'Lee',position:'BLOCK',justification:''},400);
await participant(`/api/proposals/${p.id}/responses`,{name:'Lee',position:'BLOCK',justification:'We need storage.'});
await participant(`/api/proposals/${p.id}/responses`,{name:'Lee',position:'APPROVE',justification:'Storage is covered.'});
await participant(`/api/proposals/${p.id}/responses`,{name:'Lee',position:'COMMENT',justification:'Thanks!'});
let detail=await owner(`/api/proposals/${p.id}`);assert.equal(detail.responses.filter(r=>r.position==='BLOCK').length,0); assert.equal(detail.responses.length,2);
await participant(`/api/proposals/${p.id}/responses`,{name:'Lee',position:'SUGGEST MODIFICATION',justification:'Include storage.',amendment:{title:'Tools and storage',description:'A shared tool kit with a storage plan.'}});
detail=await owner(`/api/proposals/${p.id}`); const modification=detail.responses.find(r=>r.amendment);
await participant(`/api/proposals/${p.id}/amend`,{responseId:modification.id,accept:true},403);
await owner(`/api/proposals/${p.id}/amend`,{responseId:modification.id,accept:true});
detail=await owner(`/api/proposals/${p.id}`); assert.equal(detail.proposal.revision,2); assert.equal(detail.revisions[0].description,'Private proposal content'); assert.equal(detail.responses.filter(r=>r.revision===2).length,0);
await owner(`/api/proposals/${p.id}/amend`,{responseId:modification.id,accept:true},400);
await owner(`/api/proposals/${p.id}/close`,{status:'Agreed',outcome:'Too early'},400);
await participant(`/api/proposals/${p.id}/responses`,{name:'Lee',position:'APPROVE',justification:''});
if (process.env.CONSENSISH_TEST_DB) {
 const db = new DatabaseSync(process.env.CONSENSISH_TEST_DB); const row=db.prepare('SELECT data FROM records WHERE kind=? AND id=?').get('proposal',p.id); const record=JSON.parse(row.data);record.deadline='2020-01-01T00:00:00Z'; db.prepare('UPDATE records SET data=? WHERE kind=? AND id=?').run(JSON.stringify(record),'proposal',p.id); db.close();
 await participant(`/api/proposals/${p.id}/responses`,{name:'Lee',position:'BLOCK',justification:'Too late'},400);
 await owner(`/api/proposals/${p.id}/close`,{status:'Agreed',outcome:'Agreed after the review window.'});
 assert.equal((await participant(`/api/proposals/${p.id}`)).proposal.status,'Agreed');
} else { await owner(`/api/proposals/${p.id}/close`,{status:'Withdrawn',outcome:'Completed integration test.'}); }
await outsider(`/api/groups/${g}/claim`,{token:'wrong-key'},403);
await outsider(`/api/groups/${g}/claim`,{token:created.adminToken});assert.equal((await outsider(`/api/groups/${g}`)).isAdmin,true);
await owner('/api/groups',{name:'bad-origin'},403,{origin:'https://another-site.example'});
for(const path of ['/',`/g/${g}`,`/d/${p.id}`]) { const response=await fetch(base+path); assert.equal(response.status,200);assert.match(await response.text(),/consensish/); }
console.log('Integration passed: passwords, organizer recovery, access boundaries, validation, response updates, revisions, deadline enforcement, outcomes, history, CSRF, and SSR pages.');
