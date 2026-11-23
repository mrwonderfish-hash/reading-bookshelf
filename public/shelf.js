import {LocalProgress} from './local-progress.js';
import {resolveReaderBook} from './book-links.js';
const $=id=>document.getElementById(id),clients=new Map(),progressStates=new Map();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const href=b=>`./read/${encodeURIComponent(b.id)}/`;
const empty=()=>({statuses:{},positionKey:'',chapter:'',grade:'',study:'',query:'',view:'single',fontSize:19,translations:true});
let books=[];
function reportStatus(){
 const values=[...progressStates.values()],all=values.length===books.length;
 $('shelf-status').textContent=values.includes('storage')?'当前浏览器无法保存 · 请导出备份':all?'进度保存在当前浏览器 · 不跨设备同步':'正在读取本机记录…';
}
function updateBook(b,state){
 const values=Object.values(state.statuses||{}),known=values.filter(x=>x==='known').length,review=values.filter(x=>x==='review').length;
 $('summary-'+b.id).textContent=`已掌握 ${known} · 待复习 ${review}`;
 $('meter-'+b.id).style.width=Math.min(100,known/b.count*100)+'%';
 $('resume-'+b.id).textContent=state.positionKey?'上次读到 · '+state.positionKey:'从第一个词开始';
 $('read-'+b.id).textContent=state.positionKey?'继续阅读':'打开词表';
}
function mountBook(b,i){
 return `<article class="shelf-book" style="--book-color:${esc(b.color)};--book-light:${esc(b.light)}"><a class="book-cover" href="${href(b)}" aria-label="打开${esc(b.title)}词表"><p class="cover-number">${String(i+1).padStart(2,'0')}<span>READING NOTES</span></p><h3>${esc(b.title)}</h3><p class="book-english">${esc(b.english)}</p><p class="book-author">${esc(b.author)}</p></a><div class="book-details"><p class="book-tag">${esc(b.tag)}</p><p class="book-stats">${b.count.toLocaleString()} 个词与表达 · ${b.chapters} 个章节／部分</p><p class="study-summary" id="summary-${b.id}">正在读取进度…</p><div class="book-meter" aria-hidden="true"><span id="meter-${b.id}"></span></div><p class="resume-word" id="resume-${b.id}"></p><a class="read-book" id="read-${b.id}" href="${href(b)}">打开词表</a></div></article>`;
}
async function start(){
 try {
  const response=await fetch('./library.json',{cache:'no-cache'});if(!response.ok)throw new Error();books=await response.json();
  const query=new URLSearchParams(location.search);
  if(query.has('book')){
   const result=resolveReaderBook(books,query.get('book'));
   if(!result){$('books').innerHTML='<p>没有找到这本词表。<a href="./">返回书架</a></p>';$('shelf-status').textContent='请从书架选择一本书';return;}
   location.replace(new URL(href(result.book),document.baseURI).href);return;
  }
  $('book-count').textContent=books.length+' 本';$('total-count').textContent=books.reduce((n,b)=>n+b.count,0).toLocaleString()+' 个词与表达';
  $('books').innerHTML=books.map(mountBook).join('');
  $('quick-books').innerHTML=books.map(b=>`<a href="${href(b)}">${esc(b.title)}<span>${b.count.toLocaleString()} 词</span></a>`).join('');
  for(const b of books){
   let state=empty();try{state={...state,...JSON.parse(localStorage.getItem(b.storageKey)||'{}')};}catch{}
   const progress=new LocalProgress({state,cacheKey:b.cacheKey,onApply:incoming=>{state={...state,...incoming};updateBook(b,state);try{localStorage.setItem(b.storageKey,JSON.stringify(state));}catch{}},onStatus:value=>{progressStates.set(b.id,value);reportStatus();}});
   clients.set(b.id,progress);updateBook(b,progress.baseline);progress.attachEvents();progress.refresh();
  }
  $('refresh-progress').addEventListener('click',()=>clients.forEach(c=>c.refresh()));
 }catch{$('books').innerHTML='<p>书架暂时未载入，请刷新页面重试。</p>';$('shelf-status').textContent='载入失败';$('refresh-progress').onclick=()=>location.reload();}
}
start();
