import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,rm,stat,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildSite,normalizeBase} from '../scripts/build.mjs';
import {renderReader,resolveReaderBook} from '../lib/reader-page.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(await readFile(new URL('../public/library.json',import.meta.url),'utf8'));

test('Pages base path rejects external origins, escaping and path traversal',()=>{
 assert.equal(normalizeBase(''),'/');assert.equal(normalizeBase('/'),'/');assert.equal(normalizeBase('/reading-bookshelf'),'/reading-bookshelf/');
 for(const bad of ['https://evil.example/','//evil','../outside','/../outside','/a/../b','/a?b','/x" onload="bad','/a#b'])assert.throws(()=>normalizeBase(bad));
});

for(const basePath of ['/','/reading-bookshelf/'])test(`all readers and assets work under ${basePath}`,async t=>{
 await mkdir(path.join(root,'.tmp'),{recursive:true});
 const temp=await mkdtemp(path.join(root,'.tmp','test-'));t.after(()=>rm(temp,{recursive:true,force:true}));
 const out=path.join(temp,'site'),result=await buildSite({basePath,outDir:out});
 assert.equal(result.books,catalog.length);assert.equal(result.records,4307);
 const exported=JSON.parse(await readFile(path.join(out,'library.json'),'utf8'));
 assert.deepEqual(exported,catalog);
 assert.equal(new Set(catalog.map(b=>b.storageKey)).size,catalog.length);assert.equal(new Set(catalog.map(b=>b.cacheKey)).size,catalog.length);
 const pages=['index.html','404.html',...catalog.map(b=>`read/${b.id}/index.html`)];
 for(const page of pages){
  const html=await readFile(path.join(out,page),'utf8');
  assert.ok(html.includes(`<base href="${basePath}">`));
  const base=new URL(basePath,'https://reader.example');
  for(const match of html.matchAll(/(?:src|href)="([^"]+)"/g)){
   const url=new URL(match[1],base);if(url.origin!==base.origin)continue;
   assert.ok(url.pathname.startsWith(basePath),`${page}: ${match[1]} escapes project`);
   let file=path.join(out,url.pathname.slice(basePath.length));
   if((await stat(file)).isDirectory())file=path.join(file,'index.html');
   assert.ok((await stat(file)).isFile(),`${page}: ${match[1]} missing`);
  }
 }
 for(const book of catalog){
  const html=await readFile(path.join(out,'read',book.id,'index.html'),'utf8');
  const config=JSON.parse(html.match(/<script id="reader-config" type="application\/json">(.*?)<\/script>/s)[1]);
  assert.deepEqual(config,book);assert.ok(!config.oldOrigin);
  assert.ok(html.includes(`href="${basePath}read/${book.id}/#reading"`));
  const asset=new URL(config.data,new URL(basePath,'https://reader.example'));
  assert.deepEqual(await readFile(path.join(out,asset.pathname.slice(basePath.length))),await readFile(path.join(root,'public',book.data)));
  const data=JSON.parse(await readFile(path.join(out,asset.pathname.slice(basePath.length)),'utf8'));
  assert.equal(data.records.length,book.count);assert.equal(data.coverage.length,book.chapters);
  assert.ok(data.records.every(r=>r.originals.length&&r.originals.every(o=>o.text&&o.zh)&&r.examples.length));
 }
 const top=await readdir(out);
 for(const forbidden of ['.git','.github','.openai','.env','worker','db','sync.js','migration.js','node_modules','package.json'])assert.ok(!top.includes(forbidden));
 for(const file of ['app.js','shelf.js','local-progress.js','not-found.js']){
  const script=await readFile(path.join(out,file),'utf8');
  assert.ok(!script.includes('/api/progress'));assert.ok(!script.includes('signin-with-chatgpt'));
  assert.ok(!script.includes('href="/"'));assert.ok(!script.includes("fetch('/"));
 }
});

test('legacy book query decodes once and matches only existing books',()=>{
 for(const book of catalog){
  for(const suffix of ['','%20','%20%EF%BC%8C']){
   const query=new URLSearchParams('book='+book.id+suffix);
   assert.equal(resolveReaderBook(catalog,query.get('book')).book.id,book.id);
  }
  assert.equal(resolveReaderBook(catalog,new URLSearchParams('book='+book.id+'%2520').get('book')),null);
 }
 assert.equal(resolveReaderBook(catalog,'missing'),null);
});

test('reader configuration safely embeds book metadata',async()=>{
 const template=await readFile(new URL('../reader.html',import.meta.url),'utf8');
 const html=renderReader(template,{title:'</script><script>bad</script>'});
 assert.ok(!html.includes('<script>bad'));assert.match(html,/\\u003c/);
});
