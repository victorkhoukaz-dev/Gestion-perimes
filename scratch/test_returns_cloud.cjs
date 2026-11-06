const {test}=require('node:test');
const assert=require('node:assert/strict');
global.window={CompanyReturnsData:require('../App/company-returns-data.js')};
const C=require('../App/company-returns-cloud.js');
const empty=()=>({version:1,activeId:null,reports:[]});
const clone=x=>JSON.parse(JSON.stringify(x));
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
function server(){
 const rows=new Map(); let fail=false,gate=null;
 return {rows,set fail(v){fail=v;},set gate(v){gate=v;},client:{from(table){assert.equal(table,'company_return_documents');let op='read',payload,filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},insert(v){op='insert';payload=clone(v);return q;},update(v){op='update';payload=clone(v);return q;},async maybeSingle(){if(gate)await gate;if(fail)return {error:{message:'Network failed'}};const id=filters.pharmacy_id||payload?.pharmacy_id;const old=rows.get(id);if(op==='read')return {data:old?clone(old):null};if(op==='insert'&&old)return {error:{code:'23505',message:'Duplicate'}};if(op==='update'&&old?.revision!==filters.revision)return {data:null};rows.set(id,clone(payload));return {data:{revision:payload.revision}};}};return q;}}};
}
test('save, reopen on another device, and pharmacy filters',async()=>{
 const db=server(),a=C.create(db.client,'p1','u1',storage());await a.load();const value=empty();value.importedLocal=['fingerprint'];a.stage(value);await a.save(value);
 const b=C.create(db.client,'p1','u2',storage());assert.deepEqual((await b.load()).value,value);assert.equal(b.isDirty(),false);
 assert.equal((await C.create(db.client,'p2','u3',storage()).load()).value.reports.length,0);assert.equal(db.rows.has('p2'),false);
});
test('two devices cannot overwrite a newer collection; local recovery survives conflict',async()=>{
 const db=server(),sa=storage(),sb=storage(),a=C.create(db.client,'p','a',sa),b=C.create(db.client,'p','b',sb);await a.load();await b.load();const x=empty();a.stage(x);await a.save(x);const y={...empty(),importedLocal:['local']};b.stage(y);await assert.rejects(b.save(y));assert.equal(b.isDirty(),true);
 const reopened=C.create(db.client,'p','b',sb),loaded=await reopened.load();assert.equal(loaded.conflict,true);assert.deepEqual(loaded.value,y);await assert.rejects(reopened.save(y),/récente/);reopened.stage({...y,importedLocal:['edited after conflict']});const again=C.create(db.client,'p','b',sb);assert.equal((await again.load()).conflict,true);await assert.rejects(again.save(y),/récente/);await reopened.load(true);assert.equal(reopened.isDirty(),false);assert.deepEqual(db.rows.get('p').data,x);
});
test('network failure preserves recovery; newer typing during save remains dirty',async()=>{
 const db=server(),s=storage(),a=C.create(db.client,'p','u',s);await a.load();const x=empty();a.stage(x);db.fail=true;await assert.rejects(a.save(x));assert.equal(a.isDirty(),true);db.fail=false;
 let release;db.gate=new Promise(resolve=>release=resolve);const saving=a.save(x);const y={...empty(),importedLocal:['new typing']};a.stage(y);release();assert.equal((await saving).dirty,true);db.gate=null;await a.save(y);assert.equal(a.isDirty(),false);assert.deepEqual(db.rows.get('p').data,y);
});
test('stale local tabs cannot replace recovery; empty report collection can be saved',async()=>{
 const db=server(),s=storage(),a=C.create(db.client,'p','u',s);await a.load();const b=C.create(db.client,'p','u',s);await b.load();a.stage({...empty(),importedLocal:['edit']});assert.throws(()=>b.stage(empty()),/autre onglet/);await a.save(empty());assert.equal(db.rows.get('p').data.reports.length,0);
});
