import {cp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {renderReader} from '../lib/reader-page.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export function normalizeBase(value=''){
 const base=String(value).trim();
 if(base===''||base==='/')return '/';
 if(!/^\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*\/?$/.test(base)||base.split('/').some(s=>s==='.'||s==='..'))throw new Error('Invalid Pages base path');
 return base.replace(/\/$/,'')+'/';
}
export async function buildSite({basePath='',outDir=path.join(root,'dist')}={}){
 const base=normalizeBase(basePath),out=path.resolve(outDir);
 if(out!==path.join(root,'dist')&&!out.startsWith(path.join(root,'.tmp')+path.sep))throw new Error('Build output must be dist or a project .tmp directory');
 const books=JSON.parse(await readFile(path.join(root,'public/library.json'),'utf8'));
 const seen=new Set();
 for(const b of books){
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.id)||seen.has(b.id))throw new Error('Invalid/duplicate book ID');seen.add(b.id);
  if(b.data!==`./books/${b.id}.json`)throw new Error('Book data path must stay inside the site');
  const data=JSON.parse(await readFile(path.join(root,'public',b.data),'utf8'));
  if(data.records.length!==b.count||new Set(data.records.map(r=>r.key)).size!==b.count)throw new Error('Invalid record count or keys: '+b.id);
  if(data.coverage.length!==b.chapters||!data.records.every(r=>r.originals.length&&r.originals.every(o=>o.text&&o.zh)))throw new Error('Missing source translations or coverage: '+b.id);
 }
 await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 // Only public assets and reviewed vocabulary are included; no server, auth,
 // environment, original EPUB or personal progress is part of the artifact.
 for(const file of ['app.js','local-progress.js','shelf.js','not-found.js','style.css','shelf.css','icon.svg','favicon.svg','library.json','books'])await cp(path.join(root,'public',file),path.join(out,file),{recursive:true});
 await cp(path.join(root,'lib/reader-page.mjs'),path.join(out,'book-links.js'));
 const withBase=(html,pagePath='')=>html.replace('<!-- SITE_BASE -->',`<base href="${base}">`).replace(/href="#([^"]+)"/g,`href="${base}${pagePath}#$1"`);
 await writeFile(path.join(out,'index.html'),withBase(await readFile(path.join(root,'shelf.html'),'utf8')));
 const reader=await readFile(path.join(root,'reader.html'),'utf8');
 for(const book of books){
  const directory=path.join(out,'read',book.id);await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,'index.html'),withBase(renderReader(reader,book),`read/${book.id}/`));
 }
 await writeFile(path.join(out,'404.html'),`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><base href="${base}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>没有找到词表</title><link rel="stylesheet" href="./style.css"><script type="module" src="./not-found.js"></script></head><body><main class="empty"><h1>没有找到这本词表</h1><p>请从书架重新选择。</p><a href="./">返回书架</a></main></body></html>`);
 await writeFile(path.join(out,'.nojekyll'),'');
 return {basePath:base,outDir:out,books:books.length,records:books.reduce((n,b)=>n+b.count,0)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 console.log(JSON.stringify(await buildSite({basePath:process.env.PAGES_BASE_PATH||''}),null,2));
}
