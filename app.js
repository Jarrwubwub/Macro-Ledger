(()=>{
const $=id=>document.getElementById(id), today=()=>new Date().toLocaleDateString('en-CA');
const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
const isGramUnit=unit=>['g','gram','grams'].includes(String(unit||'').trim().toLowerCase());
function migrateFoods(list){
  const out=[], seen=new Map();
  for(const original of list){
    const f={...original};
    const originalName=f.name||'Food';
    let name=originalName.replace(/\s*[–-]\s*\d+(?:\.\d+)?\s*(?:g|mL)\s*$/i,'').trim();
    name=name.replace(/^raw\s+/i,'').replace(/\s*[–-]\s*raw$/i,'').trim();
    if(/^Eggs?\s*(?:×|x)\s*\d+$/i.test(name))name='Egg';
    if(name==='Egg'){f.unit='egg';f.baseQty=Number(original.baseQty)||1;}
    if(name==='Half avocado'){name='Avocado';f.unit='avocado';f.baseQty=1;f.kcal*=2;f.protein*=2;f.carbs*=2;f.fat*=2;}
    const unit=f.unit||'serve';
    const canonicalUnit=isGramUnit(unit)?'g':unit;
    f.unit=canonicalUnit;
    const target=(isGramUnit(unit)||unit==='mL')?100:f.baseQty||1;
    const key=name.toLowerCase()+'|'+canonicalUnit.toLowerCase();
    if(seen.has(key))continue;
    const factor=target/(Number(f.baseQty)||1);
    f.name=titleCase(name);f.baseQty=target;f.kcal*=factor;f.protein*=factor;f.carbs*=factor;f.fat*=factor;
    f.id=f.id||`food-${out.length}-${Date.now()}`;
    seen.set(key,true);out.push(f);
  }
  return out;
}
const storedFoods=load('macroFoods',null);
let foods=migrateFoods(storedFoods??window.DEFAULT_FOODS);
// One-time, additive Coles library seed. Existing foods and diary entries are preserved.
const COLES_SEED_KEY='macroColesLibrarySeedV1';
if(!localStorage.getItem(COLES_SEED_KEY)){
 const existing=new Set(foods.map(f=>String(f.name||'').trim().toLocaleLowerCase()));
 const additions=(window.COLES_FOODS||[]).filter(f=>!existing.has(String(f.name||'').trim().toLocaleLowerCase()));
 foods=migrateFoods([...foods,...additions]);
 localStorage.setItem(COLES_SEED_KEY,'1');
}
foods=foods.map(f=>{
 if(f.unit!=='mL') return f;
 const density=f.name==='Milk'?1.03:f.name==='Cream'?.99:1;
 const factor=1/density;
 return {...f,baseQty:100,unit:'g',kcal:f.kcal*factor,protein:f.protein*factor,carbs:f.carbs*factor,fat:f.fat*factor,
 basis:((f.basis||'')+` Liquid converted to grams using approx. density ${density} g/mL.`).trim()};
});
let categories=load('macroCategories',[]);
let logs=load('macroLogs',{});
let weightLogs=load('macroWeightLogs',[]);
if(!Array.isArray(weightLogs))weightLogs=[];
let weightTarget=load('macroWeightTarget',null);
// Editable daily nutrition targets. Keep the existing calorie/protein defaults; carbs and fat are optional.
let macroTargets=load('macroTargets',{kcal:2100,protein:200,carbs:null,fat:null});
if(!macroTargets||typeof macroTargets!=='object')macroTargets={kcal:2100,protein:200,carbs:null,fat:null};
macroTargets={kcal:validTarget(macroTargets.kcal)?Number(macroTargets.kcal):2100,protein:validTarget(macroTargets.protein)?Number(macroTargets.protein):200,carbs:validTarget(macroTargets.carbs)?Number(macroTargets.carbs):null,fat:validTarget(macroTargets.fat)?Number(macroTargets.fat):null};
localStorage.setItem('macroTargets',JSON.stringify(macroTargets));
let weightChartRange='30';
let currentDate=today();
const num=(v)=>Number(v)||0, fmt=(v)=>Number(v.toFixed(1)).toFixed(1);
function validTarget(v){return v!==null&&v!==''&&Number.isFinite(Number(v))&&Number(v)>0;}
function titleCase(value){const acronyms=new Set(['WPC','TVP','BBQ','BCAA','DHA','EPA']);return String(value).trim().split(/\s+/).map(word=>word.split(/([-/])/).map(part=>{if(acronyms.has(part.toUpperCase()))return part.toUpperCase();if(/^[A-Z0-9]{2,3}$/.test(part))return part.toUpperCase();return part.charAt(0).toLocaleUpperCase()+part.slice(1).toLocaleLowerCase()}).join('')).join(' ')}
const totals=items=>items.reduce((a,x)=>({kcal:a.kcal+x.kcal,protein:a.protein+x.protein,carbs:a.carbs+x.carbs,fat:a.fat+x.fat}),{kcal:0,protein:0,carbs:0,fat:0});
const save=()=>{localStorage.setItem('macroFoods',JSON.stringify(foods));localStorage.setItem('macroLogs',JSON.stringify(logs));localStorage.setItem('macroCategories',JSON.stringify(categories))};
save();
const entries=()=>logs[currentDate]||[];
function addEntry(food,qty=food.baseQty,unit=food.unit){
 const isServe=unit==='serve'&&Number(food.serveGrams)>0;
 const effectiveQty=isServe?qty*Number(food.serveGrams):qty;
 const factor=effectiveQty/(Number(food.baseQty)||1);
 const entry={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),loggedAt:Date.now(),name:food.name,qty,unit,displayUnit:isServe?`${food.serveName||'Serve'} (${fmt(food.serveGrams)} g)`:unit,kcal:food.kcal*factor,protein:food.protein*factor,carbs:food.carbs*factor,fat:food.fat*factor};
 logs[currentDate]=[...entries(),entry];save();renderDiary();
}
function setTab(tab){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));['diary','library','scanner','weight','history'].forEach(id=>$(id).classList.toggle('hide',id!==tab));if(tab==='library')renderLibrary();if(tab==='history')renderHistory();if(tab==='weight')renderWeight()}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
const appTitle=$('appTitle');appTitle.addEventListener('click',()=>setTab('diary'));appTitle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setTab('diary')}});
$('openHistory').onclick=()=>{ $('historyDate').value=currentDate; setTab('history'); }; 
$('dailyAddFood').onclick=()=>{setTab('library');window.scrollTo({top:0,behavior:'smooth'});};
$('logDate').value=currentDate;$('historyDate').value=currentDate;
$('logDate').onchange=e=>{currentDate=e.target.value||today();renderDiary()};
function renderDiary(){
 const t=totals(entries()), macro=t.protein*4+t.carbs*4+t.fat*9, diff=t.kcal-macro;
 $('totalKcal').textContent=Math.round(t.kcal).toLocaleString();$('totalProtein').textContent=fmt(t.protein)+' g';$('totalCarbs').textContent=fmt(t.carbs)+' g';$('totalFat').textContent=fmt(t.fat)+' g';
 renderMacroTargetProgress(t);
 $('macroCalories').textContent=Math.round(macro)+' kcal';$('difference').textContent=(diff>0?'+':'')+Math.round(diff)+' kcal';$('entryCount').textContent=entries().length;
 const notice=$('discrepancy');notice.classList.toggle('hide',entries().length===0||Math.abs(diff)<25);notice.textContent=`Your supplied food calories differ from calories calculated from macros by ${Math.round(diff)} kcal. Supplied calorie values are preserved.`;
 $('diaryEntries').innerHTML=entries().length?entries().map(x=>`<div class="entry" data-entry-id="${esc(x.id)}"><button class="drag-handle" type="button" aria-label="Hold and drag to reorder ${esc(x.name)}" title="Hold, then drag to reorder">⠿</button><div><b>${esc(x.name)}</b><div class="tiny">${fmt(x.qty)} ${esc(x.displayUnit||x.unit)} · ${fmt(x.kcal)} kcal · P ${fmt(x.protein)} g · C ${fmt(x.carbs)} g · F ${fmt(x.fat)} g</div></div><button class="btn danger smallbtn" data-remove="${esc(x.id)}">Remove</button></div>`).join(''):'<div class="muted tiny">No foods logged yet.</div>';
 $('diaryEntries').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{logs[currentDate]=entries().filter(x=>x.id!==b.dataset.remove);save();renderDiary()});
 enableLongPressReorder($('diaryEntries'),'.entry','.drag-handle',()=>{const byId=new Map(entries().map(x=>[String(x.id),x]));logs[currentDate]=[...$('diaryEntries').querySelectorAll('[data-entry-id]')].map(row=>byId.get(row.dataset.entryId)).filter(Boolean);save();});
 $('clearDay').disabled=!entries().length;
 renderDailyHistory();
}

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function enableLongPressReorder(container,rowSelector,handleSelector,onCommit){
 let timer=null,active=false,pointerId=null,row=null,moved=false,startX=0,startY=0;
 const clear=()=>{if(timer)clearTimeout(timer);timer=null;};
 container.querySelectorAll(handleSelector).forEach(handle=>{
  handle.addEventListener('pointerdown',e=>{
   if(e.button!==undefined&&e.button!==0)return;
   clear();active=false;moved=false;pointerId=e.pointerId;row=handle.closest(rowSelector);startX=e.clientX;startY=e.clientY;
   timer=setTimeout(()=>{active=true;row?.classList.add('is-dragging');handle.classList.add('is-grabbing');},260);
   e.preventDefault();
  });
 });
 const move=e=>{
  if(pointerId!==e.pointerId)return;
  if(!active){if(Math.abs(e.clientX-startX)>12||Math.abs(e.clientY-startY)>18)clear();return;}
  e.preventDefault();
  const under=document.elementFromPoint(e.clientX,e.clientY),target=under?.closest(rowSelector);
  if(!target||target===row||!container.contains(target))return;
  const rect=target.getBoundingClientRect();
  if(e.clientY<rect.top+rect.height/2)container.insertBefore(row,target);
  else container.insertBefore(row,target.nextSibling);
  moved=true;
 };
 const finish=e=>{
  if(pointerId!==e.pointerId)return;
  clear();
  if(active){row?.classList.remove('is-dragging');container.querySelectorAll('.is-grabbing').forEach(x=>x.classList.remove('is-grabbing'));if(moved)onCommit();}
  active=false;pointerId=null;row=null;moved=false;
 };
 document.addEventListener('pointermove',move,{passive:false});
 document.addEventListener('pointerup',finish);
 document.addEventListener('pointercancel',finish);
}
function quantityInput(f,index){const gram=isGramUnit(f.unit);const whole=!gram;const qty=whole?Math.max(0,Math.round(Number(f.baseQty)||0)):(Number(f.baseQty)||0);return `<input aria-label="Amount of ${esc(f.name)}" type="number" min="0" step="${whole?'1':'0.1'}" inputmode="${whole?'numeric':'decimal'}" value="${qty}" data-foodqty="${index}" data-whole="${whole?'1':'0'}">`}
function addControls(f,index){const hasServe=isGramUnit(f.unit)&&Number(f.serveGrams)>0;return `<div class="qtyadd">${quantityInput(f,index)}${hasServe?`<select aria-label="Measurement unit for ${esc(f.name)}" data-foodunit="${index}"><option value="g">Grams (g)</option><option value="serve">${esc(f.serveName||'Serve')} (${fmt(f.serveGrams)} g)</option></select>`:`<span>${esc(f.unit)}</span>`}<button class="btn secondary smallbtn" data-addfood="${index}">Add</button></div>`}
function foodRow(f,button=true,index=foods.indexOf(f)){return `<div class="foodrow"><div class="info"><strong>${esc(f.name)}</strong><div class="tiny">Per ${fmt(f.baseQty)} ${esc(f.unit)} · ${fmt(f.kcal)} kcal · P ${fmt(f.protein)} g · C ${fmt(f.carbs)} g · F ${fmt(f.fat)} g</div></div><div class="toolbar food-actions">${button?`<div class="qtyadd">${quantityInput(f,index)}<span>${esc(f.unit)}</span><button class="btn secondary smallbtn" data-addfood="${index}">Add</button></div>`:''}<button class="btn ghost smallbtn" data-editfood="${index}">Edit</button><button class="btn danger smallbtn" data-deletefood="${index}">Delete</button></div></div>`}
function bindFoodActions(container){
 container.querySelectorAll('[data-foodqty][data-whole="1"]').forEach(input=>input.addEventListener('change',()=>{input.value=String(Math.max(0,Math.round(Number(input.value)||0)))}));
 container.querySelectorAll('[data-foodunit]').forEach(select=>select.addEventListener('change',()=>{const i=Number(select.dataset.foodunit),f=foods[i],input=container.querySelector(`[data-foodqty="${i}"]`);if(!f||!input)return;input.value=select.value==='serve'?'1':String(f.baseQty);input.step=select.value==='serve'?'0.1':(isGramUnit(f.unit)?'0.1':'1');input.inputMode=select.value==='serve'?'decimal':(isGramUnit(f.unit)?'decimal':'numeric')}));
 container.querySelectorAll('[data-addfood]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.addfood),f=foods[i],input=container.querySelector(`[data-foodqty="${i}"]`),unitSelect=container.querySelector(`[data-foodunit="${i}"]`),qty=input?num(input.value):f?.baseQty,unit=unitSelect?.value||f?.unit;if(f&&qty>0){addEntry(f,qty,unit);if(container.id==='quickResults')renderQuick();setTab('diary')}});
 container.querySelectorAll('[data-editfood]').forEach(b=>b.onclick=()=>openFoodEditor(Number(b.dataset.editfood)));
 container.querySelectorAll('[data-deletefood]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.deletefood);if(!foods[i])return;foods.splice(i,1);save();renderLibrary();});
}
function renderLibrary(){
 const cats=['All',...new Set([...categories,...foods.map(f=>f.category||'Custom')])],old=$('categoryFilter').value||'All';
 $('categoryFilter').innerHTML=cats.map(c=>`<option>${esc(c)}</option>`).join('');$('categoryFilter').value=cats.includes(old)?old:'All';
 $('categoryOptions').innerHTML=cats.filter(c=>c!=='All').map(c=>`<option value="${esc(c)}"></option>`).join('');
 const q=$('librarySearch').value.toLowerCase(),cat=$('categoryFilter').value,sort=$('librarySort').value||'alphabetical';
 const usage=foodUsage();
 const list=foods.filter(f=>(cat==='All'||(f.category||'Custom')===cat)&&f.name.toLowerCase().includes(q));
 list.sort((a,b)=>{if(sort==='recent'){const au=usage.get(a.name.toLocaleLowerCase())||{last:0},bu=usage.get(b.name.toLocaleLowerCase())||{last:0};return bu.last-au.last||a.name.localeCompare(b.name,undefined,{sensitivity:'base'});}return a.name.localeCompare(b.name,undefined,{sensitivity:'base'});});
 $('foodCount').textContent=foods.length+' foods';
 $('foodList').innerHTML=list.map(f=>{const i=foods.indexOf(f);return `<article class="library-item" data-food-id="${esc(f.id)}">${sort==='custom'?`<button class="drag-handle library-drag-handle" type="button" aria-label="Hold and drag to reorder ${esc(f.name)}" title="Hold, then drag to reorder">⠿</button>`:'<span class="library-drag-placeholder" aria-hidden="true"></span>'}<input class="food-select" type="checkbox" aria-label="Select ${esc(f.name)} for deletion" data-selectfood="${i}"><div class="library-item-main"><div class="library-item-info"><strong>${esc(f.name)}</strong><div class="library-item-meta">Per ${fmt(f.baseQty)} ${esc(f.unit)} <span>·</span> ${fmt(f.kcal)} kcal <span>·</span> P ${fmt(f.protein)} g <span>·</span> C ${fmt(f.carbs)} g <span>·</span> F ${fmt(f.fat)} g</div></div><div class="library-quantity-row">${addControls(f,i)}</div><div class="library-manage-row"><button class="btn ghost smallbtn" data-editfood="${i}">Edit</button><button class="btn danger smallbtn" data-deletefood="${i}">Delete</button></div></div></article>`}).join('')||'<div class="tiny muted">No matching foods.</div>';
 bindFoodActions($('foodList'));
 if(sort==='custom')enableLongPressReorder($('foodList'),'.library-item','.library-drag-handle',()=>{const visible=[...$('foodList').querySelectorAll('[data-food-id]')].map(x=>x.dataset.foodId),visibleSet=new Set(visible),ordered=foods.filter(f=>visibleSet.has(String(f.id))),byId=new Map(ordered.map(f=>[String(f.id),f])),ranked=visible.map(id=>byId.get(id)).filter(Boolean);let cursor=0;foods=foods.map(f=>visibleSet.has(String(f.id))?ranked[cursor++]:f);save();renderLibrary();});
 const updateSelection=()=>{const boxes=[...$('foodList').querySelectorAll('[data-selectfood]')],selected=boxes.filter(x=>x.checked).length,all=$('selectAllFoods');$('selectedFoodCount').textContent=selected+' selected';$('deleteSelectedFoods').disabled=selected===0;$('deleteSelectedFoods').textContent=`Delete selected (${selected})`;all.checked=boxes.length>0&&selected===boxes.length;all.indeterminate=selected>0&&selected<boxes.length;};
 $('foodList').querySelectorAll('[data-selectfood]').forEach(box=>box.addEventListener('change',updateSelection));
 $('selectAllFoods').checked=false;$('selectAllFoods').indeterminate=false;$('selectAllFoods').onchange=()=>{$('foodList').querySelectorAll('[data-selectfood]').forEach(box=>box.checked=$('selectAllFoods').checked);updateSelection()};
 updateSelection();
}
function newFoodId(){return 'food-'+Date.now()+'-'+Math.random().toString(36).slice(2,9)}
function openFoodEditor(i){
 const f=foods[i];if(!f)return;$('foodEditor').dataset.index=i;
 $('editName').value=f.name;$('editQty').value=f.baseQty;$('editUnit').value=f.unit;
 $('editCategory').value=f.category||'Custom';$('editBasis').value=f.basis||'';$('editServeName').value=f.serveName||'';$('editServeGrams').value=f.serveGrams||'';$('editKcal').value=f.kcal;$('editProtein').value=f.protein;$('editCarbs').value=f.carbs;$('editFat').value=f.fat;
 $('foodEditor').showModal();
}
function closeFoodEditor(){$('foodEditor').close()}
$('closeEditor').onclick=closeFoodEditor;$('cancelEditor').onclick=closeFoodEditor;
$('foodEditorForm').onsubmit=e=>{
 e.preventDefault();const i=Number($('foodEditor').dataset.index),f=foods[i];if(!f)return;
 const qty=num($('editQty').value),vals=['editKcal','editProtein','editCarbs','editFat'].map(id=>$(id).value);
 if(!$('editName').value.trim()||qty<=0||!$('editUnit').value.trim()||vals.some(v=>v===''||num(v)<0)){alert('Check the food name, serving quantity, unit and nutrition values.');return}
 const serveName=$('editServeName').value.trim(),serveGrams=num($('editServeGrams').value);if(serveGrams<0||($('editServeGrams').value.trim()!==''&&serveGrams<=0)){alert('Enter a serving weight greater than zero, or leave it blank.');return}
 foods[i]={...f,name:titleCase($('editName').value.trim()),baseQty:qty,unit:isGramUnit($('editUnit').value)?'g':$('editUnit').value.trim(),category:$('editCategory').value.trim()||'Custom',basis:$('editBasis').value.trim(),serveName:serveGrams>0?(serveName||'Serve'):'',serveGrams:serveGrams>0?serveGrams:null,kcal:num(vals[0]),protein:num(vals[1]),carbs:num(vals[2]),fat:num(vals[3])};
 save();closeFoodEditor();renderLibrary();
};
$('manageCategories').onclick=()=>{
 const existing=[...new Set([...categories,...foods.map(f=>f.category||'Custom')])];
 const action=prompt('Category management:\nType ADD to create a category, RENAME to rename one, or DELETE to remove one.');
 if(!action)return;const mode=action.trim().toUpperCase();
 if(mode==='ADD'){const name=prompt('New category name:');if(name&&name.trim()&&!existing.includes(name.trim())){categories.push(name.trim());save();renderLibrary();}}
 else if(mode==='RENAME'){const old=prompt('Exact category name to rename:\n'+existing.join('\n'));if(!old||!existing.includes(old))return;const name=prompt('New category name:');if(name&&name.trim()){foods.forEach(f=>{if((f.category||'Custom')===old)f.category=name.trim()});categories=categories.map(c=>c===old?name.trim():c);save();renderLibrary();}}
 else if(mode==='DELETE'){const old=prompt('Exact category name to delete:\n'+existing.join('\n'));if(!old||!existing.includes(old))return;const target=prompt('Move foods in this category to which category? Enter an existing category, or leave blank for Custom.');foods.forEach(f=>{if((f.category||'Custom')===old)f.category=target&&existing.includes(target)?target:'Custom'});categories=categories.filter(c=>c!==old);save();renderLibrary();}
 else alert('Please enter ADD, RENAME or DELETE.');
}
$('deleteSelectedFoods').onclick=()=>{const selected=[...$('foodList').querySelectorAll('[data-selectfood]:checked')].map(box=>Number(box.dataset.selectfood)).filter(i=>Number.isInteger(i)&&foods[i]);if(!selected.length)return;selected.sort((a,b)=>b-a).forEach(i=>foods.splice(i,1));save();renderLibrary();};
$('librarySearch').oninput=renderLibrary;$('categoryFilter').onchange=renderLibrary;$('librarySort').onchange=renderLibrary;
function foodUsage(){
 const usage=new Map();
 for(const [date,dayEntries] of Object.entries(logs)){
  const dayStart=Date.parse(date+'T00:00:00')||0;
  (Array.isArray(dayEntries)?dayEntries:[]).forEach((entry,index)=>{
   const key=String(entry.name||'').toLocaleLowerCase();
   if(!key)return;
   const item=usage.get(key)||{count:0,last:0};
   item.count++;
   item.last=Math.max(item.last,Number(entry.loggedAt)||dayStart+index);
   usage.set(key,item);
  });
 }
 return usage;
}
function quickFoodRow(f,index){
 return `<div class="foodrow"><div class="info"><strong>${esc(f.name)}</strong><div class="tiny">Per ${fmt(f.baseQty)} ${esc(f.unit)} · ${fmt(f.kcal)} kcal · P ${fmt(f.protein)} g · C ${fmt(f.carbs)} g · F ${fmt(f.fat)} g</div></div><div class="toolbar food-actions">${addControls(f,index)}</div></div>`;
}
function renderQuick(){
 const usage=foodUsage();
 const list=foods.map((f,index)=>({f,index,stats:usage.get(f.name.toLocaleLowerCase())||{count:0,last:0}}))
  .sort((a,b)=>b.stats.count-a.stats.count||b.stats.last-a.stats.last||a.index-b.index)
  .slice(0,5).map(x=>x.f);
 $('quickResults').innerHTML=list.map(f=>quickFoodRow(f,foods.indexOf(f))).join('')||'<div class="tiny muted">No foods in your library yet.</div>';
 bindFoodActions($('quickResults'));

}
$('saveCustom').onclick=()=>{
 const name=titleCase($('customName').value.trim()),qty=num($('customQty').value),unit=$('customUnit').value.trim()||'serve';
 const vals=['customKcal','customProtein','customCarbs','customFat'].map(id=>$(id).value);
 if(!name||qty<=0||vals.some(v=>v===''||num(v)<0)){alert('Enter a name, serving quantity and all four nutrition values.');return}
 const [kcal,protein,carbs,fat]=vals.map(num),f={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,baseQty:qty,unit,kcal,protein,carbs,fat,category:$('customCategory').value.trim()||'Custom',basis:$('customBasis').value.trim()};
 foods.push(f);save();['customName','customKcal','customProtein','customCarbs','customFat'].forEach(id=>$(id).value='');renderLibrary();alert('Food saved to your library.');
};
$('clearDay').onclick=()=>{if(confirm('Clear all entries for this day?')){logs[currentDate]=[];save();renderDiary()}};
function renderDailyHistory(){
 const host=$('dailyHistoryList');
 if(!host)return;
 const days=Object.keys(logs)
  .filter(date=>date<currentDate&&Array.isArray(logs[date])&&logs[date].length)
  .sort((a,b)=>b.localeCompare(a));
 if(!days.length){host.innerHTML='<div class="muted tiny">No previous days logged yet.</div>';return;}
 host.innerHTML=days.map(date=>{
  const dayItems=logs[date],t=totals(dayItems);
  const label=new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  return `<div class="daily-history-row"><div><div class="daily-history-date">${esc(label)}</div><div class="daily-history-macros">${Math.round(t.kcal).toLocaleString()} kcal · Protein ${fmt(t.protein)} g · Carbs ${fmt(t.carbs)} g · Fat ${fmt(t.fat)} g</div></div><button class="btn ghost smallbtn daily-history-view" type="button" data-history-day="${esc(date)}">View day</button></div>`;
 }).join('');
 host.querySelectorAll('[data-history-day]').forEach(button=>button.onclick=()=>{
  currentDate=button.dataset.historyDay;
  $('logDate').value=currentDate;
  renderDiary();
  window.scrollTo({top:0,behavior:'smooth'});
 });
}
function dateAtNoon(date){return new Date(String(date)+'T12:00:00');}
function mondayOf(date){const d=dateAtNoon(date);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return d;}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function renderWeeklyReports(){
 const host=$('weeklyReports');if(!host)return;
 const dates=Object.keys(logs).filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&Array.isArray(logs[date])&&logs[date].length);
 if(!dates.length){host.innerHTML='<div class="muted tiny">Your weekly summaries will appear here once you have logged food.</div>';return;}
 const weeks=new Map();
 dates.forEach(date=>{const start=mondayOf(date),key=dateKey(start);if(!weeks.has(key))weeks.set(key,{start,dates:[]});weeks.get(key).dates.push(date);});
 const ordered=[...weeks.values()].sort((a,b)=>b.start-a.start);
 host.innerHTML=ordered.map(week=>{
  const start=week.start,end=new Date(start);end.setDate(end.getDate()+6);
  const dayTotals=week.dates.map(date=>({date,total:totals(logs[date])}));
  const sum=dayTotals.reduce((a,x)=>({kcal:a.kcal+x.total.kcal,protein:a.protein+x.total.protein,carbs:a.carbs+x.total.carbs,fat:a.fat+x.total.fat}),{kcal:0,protein:0,carbs:0,fat:0});
  const count=dayTotals.length,avg={kcal:sum.kcal/count,protein:sum.protein/count,carbs:sum.carbs/count,fat:sum.fat/count};
  const weekStartKey=dateKey(start),weekEndKey=dateKey(end);
  const weights=weightLogs.filter(x=>x&&String(x.date)>=weekStartKey&&String(x.date)<=weekEndKey&&Number.isFinite(Number(x.weight))).map(x=>Number(x.weight));
  const weightAvg=weights.length?weights.reduce((a,b)=>a+b,0)/weights.length:null;
  const label=`${start.toLocaleDateString(undefined,{day:'numeric',month:'short'})} – ${end.toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}`;
  const isCurrent= dateKey(mondayOf(today()))===dateKey(start);
  return `<article class="weekly-report"><div class="weekly-report-head"><div class="weekly-report-title">${esc(label)}${isCurrent?' · Current week':''}</div><div class="weekly-report-days">${count} of 7 days logged</div></div><div class="weekly-report-grid"><div class="weekly-report-stat"><b>${Math.round(avg.kcal).toLocaleString()} kcal</b><span>Average calories / logged day</span></div><div class="weekly-report-stat"><b>${fmt(avg.protein)} g</b><span>Average protein / logged day</span></div><div class="weekly-report-stat"><b>${fmt(avg.carbs)} g</b><span>Average carbs / logged day</span></div><div class="weekly-report-stat"><b>${fmt(avg.fat)} g</b><span>Average fat / logged day</span></div></div><div class="weekly-report-foot">${Math.round(sum.kcal).toLocaleString()} kcal total across ${count} logged days${weightAvg===null?'':` · Average weigh-in ${fmt(weightAvg)} kg (${weights.length} ${weights.length===1?'entry':'entries'})`}</div></article>`;
 }).join('');
}
function renderHistory(){
 const date=$('historyDate').value||currentDate,items=logs[date]||[],t=totals(items);
 $('historySummary').innerHTML=items.length?`<b>${date}</b><br>${items.length} entries · ${Math.round(t.kcal)} kcal<br>Protein ${fmt(t.protein)} g · Carbs ${fmt(t.carbs)} g · Fat ${fmt(t.fat)} g`:'No saved log for this date.';
 renderWeeklyReports();renderBackupStatus();
}
$('historyDate').onchange=renderHistory;$('loadHistory').onclick=()=>{currentDate=$('historyDate').value||today();$('logDate').value=currentDate;setTab('diary');renderDiary()};
function download(name,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function makeBackup(){return {app:'MK\'s Macro Ledger',backupFormat:2,exportedAt:new Date().toISOString(),foods,logs,categories,weightLogs,weightTarget,macroTargets,localPreferences:{librarySort:$('librarySort')?.value||'alphabetical',colesLibrarySeeded:!!localStorage.getItem(COLES_SEED_KEY)}};}
function renderBackupStatus(){const host=$('backupStatus');if(!host)return;const stamp=Number(localStorage.getItem('macroLastBackupAt')||0);if(!stamp){host.classList.add('needs-backup');host.textContent='No JSON backup recorded on this browser yet. Download a backup periodically and keep a copy somewhere safe.';return;}const age=Math.floor((Date.now()-stamp)/86400000),label=new Date(stamp).toLocaleString();host.classList.toggle('needs-backup',age>=30);host.textContent=`Last JSON backup downloaded: ${label}.${age>=30?' It has been 30 days or more — consider downloading a fresh copy.':' Remember to keep the downloaded file somewhere safe.'}`;}
function exportFullBackup(){const backup=makeBackup();download('mk-macro-ledger-backup.json',JSON.stringify(backup,null,2),'application/json');localStorage.setItem('macroLastBackupAt',String(Date.now()));renderBackupStatus();}
$('exportJSON').onclick=exportFullBackup;
$('exportCSV').onclick=()=>{const rows=[['Date','Food','Quantity','Unit','Calories','Protein g','Carbs g','Fat g']];Object.entries(logs).forEach(([date,items])=>items.forEach(x=>rows.push([date,x.name,x.qty,x.displayUnit||x.unit,x.kcal,x.protein,x.carbs,x.fat])));const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');download('macro-ledger-history.csv',csv,'text/csv')};
function historyExportText(){const dates=Object.keys(logs).filter(date=>Array.isArray(logs[date])&&logs[date].length).sort();if(!dates.length)return "MK's Macro Ledger\n\nNo diary entries saved.";return ["MK's Macro Ledger — Food Diary Export",'',...dates.flatMap(date=>{const items=logs[date],t=totals(items);return [date,`${items.length} entries | ${Math.round(t.kcal)} kcal | Protein ${fmt(t.protein)} g | Carbs ${fmt(t.carbs)} g | Fat ${fmt(t.fat)} g`,'',...items.map(x=>`${x.name} — ${fmt(x.qty)} ${x.displayUnit||x.unit} | ${fmt(x.kcal)} kcal | P ${fmt(x.protein)} g | C ${fmt(x.carbs)} g | F ${fmt(x.fat)} g`),'','----------------------------------------','']})].join('\n')}
$('exportTXT').onclick=()=>download('macro-ledger-history.txt',historyExportText(),'text/plain;charset=utf-8');
$('exportPDF').onclick=()=>{const content=historyExportText(),printWindow=window.open('','_blank');if(!printWindow){alert('Please allow pop-ups for this site to create the PDF.');return;}const safe=esc(content);printWindow.document.open();printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Macro Ledger — Food Diary</title><style>body{font:12pt/1.5 Arial,sans-serif;color:#111;margin:24mm;white-space:pre-wrap}h1{font-size:18pt}@page{size:auto;margin:18mm}</style></head><body><h1>MK's Macro Ledger</h1><pre>${safe}</pre><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`);printWindow.document.close();};
$('importJSON').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||!Array.isArray(data.foods)||!data.logs||typeof data.logs!=='object'||Array.isArray(data.logs))throw Error('invalid');if(data.foods.some(f=>!f||typeof f.name!=='string'||!Number.isFinite(Number(f.kcal))||!Number.isFinite(Number(f.protein))||!Number.isFinite(Number(f.carbs))||!Number.isFinite(Number(f.fat))))throw Error('invalid');if(data.weightLogs!==undefined&&!Array.isArray(data.weightLogs))throw Error('invalid');if(data.categories!==undefined&&!Array.isArray(data.categories))throw Error('invalid');if(!confirm('Restore this backup? This will replace the current food Library, diary and any settings included in the backup. Before replacing them, the app will download a safety backup of your current data.')){e.target.value='';return;}
 // Download a complete snapshot of the current browser data before any replacement.
 exportFullBackup();
 foods=data.foods;logs=data.logs;if(Array.isArray(data.categories))categories=data.categories;if(Array.isArray(data.weightLogs))weightLogs=data.weightLogs;if(data.weightTarget===null||Number.isFinite(Number(data.weightTarget))&&Number(data.weightTarget)>0)weightTarget=data.weightTarget===null?null:Number(data.weightTarget);if(data.macroTargets&&typeof data.macroTargets==='object'){macroTargets={kcal:validTarget(data.macroTargets.kcal)?Number(data.macroTargets.kcal):null,protein:validTarget(data.macroTargets.protein)?Number(data.macroTargets.protein):null,carbs:validTarget(data.macroTargets.carbs)?Number(data.macroTargets.carbs):null,fat:validTarget(data.macroTargets.fat)?Number(data.macroTargets.fat):null};localStorage.setItem('macroTargets',JSON.stringify(macroTargets));}localStorage.setItem('macroWeightLogs',JSON.stringify(weightLogs));localStorage.setItem('macroWeightTarget',JSON.stringify(weightTarget));save();renderDiary();renderLibrary();renderWeight();renderHistory();alert('Backup restored. Your previous data was downloaded first as a safety backup.')}catch{alert('That file does not look like a valid Macro Ledger backup. No data was intentionally replaced.')}e.target.value=''};

// Weight diary and progress chart: stored independently from food logs.
function weightDateValue(value){const d=new Date(String(value)+'T12:00:00');return Number.isNaN(d.getTime())?null:d;}
function weightAverage(items){return items.length?items.reduce((sum,x)=>sum+Number(x.weight),0)/items.length:null;}
function renderWeightChart(items){
 const host=$('weightChart');if(!host)return;
 const now=weightDateValue(today());
 let visible=items;
 if(weightChartRange!=='all'&&now){const cutoff=new Date(now);cutoff.setDate(cutoff.getDate()-Number(weightChartRange));visible=items.filter(x=>{const d=weightDateValue(x.date);return d&&d>=cutoff&&d<=now;});}
 if(!visible.length){host.innerHTML='<div class="weight-chart-empty">No weigh-ins in this period. Try a longer range or log a new weight.</div>';return;}
 const W=640,H=250,L=48,R=18,T=18,B=42,plotW=W-L-R,plotH=H-T-B;
 const vals=visible.map(x=>Number(x.weight)).filter(Number.isFinite);let min=Math.min(...vals),max=Math.max(...vals);
 if(weightTarget!==null&&Number.isFinite(Number(weightTarget))){min=Math.min(min,Number(weightTarget));max=Math.max(max,Number(weightTarget));}
 const span=Math.max(1,max-min),pad=Math.max(.5,span*.18);min-=pad;max+=pad;
 const dates=visible.map(x=>weightDateValue(x.date)).filter(Boolean);let t0=Math.min(...dates.map(d=>d.getTime())),t1=Math.max(...dates.map(d=>d.getTime()));if(t0===t1){t0-=86400000;t1+=86400000;}
 const x=d=>L+((d.getTime()-t0)/(t1-t0))*plotW, y=v=>T+((max-v)/(max-min))*plotH;
 const ticks=4;let grid='';for(let i=0;i<=ticks;i++){const v=min+(max-min)*i/ticks,yy=y(v);grid+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="var(--line)" stroke-width="1"/><text x="${L-8}" y="${yy+4}" text-anchor="end" fill="var(--muted)" font-size="11">${v.toFixed(1)}</text>`;}
 const points=visible.map(item=>({item,date:weightDateValue(item.date)})).filter(p=>p.date).sort((a,b)=>a.date-b.date);
 const coords=points.map(p=>`${x(p.date)},${y(Number(p.item.weight))}`).join(' ');
 const line=points.length>1?`<polyline points="${coords}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`:'';
 const circles=points.map(p=>`<circle cx="${x(p.date)}" cy="${y(Number(p.item.weight))}" r="4.5" fill="var(--accent)" stroke="var(--panel)" stroke-width="2"><title>${p.date.toLocaleDateString()} · ${fmt(Number(p.item.weight))} kg</title></circle>`).join('');
 const target=weightTarget!==null&&Number.isFinite(Number(weightTarget))?`<line x1="${L}" y1="${y(Number(weightTarget))}" x2="${W-R}" y2="${y(Number(weightTarget))}" stroke="#9da6b0" stroke-width="1.5" stroke-dasharray="6 5"/><text x="${W-R}" y="${y(Number(weightTarget))-6}" text-anchor="end" fill="var(--muted)" font-size="11">Target ${fmt(Number(weightTarget))} kg</text>`:'';
 const first=points[0].date,last=points[points.length-1].date;
 const dateLabel=d=>d.toLocaleDateString(undefined,{day:'numeric',month:'short'});
 host.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend from ${dateLabel(first)} to ${dateLabel(last)}">${grid}${target}${line}${circles}<text x="${L}" y="${H-12}" fill="var(--muted)" font-size="11">${dateLabel(first)}</text><text x="${W-R}" y="${H-12}" text-anchor="end" fill="var(--muted)" font-size="11">${dateLabel(last)}</text></svg>`;
}
function renderWeight(){
 const host=$('weightEntries');if(!host)return;
 const sorted=[...weightLogs].sort((a,b)=>String(b.date).localeCompare(String(a.date))||(Number(b.loggedAt)||0)-(Number(a.loggedAt)||0));
 $('weightCount').textContent=`${sorted.length} ${sorted.length===1?'entry':'entries'}`;
 const valid=sorted.filter(x=>Number.isFinite(Number(x.weight))&&weightDateValue(x.date));
 if(!valid.length){host.innerHTML='<div class="muted tiny">No weight entries yet.</div>';}
 else host.innerHTML=valid.map(item=>{
  const label=weightDateValue(item.date).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'});
  return `<div class="daily-history-row"><div><div class="daily-history-date">${esc(label)}</div><div class="daily-history-macros">${fmt(Number(item.weight))} kg</div></div><button class="btn danger smallbtn" type="button" data-delete-weight="${esc(item.id)}">Delete</button></div>`;
 }).join('');
 host.querySelectorAll('[data-delete-weight]').forEach(button=>button.onclick=()=>{if(!confirm('Delete this weight entry?'))return;weightLogs=weightLogs.filter(x=>String(x.id)!==button.dataset.deleteWeight);localStorage.setItem('macroWeightLogs',JSON.stringify(weightLogs));renderWeight();});
 $('weightLatest').textContent=valid.length?fmt(Number(valid[0].weight))+' kg':'—';
 const chronological=[...valid].sort((a,b)=>String(a.date).localeCompare(String(b.date))||(Number(a.loggedAt)||0)-(Number(b.loggedAt)||0));
 if(chronological.length){const delta=Number(valid[0].weight)-Number(chronological[0].weight);$('weightChange').textContent=(delta>0?'+':'')+fmt(delta)+' kg';}else $('weightChange').textContent='—';
 const todayDate=weightDateValue(today());
 const recent=(days)=>{const cutoff=new Date(todayDate||new Date());cutoff.setDate(cutoff.getDate()-days);return valid.filter(x=>{const d=weightDateValue(x.date);return d&&d>=cutoff&&d<=todayDate;});};
 const avg7=weightAverage(recent(7)),avg30=weightAverage(recent(30));
 $('weightAverage7').textContent=avg7===null?'—':fmt(avg7)+' kg';$('weightAverage30').textContent=avg30===null?'—':fmt(avg30)+' kg';
 $('weightTargetInput').value=weightTarget===null?'':weightTarget;
 renderWeightChart([...valid].sort((a,b)=>String(a.date).localeCompare(String(b.date))||(Number(a.loggedAt)||0)-(Number(b.loggedAt)||0)));
 document.querySelectorAll('[data-weight-range]').forEach(b=>b.classList.toggle('active',b.dataset.weightRange===weightChartRange));
}
document.querySelectorAll('[data-weight-range]').forEach(button=>button.addEventListener('click',()=>{weightChartRange=button.dataset.weightRange;renderWeight();}));
$('saveWeightTarget').onclick=()=>{const raw=$('weightTargetInput').value.trim();if(!raw){$('weightTargetStatus').textContent='Enter a target weight, or use Clear target.';return;}const v=Number(raw);if(!Number.isFinite(v)||v<=0||v>500){$('weightTargetStatus').textContent='Enter a valid target weight in kilograms.';return;}weightTarget=v;localStorage.setItem('macroWeightTarget',JSON.stringify(weightTarget));$('weightTargetStatus').textContent=`Target saved: ${fmt(weightTarget)} kg.`;renderWeight();};
$('clearWeightTarget').onclick=()=>{weightTarget=null;localStorage.setItem('macroWeightTarget','null');$('weightTargetStatus').textContent='Target cleared.';renderWeight();};
$('weightForm').onsubmit=e=>{
 e.preventDefault();const weight=Number($('weightInput').value);
 if(!Number.isFinite(weight)||weight<=0||weight>500){$('weightStatus').textContent='Enter a valid weight in kilograms.';return;}
 weightLogs.push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),date:today(),loggedAt:Date.now(),weight});
 localStorage.setItem('macroWeightLogs',JSON.stringify(weightLogs));$('weightInput').value='';$('weightStatus').textContent=`Saved ${fmt(weight)} kg for ${new Date().toLocaleDateString()}.`;renderWeight();
};

// Barcode lookup and review flow. Nothing is saved until the user confirms.
let scannerInstance=null, cameraStream=null, scanFrame=null, zxingLoaded=false;
const setScannerStatus=(msg)=>{ $('scannerStatus').textContent=msg; };
function closeBarcodeReview(){ $('barcodeReview').classList.add('hide'); }
function showBarcodeReview(p,code){
 const n=p.nutriments||{};
 const kcal=n['energy-kcal_100g'] ?? (typeof n['energy_100g']==='number'?n['energy_100g']/4.184:null);
 const protein=n.proteins_100g, carbs=n.carbohydrates_100g, fat=n.fat_100g;
 if([kcal,protein,carbs,fat].some(v=>v===null||v===undefined||!Number.isFinite(Number(v)))){
   setScannerStatus('Product found, but its per-100 g nutrition data is incomplete. You can enter the missing values manually in Add a custom food.');
 }
 $('scanName').value=p.product_name||p.product_name_en||p.generic_name||'';
 $('scanBrand').value=p.brands||'';
 $('scanCode').value=code;
 $('scanKcal').value=kcal==null?'':Number(kcal).toFixed(1);
 $('scanProtein').value=protein==null?'':Number(protein).toFixed(1);
 $('scanCarbs').value=carbs==null?'':Number(carbs).toFixed(1);
 $('scanFat').value=fat==null?'':Number(fat).toFixed(1);
 $('scanBasis').value='Per 100 g, as sold'+(p.quantity?' · pack '+p.quantity:'');
 $('scanCategory').value='Packaged foods';
 $('barcodeReview').classList.remove('hide');
}
async function lookupBarcode(){
 const code=$('barcodeInput').value.trim().replace(/\s+/g,'');
 if(!/^\d{8,14}$/.test(code)){setScannerStatus('Enter a valid 8–14 digit barcode.');return;}
 $('lookupBarcode').disabled=true;setScannerStatus('Looking up barcode…');closeBarcodeReview();
 try{
  const url=`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(code)}.json?fields=code,product_name,product_name_en,generic_name,brands,quantity,serving_size,nutriments`;
  const response=await fetch(url,{headers:{'Accept':'application/json'}});
  if(!response.ok)throw new Error(`Lookup service returned ${response.status}`);
  const data=await response.json();
  if(!data.product||data.status===0)throw new Error('No product was found for that barcode.');
  showBarcodeReview(data.product,code);
  setScannerStatus('Product retrieved. Check the name and nutrition against the packaging before saving.');
 }catch(err){setScannerStatus(err.message||'Could not retrieve this product. Check your connection or enter the food manually.');}
 finally{$('lookupBarcode').disabled=false;}
}
$('lookupBarcode').onclick=lookupBarcode;
$('barcodeInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();lookupBarcode();}});
$('saveScannedFood').onclick=()=>{
 const name=$('scanName').value.trim(),vals=['scanKcal','scanProtein','scanCarbs','scanFat'].map(id=>$(id).value);
 if(!name||vals.some(v=>v===''||!Number.isFinite(Number(v))||Number(v)<0)){alert('Please check the product name and enter all four nutrition values.');return;}
 const code=$('scanCode').value;
 if(foods.some(f=>f.barcode===code)){if(!confirm('This barcode is already in your library. Save another copy?'))return;}
 foods.push({id:newFoodId(),name:titleCase(($('scanBrand').value.trim()?$('scanBrand').value.trim()+' – ':'')+name),barcode:code,baseQty:100,unit:'g',kcal:num(vals[0]),protein:num(vals[1]),carbs:num(vals[2]),fat:num(vals[3]),category:$('scanCategory').value.trim()||'Packaged foods',basis:$('scanBasis').value.trim()||'Per 100 g, as sold'});
 save();closeBarcodeReview();$('barcodeInput').value='';renderLibrary();setScannerStatus('Product saved to your food library.');
};
$('discardScannedFood').onclick=()=>{closeBarcodeReview();setScannerStatus('Product discarded. Nothing was added to your library.');};
async function stopCameraScanner(){
 if(scanFrame)cancelAnimationFrame(scanFrame);scanFrame=null;
 if(scannerInstance){try{await scannerInstance.stop();await scannerInstance.clear();}catch{}scannerInstance=null;}
 if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}
 $('scannerOverlay').classList.add('hide');$('stopScanner').disabled=true;$('startScanner').disabled=false;
}
$('stopScanner').onclick=stopCameraScanner;
$('startScanner').onclick=async()=>{
 if(!navigator.mediaDevices?.getUserMedia){setScannerStatus('Camera access is unavailable in this browser. Enter the barcode manually.');return;}
 $('startScanner').disabled=true;$('stopScanner').disabled=false;$('scannerOverlay').classList.remove('hide');
 try{
  // Native BarcodeDetector where available; use html5-qrcode as a browser fallback.
  if('BarcodeDetector'in window){
   const supported=await BarcodeDetector.getSupportedFormats();
   const formats=['ean_13','ean_8','upc_a','upc_e','code_128'].filter(x=>supported.includes(x));
   const detector=new BarcodeDetector({formats});
   cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   const video=document.createElement('video');video.setAttribute('playsinline','');video.muted=true;video.srcObject=cameraStream;$('barcodeCamera').replaceChildren(video);await video.play();
   setScannerStatus('Camera active. Hold the barcode inside the frame.');
   const tick=async()=>{if(!cameraStream)return;try{const codes=await detector.detect(video);if(codes.length){$('barcodeInput').value=codes[0].rawValue;await stopCameraScanner();lookupBarcode();return;}}catch{}scanFrame=requestAnimationFrame(tick);};
   tick();
  }else{
   if(!window.Html5Qrcode){
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('Could not load camera scanning support. Enter the barcode manually.'));document.head.appendChild(script);});
   }
   scannerInstance=new Html5Qrcode('barcodeCamera');
   setScannerStatus('Starting camera…');
   await scannerInstance.start({facingMode:'environment'},{fps:10,qrbox:{width:260,height:140},formatsToSupport:[Html5QrcodeSupportedFormats.EAN_13,Html5QrcodeSupportedFormats.EAN_8,Html5QrcodeSupportedFormats.UPC_A,Html5QrcodeSupportedFormats.UPC_E,Html5QrcodeSupportedFormats.CODE_128]},async(decoded)=>{$('barcodeInput').value=decoded;await stopCameraScanner();lookupBarcode();},()=>{});
   setScannerStatus('Camera active. Hold the barcode inside the frame.');
  }
 }catch(err){await stopCameraScanner();setScannerStatus(err.message||'Could not start camera. Check camera permission or enter the barcode manually.');}
};



function renderMacroTargetProgress(totalsNow){
 const host=$('macroTargetProgressList');if(!host)return;
 const configs=[['kcal','Calories',totalsNow.kcal,'kcal'],['protein','Protein',totalsNow.protein,'g'],['carbs','Carbohydrates',totalsNow.carbs,'g'],['fat','Fat',totalsNow.fat,'g']];
 host.innerHTML=configs.filter(([key])=>validTarget(macroTargets[key])).map(([key,label,current,unit])=>{
  const target=Number(macroTargets[key]),pct=current/target*100,remaining=target-current;
  const status=remaining>=0?`${fmt(remaining)} ${unit} remaining`:`${fmt(Math.abs(remaining))} ${unit} over`;
  return `<div class="target-progress-item"><div class="row between tiny"><span>${label}</span><b>${key==='kcal'?Math.round(current).toLocaleString():fmt(current)} / ${key==='kcal'?Math.round(target).toLocaleString():fmt(target)} ${unit}</b></div><div class="progress"><i style="width:${Math.min(100,Math.max(0,pct))}%"></i></div><div class="tiny target-progress-status">${Math.round(pct)}% · ${status}</div></div>`;
 }).join('')||'<div class="tiny muted">Set one or more targets below to see daily progress.</div>';
}
function syncMacroTargetInputs(){
 for(const key of ['kcal','protein','carbs','fat']){const el=$('target'+key.charAt(0).toUpperCase()+key.slice(1));if(el)el.value=macroTargets[key]??'';}
}
$('saveMacroTargets').onclick=()=>{
 const next={};
 for(const key of ['kcal','protein','carbs','fat']){
  const raw=$('target'+key.charAt(0).toUpperCase()+key.slice(1)).value.trim();
  if(!raw){next[key]=null;continue;}
  const value=Number(raw),max=key==='kcal'?20000:2000;
  if(!Number.isFinite(value)||value<=0||value>max){$('macroTargetStatus').textContent=`Enter a valid ${key==='kcal'?'calorie':key} target, or leave it blank.`;return;}
  next[key]=value;
 }
 if(!Object.values(next).some(validTarget)){$('macroTargetStatus').textContent='Set at least one target before saving.';return;}
 macroTargets=next;localStorage.setItem('macroTargets',JSON.stringify(macroTargets));$('macroTargetStatus').textContent='Daily targets saved.';renderDiary();
};
$('resetMacroTargets').onclick=()=>{
 macroTargets={kcal:2100,protein:200,carbs:null,fat:null};localStorage.setItem('macroTargets',JSON.stringify(macroTargets));syncMacroTargetInputs();$('macroTargetStatus').textContent='Default targets restored: 2,100 kcal and 200 g protein.';renderDiary();
};
syncMacroTargetInputs();

renderDiary();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
})();