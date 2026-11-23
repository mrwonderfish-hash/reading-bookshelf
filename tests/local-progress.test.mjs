import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalProgress} from '../public/local-progress.js';

const empty=()=>({statuses:{},positionKey:'',chapter:'',grade:'',study:'',query:'',view:'single'});
const memory=()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
const entry=(key,value,stamp=10)=>({key,value,stamp,mutation:'mutation0001'});
const make=(storage=memory(),cacheKey='book-a',state=empty())=>new LocalProgress({state,storage,cacheKey,now:()=>100,makeId:()=> 'mutation0002'});

test('local lifecycle never contacts the network and survives reload',t=>{
 const network=t.mock.method(globalThis,'fetch',()=>{throw new Error('Unexpected network');});
 const storage=memory(),a=make(storage);
 const state={...empty(),statuses:{alpha:'known'},positionKey:'beta',chapter:'Chapter 2',query:'forest',grade:'C1 参考'};
 a.capture(state);a.refresh();a.receiveStorage(storage.getItem('book-a'));
 const b=make(storage);assert.deepEqual(b.baseline,state);assert.equal(network.mock.callCount(),0);
});
test('downloaded private records and pending edits survive without retaining identity',()=>{
 const storage=memory();storage.setItem('book-a',JSON.stringify({version:1,userId:'old-owner',entries:{'word:alpha':entry('word:alpha','new'),'word:beta':entry('word:beta','review')},pending:{'word:beta':entry('word:beta','review')}}));
 const a=make(storage,'book-a',{...empty(),statuses:{alpha:'known',gamma:'known'}});
 assert.deepEqual(a.baseline.statuses,{beta:'review',gamma:'known'});
 const saved=JSON.parse(storage.getItem('book-a'));assert.equal(saved.userId,null);assert.deepEqual(saved.pending,{});
});
test('word resets survive reopen and stale one-time imports',()=>{
 const storage=memory(),a=make(storage);a.capture({...empty(),statuses:{alpha:'known'}});a.capture(empty());
 const b=make(storage);b.importEntries([entry('word:alpha','known',1),entry('word:beta','review',1)]);
 assert.deepEqual(b.baseline.statuses,{beta:'review'});assert.equal(b.entries['word:alpha'].value,'new');
});
test('books and browsers retain separate progress',()=>{
 const storage=memory(),a=make(storage,'book-a'),b=make(storage,'book-b');
 a.capture({...empty(),statuses:{alpha:'known'},positionKey:'alpha'});b.refresh();
 assert.deepEqual(b.baseline,empty());assert.deepEqual(make(memory(),'book-a').baseline,empty());
});
test('two tabs merge distinct edits without losing stored updates',()=>{
 const storage=memory(),a=make(storage),b=make(storage);
 a.capture({...empty(),statuses:{alpha:'known'}});b.capture({...empty(),statuses:{beta:'review'}});
 a.receiveStorage(storage.getItem('book-a'));
 assert.deepEqual(a.baseline.statuses,{alpha:'known',beta:'review'});
});
test('storage failure is reported and does not prevent reading or in-memory edits',()=>{
 const statuses=[],storage={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('quota');}};
 const a=new LocalProgress({state:empty(),cacheKey:'a',storage,onStatus:s=>statuses.push(s)});
 a.capture({...empty(),statuses:{alpha:'known'}});assert.equal(a.saved,false);assert.deepEqual(a.baseline.statuses,{alpha:'known'});
 assert.ok(statuses.every(s=>s==='storage'));
});
