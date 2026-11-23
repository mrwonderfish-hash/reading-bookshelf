import {resolveReaderBook} from './book-links.js';
try {
 const base=new URL(document.baseURI),url=new URL(location.href);
 if(url.pathname.startsWith(base.pathname)){
  const relative=url.pathname.slice(base.pathname.length);
  const match=relative.match(/^read\/([^/]+)\/?$/);
  if(match){
   const response=await fetch(new URL('library.json',base));
   if(response.ok){
    const result=resolveReaderBook(await response.json(),decodeURIComponent(match[1]));
    if(result)location.replace(new URL(`read/${encodeURIComponent(result.book.id)}/`,base).href);
   }
  }
 }
}catch{}
