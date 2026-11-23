const readerKeys = ['positionKey','chapter','grade','study','query','view'];
const clone = value => JSON.parse(JSON.stringify(value));
const newer = (a,b) => !b || a.stamp>b.stamp || (a.stamp===b.stamp && a.mutation>b.mutation);
const snapshot = state => ({statuses:{...state.statuses},...Object.fromEntries(readerKeys.map(k=>[k,state[k]??(k==='view'?'single':'')]))});
const browserStorage = () => { try { return globalThis.localStorage; } catch { return null; } };

// Retain existing per-book cache keys, downloaded records and explicit resets.
// This module has no identity or network access.
export class LocalProgress {
  constructor({state,cacheKey,storage=browserStorage(),onApply=()=>{},onStatus=()=>{},now=Date.now,makeId=()=>crypto.randomUUID().replaceAll('-','')}) {
    this.cacheKey=cacheKey;this.storage=storage;this.onApply=onApply;this.onStatus=onStatus;this.now=now;this.makeId=makeId;
    this.entries={};this.clock=0;this.baseline=snapshot(state);
    this.readSaved();
    for(const [key,value] of Object.entries(state.statuses||{})) {
      if(!this.entries['word:'+key]&&['known','review'].includes(value))this.put('word:'+key,value,1);
    }
    if(state.positionKey&&!this.entries.reader)this.put('reader',this.reader(state),1);
    this.apply();this.persist();
  }
  reader(state) { return Object.fromEntries(readerKeys.map(k=>[k,state[k]??(k==='view'?'single':'')])); }
  put(key,value,stamp) { this.entries[key]={key,value:clone(value),stamp,mutation:this.makeId()};this.clock=Math.max(this.clock,stamp); }
  merge(entries) {
    let changed=false;
    for(const e of entries) {
      if(!e||typeof e.key!=='string'||!Number.isSafeInteger(e.stamp)||e.stamp<1||typeof e.mutation!=='string')continue;
      if(e.key==='reader') { if(!e.value||typeof e.value!=='object'||Array.isArray(e.value))continue; }
      else if(!e.key.startsWith('word:')||!['new','known','review'].includes(e.value))continue;
      if(newer(e,this.entries[e.key])){this.entries[e.key]=clone(e);this.clock=Math.max(this.clock,e.stamp);changed=true;}
    }
    return changed;
  }
  readSaved() {
    try { const data=JSON.parse(this.storage?.getItem(this.cacheKey)||'null');if(data?.version===1)return this.merge(Object.values(data.entries||{})); } catch {}
    return false;
  }
  persist() {
    try {
      if(!this.storage)throw new Error('Storage unavailable');
      this.storage.setItem(this.cacheKey,JSON.stringify({version:1,userId:null,entries:this.entries,pending:{},offset:0}));
      this.saved=true;
    } catch { this.saved=false; }
    this.onStatus(this.saved?'saved':'storage');return this.saved;
  }
  apply() {
    const next={...this.baseline,statuses:{}};
    for(const e of Object.values(this.entries))if(e.key.startsWith('word:')&&['known','review'].includes(e.value))next.statuses[e.key.slice(5)]=e.value;
    if(this.entries.reader)Object.assign(next,this.reader(this.entries.reader.value));
    if(JSON.stringify(next)!==JSON.stringify(this.baseline)){this.baseline=next;this.onApply(clone(next));}
  }
  capture(state) {
    const next=snapshot(state),old=this.baseline;
    this.readSaved();
    const tick=()=>this.clock=Math.max(this.now(),this.clock+1);
    for(const key of new Set([...Object.keys(old.statuses),...Object.keys(next.statuses)])) {
      if((old.statuses[key]||'new')!==(next.statuses[key]||'new'))this.put('word:'+key,next.statuses[key]||'new',tick());
    }
    if(readerKeys.some(k=>old[k]!==next[k]))this.put('reader',this.reader(next),tick());
    this.baseline=next;this.apply();this.persist();
  }
  importEntries(entries) { this.readSaved();this.merge(entries);this.apply();return this.persist(); }
  refresh() { this.readSaved();this.apply();return this.persist(); }
  receiveStorage(raw) {
    try { const data=JSON.parse(raw);if(data?.version===1&&this.merge(Object.values(data.entries||{}))){this.apply();this.persist();} } catch {}
  }
  attachEvents() {
    const focus=()=>this.refresh(),storage=e=>{if(e.key===this.cacheKey&&e.newValue)this.receiveStorage(e.newValue);};
    window.addEventListener('focus',focus);window.addEventListener('pageshow',focus);window.addEventListener('storage',storage);
    return ()=>{window.removeEventListener('focus',focus);window.removeEventListener('pageshow',focus);window.removeEventListener('storage',storage);};
  }
}
