import { LocalProgress } from './local-progress.js';
const $ = id => document.getElementById(id);
let config, STORAGE_KEY;
const statuses = { new: '待学', review: '待复习', known: '已掌握' };
const defaults = { statuses: {}, fontSize: 19, translations: true, view: 'single', chapter: '', grade: '', study: '', query: '', positionKey: '' };
let state = { ...defaults, statuses: {} }, book, records = [], results = [], searchIndex = [], position = 0, listLimit = 20, toastTimer, searchTimer, storageWorks = true;
let progress, applyingProgress=false, listScrollTimer;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const reEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function notify(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3200); }
function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { if (storageWorks) notify('当前浏览器无法保存记录，请先导出备份'); storageWorks = false; } if(progress&&!applyingProgress)progress.capture(state); }
function load() { try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); if (saved && typeof saved === 'object') state = sanitize(saved); } catch { storageWorks = false; } }
function sanitize(raw) {
  const keys = new Set(records.map(r => r.key));
  const validStatuses = {};
  if (raw.statuses && typeof raw.statuses === 'object') for (const [key, value] of Object.entries(raw.statuses)) if (keys.has(key) && ['review','known'].includes(value)) validStatuses[key] = value;
  return { statuses: validStatuses, fontSize: [17,19,21].includes(Number(raw.fontSize)) ? Number(raw.fontSize) : 19, translations: raw.translations !== false, view: raw.view === 'list' ? 'list' : 'single', chapter: book.coverage.some(x => x.chapter === raw.chapter) ? raw.chapter : '', grade: Object.hasOwn(book.meta.gradeCounts, raw.grade) ? raw.grade : '', study: Object.hasOwn(statuses, raw.study) ? raw.study : '', query: typeof raw.query === 'string' ? raw.query.slice(0,300) : '', positionKey: keys.has(raw.positionKey) ? raw.positionKey : '' };
}
function applyPreferences() {
  document.documentElement.style.setProperty('--body', state.fontSize + 'px');
  document.body.classList.toggle('no-translations', !state.translations);
  $('font-size').value = String(state.fontSize); $('translations').checked = state.translations;
  $('search').value = state.query;
  $('view-single').setAttribute('aria-pressed', String(state.view === 'single'));
  $('view-list').setAttribute('aria-pressed', String(state.view === 'list'));
}
function wordStatus(r) { return state.statuses[r.key] || 'new'; }
function matchWords(r, text) {
  const words = [...new Set([r.key, ...r.word.split(/\s*\/\s*/), ...r.forms.split(',').map(x => x.trim())].filter(x => x && x.length > 1))].sort((a,b) => b.length-a.length);
  const pattern = new RegExp('(?<![A-Za-z])(?:' + words.map(reEscape).join('|') + ')(?![A-Za-z])', 'gi');
  let last = 0, html = '';
  for (const m of text.matchAll(pattern)) { html += esc(text.slice(last,m.index)) + '<mark>' + esc(m[0]) + '</mark>'; last = m.index + m[0].length; }
  return html + esc(text.slice(last));
}
function exampleMarkup(r, e, i) { return `<div class="example"><p class="example-en">${i + 1}. ${matchWords(r,e.en)}</p><p class="example-zh">${esc(e.zh)}</p></div>`; }
function originalTranslationMarkup(r,o,i) {
  const id=`original-zh-${r.id}-${i}`,long=o.zh.length>180;
  return `<div class="original-translation"><p class="translation-label">${esc(o.zhLabel || (o.zhKind === "supplement" ? "补译" : `中文版对应句段 · ${config.translator}译`))}</p><p class="quote-zh ${long?'clamped':''}" id="${id}">${esc(o.zh)}</p>${long?`<button class="expand-text" data-quote="${id}" data-label="中译" aria-expanded="false" aria-controls="${id}">展开完整中译</button>`:''}</div>`;
}
function cardMarkup(r) {
  const quoteMarkup = r.originals.map((o,i) => `<div class="quote-block"><blockquote class="quote ${o.text.length > 420 ? 'clamped' : ''}" id="quote-${r.id}-${i}">${matchWords(r,o.text)}</blockquote>${o.text.length > 420 ? `<button class="expand-text" data-quote="quote-${r.id}-${i}" aria-expanded="false" aria-controls="quote-${r.id}-${i}">展开完整原文</button>` : ''}${originalTranslationMarkup(r,o,i)}<p class="source">${esc(o.location)}${o.note ? ' · ' + esc(o.note) : ''}</p></div>`).join('');
  const examples = r.examples.slice(0,2).map((e,i) => exampleMarkup(r,e,i)).join('');
  const more = r.examples.length > 2 ? `<details class="more-examples"><summary>再看 ${r.examples.length - 2} 个不同语境的例句</summary>${r.examples.slice(2).map((e,i) => exampleMarkup(r,e,i+2)).join('')}</details>` : '';
  const buttons = Object.entries(statuses).map(([value,label]) => `<button class="status-button" data-status="${value}" data-key="${esc(r.key)}" aria-pressed="${wordStatus(r)===value}">${value==='known'?'✓ ':value==='review'?'↻ ':''}${label}</button>`).join('');
  return `<article class="word-card" data-record="${r.id}" aria-labelledby="word-${r.id}"><div class="word-topline"><span class="word-number">WORD ${String(r.id).padStart(4,'0')}</span><span class="badge ${r.grade==='C1 参考'?'c1':r.grade==='C2 参考'?'c2':''}">${esc(r.grade)}</span></div><h2 class="word" id="word-${r.id}">${esc(r.word)}</h2><p class="chapter">首次出现 · ${esc(r.firstChapter)}</p><p class="meaning">${esc(r.meaning)}</p><div class="usage">${esc(r.usage)}</div><div class="section-label">原文语境</div>${quoteMarkup}<div class="section-label">自编例句 · 换个语境理解</div>${examples}${more}<details class="word-notes"><summary>词形、级别与校对说明</summary><p>原书词形：${esc(r.forms)}</p><p>${esc(r.gradeSource)}</p>${r.note ? `<p>${esc(r.note)}</p>` : ''}</details><div class="status-group" role="group" aria-label="${esc(r.word)} 的学习状态">${buttons}</div></article>`;
}
function resultLabel() { return `${results.length.toLocaleString()} 个词${state.query || state.chapter || state.grade || state.study ? '符合条件' : '与表达'}`; }
function updateFilterChips() {
  const filters = [['chapter',state.chapter],['grade',state.grade],['study',statuses[state.study]]].filter(([,v])=>v);
  $('filter-badge').hidden = filters.length === 0; $('filter-badge').textContent = filters.length;
  $('active-filters').hidden = filters.length === 0;
  $('active-filters').innerHTML = filters.map(([key,v]) => `<button class="filter-chip" data-clear="${key}" aria-label="取消筛选：${esc(v)}"><span>${esc(v)}</span><b aria-hidden="true">×</b></button>`).join('');
}
function render() {
  $('result-count').textContent = resultLabel(); updateFilterChips();
  $('reader-nav').hidden = state.view !== 'single' || !results.length;
  $('list-footer').hidden = state.view !== 'list' || results.length <= listLimit;
  if (!results.length) {
    $('reading').innerHTML = '<div class="empty"><h2>暂时没有匹配的词</h2><p>试试缩短搜索词，或清除筛选条件。</p><button class="secondary" id="clear-all">查看全部词条</button></div>';
    save();
    return;
  }
  position = Math.max(0,Math.min(position,results.length-1));
  if (state.view === 'single') {
    $('reading').innerHTML = cardMarkup(results[position]);
    state.positionKey = results[position].key;
    $('position-number').textContent = position + 1; $('position-total').textContent = '／ ' + results.length;
    $('previous').disabled = position === 0; $('next').disabled = position === results.length-1;
    $('progress-bar').style.width = ((position+1)/results.length*100)+'%';
  } else $('reading').innerHTML = results.slice(0,listLimit).map(cardMarkup).join('');
  save();
}
function filter({ retainPosition = false } = {}) {
  const q = state.query.trim().toLowerCase();
  results = records.filter((r,i) => (!q || searchIndex[i].includes(q)) && (!state.chapter || r.firstChapter===state.chapter) && (!state.grade || r.grade===state.grade) && (!state.study || wordStatus(r)===state.study));
  if(q){const rank=r=>r.key.toLowerCase()===q||r.word.toLowerCase()===q?4:r.word.toLowerCase().startsWith(q)?3:r.word.toLowerCase().includes(q)?2:r.meaning.includes(q)?1:0;results.sort((a,b)=>rank(b)-rank(a)||a.id-b.id);}
  const savedPosition = retainPosition ? results.findIndex(r => r.key===state.positionKey) : -1;
  position = Math.max(0,savedPosition); listLimit = Math.max(20,Math.ceil((position+1)/20)*20);
  render();
}
function scrollToReading() { window.scrollTo({ top: Math.max(0,$('reading').getBoundingClientRect().top + window.scrollY - 12), behavior: 'auto' }); }
function move(by) { position = Math.max(0,Math.min(position+by,results.length-1)); render(); scrollToReading(); }
function clearAll() { state.query = state.chapter = state.grade = state.study = ''; $('search').value=''; filter(); }
function openDialog(id) { const el=$(id); if (!el.open) el.showModal(); }
function summary() {
  const known = Object.values(state.statuses).filter(x=>x==='known').length, review=Object.values(state.statuses).filter(x=>x==='review').length;
  $('learning-summary').textContent = `已掌握 ${known} · 待复习 ${review} · 待学 ${records.length-known-review}`;
}
function setStatus(key,status) {
  if (status==='new') delete state.statuses[key]; else state.statuses[key]=status;
  save();
  if (state.study && state.study!==status) {
    const nextPosition=position;
    results=results.filter(r=>wordStatus(r)===state.study); position=Math.min(nextPosition,Math.max(0,results.length-1)); render();
    notify(`已标为${statuses[status]}，已从当前筛选中移出`);
  } else {
    document.querySelectorAll('[data-status]').forEach(button=> { if(button.dataset.key===key) button.setAttribute('aria-pressed',String(button.dataset.status===status)); });
    notify(`已标为${statuses[status]}`);
  }
}
function bindEvents() {
  $('refresh-local').addEventListener('click',()=>progress?.refresh());
  window.addEventListener('scroll',()=>{
    if(state.view!=='list'||applyingProgress)return;
    clearTimeout(listScrollTimer);listScrollTimer=setTimeout(()=>{
      const cards=[...document.querySelectorAll('.word-card')],card=cards.find(c=>c.getBoundingClientRect().bottom>100);
      const record=card&&records.find(r=>String(r.id)===card.dataset.record);
      if(record&&state.positionKey!==record.key){state.positionKey=record.key;save();}
    },250);
  },{passive:true});
  $('search').addEventListener('input',()=> { clearTimeout(searchTimer); searchTimer=setTimeout(()=> { state.query=$('search').value; filter(); },180); });
  $('filters-open').addEventListener('click',()=> { $('chapter').value=state.chapter; $('grade').value=state.grade; $('study-state').value=state.study; openDialog('filters-dialog'); });
  $('filters-form').addEventListener('submit',()=> { state.chapter=$('chapter').value; state.grade=$('grade').value; state.study=$('study-state').value; filter(); window.scrollTo({top:0}); });
  $('reset-filters').addEventListener('click',()=> { $('chapter').value=$('grade').value=$('study-state').value=''; });
  $('settings-open').addEventListener('click',()=> { summary(); openDialog('settings-dialog'); });
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=> { if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();} }));
  $('font-size').addEventListener('change',()=> { state.fontSize=Number($('font-size').value); applyPreferences(); save(); });
  $('translations').addEventListener('change',()=> { state.translations=$('translations').checked; applyPreferences(); save(); });
  $('previous').addEventListener('click',()=>move(-1)); $('next').addEventListener('click',()=>move(1));
  $('jump-open').addEventListener('click',()=> { $('jump-number').max=String(results.length); $('jump-number').value=String(position+1); openDialog('jump-dialog'); });
  $('jump-form').addEventListener('submit',()=> { position=Number($('jump-number').value)-1; render(); scrollToReading(); });
  for(const view of ['single','list']) $('view-'+view).addEventListener('click',()=> { state.view=view; applyPreferences(); render(); });
  $('load-more').addEventListener('click',()=> { listLimit+=20; render(); });
  $('active-filters').addEventListener('click',e=> { const b=e.target.closest('[data-clear]'); if(b){state[b.dataset.clear]='';filter();} });
  $('reading').addEventListener('click',e=> {
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.quote){ const expanded=b.getAttribute('aria-expanded')==='true',label=b.dataset.label||'原文'; $(b.dataset.quote).classList.toggle('clamped',expanded); b.setAttribute('aria-expanded',String(!expanded)); b.textContent=expanded?'展开完整'+label:'收起'+label; }
    if(b.dataset.status) setStatus(b.dataset.key,b.dataset.status);
    if(b.id==='clear-all') clearAll();
  });
  document.addEventListener('keydown',e=> { if(document.querySelector('dialog[open]')||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)||state.view!=='single'||!results.length)return;if(e.key==='ArrowRight'){e.preventDefault();move(1);}if(e.key==='ArrowLeft'){e.preventDefault();move(-1);} });
  $('export-progress').addEventListener('click',()=> {
    const payload=JSON.stringify({book:config.exportBook,version:1,exportedAt:new Date().toISOString(),state},null,2);
    const url=URL.createObjectURL(new Blob([payload],{type:'application/json'})),a=document.createElement('a'); a.href=url;a.download=config.english.replaceAll(' ','_')+'_学习记录.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('已导出学习记录');
  });
  $('import-progress').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async()=> {
    const file=$('import-file').files[0]; if(!file)return;
    try { if(file.size>1_000_000)throw new Error('文件过大');const raw=JSON.parse(await file.text());if(raw.book!==config.exportBook||raw.version!==1||!raw.state)throw new Error('不是本词表导出的记录');const incoming=sanitize(raw.state);state={...incoming,statuses:{...state.statuses,...incoming.statuses}};applyPreferences();filter({retainPosition:true});summary();notify('已导入并合并学习记录'); }
    catch(e){notify('导入失败：'+e.message);}finally{$('import-file').value='';}
  });
}
async function start() {
 try {
  config=JSON.parse($('reader-config')?.textContent||'null');
  if(!config?.id||!config.storageKey||!config.data)throw new Error('缺少书籍信息');
  STORAGE_KEY=config.storageKey;
  document.title=config.title+' · 来点sci-fi novel';
  document.querySelector('.book-name').textContent=config.english.toUpperCase();
  document.querySelector('h1').replaceChildren(document.createTextNode(config.title+' · 词表'),Object.assign(document.createElement('span'),{textContent:config.author}));
  document.documentElement.style.setProperty('--green',config.color);
  document.documentElement.style.setProperty('--green-light',config.light);
  document.querySelector('.loading .small').textContent='正在载入 '+config.count.toLocaleString()+' 个词和表达';
  $('book-description').textContent=`收录 ${config.count.toLocaleString()} 个词和表达，按原书首次出现顺序排列。保留原文语境、中文释义、常见用法和自编例句。`;
  $('translation-description').textContent=`英文原句来自你提供的 EPUB；中文摘录自${config.translator}译《${config.title}》，保留原译，缺漏处单独标注“补译”。中英文拆句与详略可能不同；词条释义按正常英文及书中语境解释。`;
  $('scope-description').textContent=config.id==='parable-sower'?'本词表仅含《播种者寓言》，不含合订本中的《天赋寓言》。':config.id==='autobiography-red'?'本词表仅含《红的自传》，不含中文合订本中的《丈夫之美》。':'';
    const inline=document.getElementById('book-data'); if(inline){book=JSON.parse(inline.textContent);}else{const response=await fetch(config.data);if(!response.ok)throw new Error('词表载入失败');book=await response.json();} records=book.records;
    searchIndex=records.map(r=>[r.word,r.forms,r.meaning,r.usage,...r.originals.flatMap(x=>[x.text,x.zh]),...r.examples.flatMap(x=>[x.en,x.zh])].join(' ').toLowerCase());
    for(const x of book.coverage){const o=document.createElement('option');o.value=x.chapter;o.textContent=x.chapter+' · '+x.entries;$('chapter').append(o);}
    for(const [grade,n] of Object.entries(book.meta.gradeCounts)){const o=document.createElement('option');o.value=grade;o.textContent=grade+' · '+n;$('grade').append(o);}
    $('source-links').innerHTML='<ul>'+book.sources.filter(s=>s.url).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a></li>`).join('')+'</ul>';
    load();
    applyPreferences();bindEvents();filter({retainPosition:true});
    progress=new LocalProgress({state,cacheKey:config.cacheKey,onApply:incoming=>{
      applyingProgress=true;state=sanitize({...state,...incoming});applyPreferences();filter({retainPosition:true});summary();
      if(state.view==='list'&&state.positionKey){const r=records.find(x=>x.key===state.positionKey);document.querySelector(`[data-record="${r?.id}"]`)?.scrollIntoView({block:'start'});}
      applyingProgress=false;
    },onStatus:status=>{
      const labels={saved:'已保存到当前浏览器',storage:'当前浏览器无法保存 · 请导出备份'};
      $('local-status').textContent=labels[status]||status;$('local-status').dataset.state=status;
    }});
    progress.attachEvents();progress.refresh();
  } catch(e){$('reading').innerHTML='<div class="empty"><h2>词表暂时没有载入</h2><p>请确认网络连接后重试，或<a href="./">返回书架</a>重新选择。</p><button class="secondary" id="retry">重新载入</button></div>';$('result-count').textContent='载入失败';$('reader-nav').hidden=true;$('retry').addEventListener('click',()=>location.reload());}
}
start();
