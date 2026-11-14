(()=>{
const $=id=>document.getElementById(id), today=()=>new Date().toLocaleDateString('en-CA');
const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
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
    const target=(unit==='g'||unit==='mL')?100:f.baseQty||1;
    const key=name.toLowerCase()+'|'+unit.toLowerCase();
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
let currentDate=today(), converted=null;
const num=(v)=>Number(v)||0, fmt=(v)=>Number(v.toFixed(1)).toFixed(1);
function titleCase(value){const acronyms=new Set(['WPC','TVP','BBQ','BCAA','DHA','EPA']);return String(value).trim().split(/\s+/).map(word=>word.split(/([-/])/).map(part=>{if(acronyms.has(part.toUpperCase()))return part.toUpperCase();if(/^[A-Z0-9]{2,3}$/.test(part))return part.toUpperCase();return part.charAt(0).toLocaleUpperCase()+part.slice(1).toLocaleLowerCase()}).join('')).join(' ')}
const totals=items=>items.reduce((a,x)=>({kcal:a.kcal+x.kcal,protein:a.protein+x.protein,carbs:a.carbs+x.carbs,fat:a.fat+x.fat}),{kcal:0,protein:0,carbs:0,fat:0});
const save=()=>{localStorage.setItem('macroFoods',JSON.stringify(foods));localStorage.setItem('macroLogs',JSON.stringify(logs));localStorage.setItem('macroCategories',JSON.stringify(categories))};
save();
const entries=()=>logs[currentDate]||[];
function addEntry(food,qty=food.baseQty,unit=food.unit){
 const factor=qty/food.baseQty;
 const entry={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),loggedAt:Date.now(),name:food.name,qty,unit,kcal:food.kcal*factor,protein:food.protein*factor,carbs:food.carbs*factor,fat:food.fat*factor};
 logs[currentDate]=[...entries(),entry];save();renderDiary();
}
function setTab(tab){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));['diary','library','converter','scanner','history'].forEach(id=>$(id).classList.toggle('hide',id!==tab));if(tab==='library')renderLibrary();if(tab==='converter')renderConverterSelect();if(tab==='history')renderHistory()}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
const appTitle=$('appTitle');appTitle.addEventListener('click',()=>setTab('diary'));appTitle.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setTab('diary')}});
$('goLibrary').onclick=()=>setTab('library');
$('openHistory').onclick=()=>{ $('historyDate').value=currentDate; setTab('history'); }; 
$('dailyAddFood').onclick=()=>{$('addFoodCard').scrollIntoView({behavior:'smooth',block:'start'});};
$('logDate').value=currentDate;$('historyDate').value=currentDate;
$('logDate').onchange=e=>{currentDate=e.target.value||today();renderDiary()};
function renderDiary(){
 const t=totals(entries()), macro=t.protein*4+t.carbs*4+t.fat*9, diff=t.kcal-macro;
 $('totalKcal').textContent=Math.round(t.kcal).toLocaleString();$('totalProtein').textContent=fmt(t.protein)+' g';$('totalCarbs').textContent=fmt(t.carbs)+' g';$('totalFat').textContent=fmt(t.fat)+' g';
 $('proteinProgress').style.width=Math.min(100,t.protein/200*100)+'%';$('proteinProgressLabel').textContent=fmt(t.protein)+' / 200 g';
 $('macroCalories').textContent=Math.round(macro)+' kcal';$('difference').textContent=(diff>0?'+':'')+Math.round(diff)+' kcal';$('entryCount').textContent=entries().length;
 const notice=$('discrepancy');notice.classList.toggle('hide',entries().length===0||Math.abs(diff)<25);notice.textContent=`Your supplied food calories differ from calories calculated from macros by ${Math.round(diff)} kcal. Supplied calorie values are preserved.`;
 $('diaryEntries').innerHTML=entries().length?entries().map(x=>`<div class="entry"><div><b>${esc(x.name)}</b><div class="tiny">${fmt(x.qty)} ${esc(x.unit)} · ${fmt(x.kcal)} kcal · P ${fmt(x.protein)} g · C ${fmt(x.carbs)} g · F ${fmt(x.fat)} g</div></div><button class="btn danger smallbtn" data-remove="${x.id}">Remove</button></div>`).join(''):'<div class="muted tiny">No foods logged yet.</div>';
 $('diaryEntries').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{logs[currentDate]=entries().filter(x=>x.id!==b.dataset.remove);save();renderDiary()});
 $('clearDay').disabled=!entries().length;
 renderQuick();
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function quantityInput(f,index){const whole=f.unit.toLowerCase()!=='g';const qty=whole?Math.max(0,Math.round(Number(f.baseQty)||0)):(Number(f.baseQty)||0);return `<input aria-label="Amount of ${esc(f.name)}" type="number" min="0" step="${whole?'1':'0.1'}" inputmode="${whole?'numeric':'decimal'}" value="${qty}" data-foodqty="${index}" data-whole="${whole?'1':'0'}">`}
function foodRow(f,button=true,index=foods.indexOf(f)){return `<div class="foodrow"><div class="info"><strong>${esc(f.name)}</strong><div class="tiny">Per ${fmt(f.baseQty)} ${esc(f.unit)} · ${fmt(f.kcal)} kcal · P ${fmt(f.protein)} g · C ${fmt(f.carbs)} g · F ${fmt(f.fat)} g</div></div><div class="toolbar food-actions">${button?`<div class="qtyadd">${quantityInput(f,index)}<span>${esc(f.unit)}</span><button class="btn secondary smallbtn" data-addfood="${index}">Add</button></div>`:''}<button class="btn ghost smallbtn" data-editfood="${index}">Edit</button><button class="btn danger smallbtn" data-deletefood="${index}">Delete</button></div></div>`}
function bindFoodActions(container){
 container.querySelectorAll('[data-foodqty][data-whole="1"]').forEach(input=>input.addEventListener('change',()=>{input.value=String(Math.max(0,Math.round(Number(input.value)||0)))}));
 container.querySelectorAll('[data-addfood]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.addfood),f=foods[i],input=container.querySelector(`[data-foodqty="${i}"]`),qty=input?num(input.value):f?.baseQty;if(f&&qty>0){addEntry(f,qty);if(container.id==='quickResults')renderQuick();setTab('diary')}});
 container.querySelectorAll('[data-editfood]').forEach(b=>b.onclick=()=>openFoodEditor(Number(b.dataset.editfood)));
 container.querySelectorAll('[data-deletefood]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.deletefood);if(!foods[i])return;foods.splice(i,1);save();renderLibrary();});
}
function renderLibrary(){
 const cats=['All',...new Set([...categories,...foods.map(f=>f.category||'Custom')])],old=$('categoryFilter').value||'All';
 $('categoryFilter').innerHTML=cats.map(c=>`<option>${esc(c)}</option>`).join('');$('categoryFilter').value=cats.includes(old)?old:'All';
 $('categoryOptions').innerHTML=cats.filter(c=>c!=='All').map(c=>`<option value="${esc(c)}"></option>`).join('');
 const q=$('librarySearch').value.toLowerCase(),cat=$('categoryFilter').value;
 const list=foods.filter(f=>(cat==='All'||(f.category||'Custom')===cat)&&f.name.toLowerCase().includes(q));
 $('foodCount').textContent=foods.length+' foods';
 $('foodList').innerHTML=list.map(f=>{const i=foods.indexOf(f);return `<article class="library-item"><input class="food-select" type="checkbox" aria-label="Select ${esc(f.name)} for deletion" data-selectfood="${i}"><div class="library-item-main"><div class="library-item-info"><strong>${esc(f.name)}</strong><div class="library-item-meta">Per ${fmt(f.baseQty)} ${esc(f.unit)} <span>·</span> ${fmt(f.kcal)} kcal <span>·</span> P ${fmt(f.protein)} g <span>·</span> C ${fmt(f.carbs)} g <span>·</span> F ${fmt(f.fat)} g</div></div><div class="library-quantity-row"><div class="library-quantity">${quantityInput(f,i)}<span>${esc(f.unit)}</span></div><button class="btn smallbtn library-add" data-addfood="${i}">Add</button></div><div class="library-manage-row"><button class="btn ghost smallbtn" data-editfood="${i}">Edit</button><button class="btn danger smallbtn" data-deletefood="${i}">Delete</button></div></div></article>`}).join('')||'<div class="tiny muted">No matching foods.</div>';
 bindFoodActions($('foodList'));
 const updateSelection=()=>{const boxes=[...$('foodList').querySelectorAll('[data-selectfood]')],selected=boxes.filter(x=>x.checked).length,all=$('selectAllFoods');$('selectedFoodCount').textContent=selected+' selected';$('deleteSelectedFoods').disabled=selected===0;$('deleteSelectedFoods').textContent=`Delete selected (${selected})`;all.checked=boxes.length>0&&selected===boxes.length;all.indeterminate=selected>0&&selected<boxes.length;};
 $('foodList').querySelectorAll('[data-selectfood]').forEach(box=>box.addEventListener('change',updateSelection));
 $('selectAllFoods').checked=false;$('selectAllFoods').indeterminate=false;$('selectAllFoods').onchange=()=>{$('foodList').querySelectorAll('[data-selectfood]').forEach(box=>box.checked=$('selectAllFoods').checked);updateSelection()};
 updateSelection();
}
function newFoodId(){return 'food-'+Date.now()+'-'+Math.random().toString(36).slice(2,9)}
function openFoodEditor(i){
 const f=foods[i];if(!f)return;$('foodEditor').dataset.index=i;
 $('editName').value=f.name;$('editQty').value=f.baseQty;$('editUnit').value=f.unit;
 $('editCategory').value=f.category||'Custom';$('editBasis').value=f.basis||'';$('editKcal').value=f.kcal;$('editProtein').value=f.protein;$('editCarbs').value=f.carbs;$('editFat').value=f.fat;
 $('foodEditor').showModal();
}
function closeFoodEditor(){$('foodEditor').close()}
$('closeEditor').onclick=closeFoodEditor;$('cancelEditor').onclick=closeFoodEditor;
$('foodEditorForm').onsubmit=e=>{
 e.preventDefault();const i=Number($('foodEditor').dataset.index),f=foods[i];if(!f)return;
 const qty=num($('editQty').value),vals=['editKcal','editProtein','editCarbs','editFat'].map(id=>$(id).value);
 if(!$('editName').value.trim()||qty<=0||!$('editUnit').value.trim()||vals.some(v=>v===''||num(v)<0)){alert('Check the food name, serving quantity, unit and nutrition values.');return}
 foods[i]={...f,name:titleCase($('editName').value.trim()),baseQty:qty,unit:$('editUnit').value.trim(),category:$('editCategory').value.trim()||'Custom',basis:$('editBasis').value.trim(),kcal:num(vals[0]),protein:num(vals[1]),carbs:num(vals[2]),fat:num(vals[3])};
 save();closeFoodEditor();renderLibrary();renderConverterSelect();
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
$('deleteSelectedFoods').onclick=()=>{const selected=[...$('foodList').querySelectorAll('[data-selectfood]:checked')].map(box=>Number(box.dataset.selectfood)).filter(i=>Number.isInteger(i)&&foods[i]);if(!selected.length)return;selected.sort((a,b)=>b-a).forEach(i=>foods.splice(i,1));save();renderLibrary();renderConverterSelect();};
$('librarySearch').oninput=renderLibrary;$('categoryFilter').onchange=renderLibrary;
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
 return `<div class="foodrow"><div class="info"><strong>${esc(f.name)}</strong><div class="tiny">Per ${fmt(f.baseQty)} ${esc(f.unit)} · ${fmt(f.kcal)} kcal · P ${fmt(f.protein)} g · C ${fmt(f.carbs)} g · F ${fmt(f.fat)} g</div></div><div class="toolbar food-actions"><div class="qtyadd">${quantityInput(f,index)}<span>${esc(f.unit)}</span><button class="btn secondary smallbtn" data-addfood="${index}">Add</button></div></div></div>`;
}
function renderQuick(){
 const usage=foodUsage();
 const list=foods.map((f,index)=>({f,index,stats:usage.get(f.name.toLocaleLowerCase())||{count:0,last:0}}))
  .sort((a,b)=>b.stats.count-a.stats.count||b.stats.last-a.stats.last||a.index-b.index)
  .slice(0,5).map(x=>x.f);
 $('quickResults').innerHTML=list.map(f=>quickFoodRow(f,foods.indexOf(f))).join('')||'<div class="tiny muted">No foods in your library yet.</div>';
 bindFoodActions($('quickResults'));

}
function renderConverterSelect(){
 $('convertFood').innerHTML=foods.map(f=>`<option value="${f.id}">${esc(f.name)} — ${f.baseQty} ${esc(f.unit)}</option>`).join('');
 if(!converted&&foods.length)converted=foods[0].id;
 $('convertFood').value=converted||'';
 updateConverter();
}
function updateConverter(){
 const f=foods.find(x=>x.id===$('convertFood').value);if(!f)return;
 converted=f.id;
 // Do not repopulate the field while the user is clearing or editing it.
 const rawQty=$('convertQty').value;
 $('convertUnit').value=f.unit;
 $('baseInfo').textContent=`Base serving: ${fmt(f.baseQty)} ${f.unit} = ${fmt(f.kcal)} kcal · ${fmt(f.protein)} g protein · ${fmt(f.carbs)} g carbs · ${fmt(f.fat)} g fat`;
 if(rawQty.trim()===''){
  $('convertResult').textContent='Enter a quantity to calculate the macros.';
  $('addConverted').disabled=true;
  return;
 }
 const qty=num(rawQty);
 if(!Number.isFinite(qty)||qty<=0){
  $('convertResult').textContent='Enter a quantity greater than zero.';
  $('addConverted').disabled=true;
  return;
 }
 const factor=qty/f.baseQty;
 const v={kcal:f.kcal*factor,protein:f.protein*factor,carbs:f.carbs*factor,fat:f.fat*factor};
 $('convertResult').innerHTML=`<strong>${Math.round(v.kcal)} kcal</strong><div class="tiny">Protein ${fmt(v.protein)} g · Carbs ${fmt(v.carbs)} g · Fat ${fmt(v.fat)} g</div>`;
 $('addConverted').disabled=false;
}
$('convertFood').onchange=()=>{$('convertQty').value=foods.find(f=>f.id===$('convertFood').value)?.baseQty||1;updateConverter()};
$('convertQty').oninput=updateConverter;
$('addConverted').onclick=()=>{const f=foods.find(x=>x.id===$('convertFood').value),qty=num($('convertQty').value);if(f&&qty>0){addEntry(f,qty);setTab('diary')}};
$('saveCustom').onclick=()=>{
 const name=titleCase($('customName').value.trim()),qty=num($('customQty').value),unit=$('customUnit').value.trim()||'serve';
 const vals=['customKcal','customProtein','customCarbs','customFat'].map(id=>$(id).value);
 if(!name||qty<=0||vals.some(v=>v===''||num(v)<0)){alert('Enter a name, serving quantity and all four nutrition values.');return}
 const [kcal,protein,carbs,fat]=vals.map(num),f={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,baseQty:qty,unit,kcal,protein,carbs,fat,category:$('customCategory').value.trim()||'Custom',basis:$('customBasis').value.trim()};
 foods.push(f);save();['customName','customKcal','customProtein','customCarbs','customFat'].forEach(id=>$(id).value='');renderLibrary();alert('Food saved to your library.');
};
$('clearDay').onclick=()=>{if(confirm('Clear all entries for this day?')){logs[currentDate]=[];save();renderDiary()}};
function renderHistory(){
 const date=$('historyDate').value||currentDate,items=logs[date]||[],t=totals(items);
 $('historySummary').innerHTML=items.length?`<b>${date}</b><br>${items.length} entries · ${Math.round(t.kcal)} kcal<br>Protein ${fmt(t.protein)} g · Carbs ${fmt(t.carbs)} g · Fat ${fmt(t.fat)} g`:'No saved log for this date.';
}
$('historyDate').onchange=renderHistory;$('loadHistory').onclick=()=>{currentDate=$('historyDate').value||today();$('logDate').value=currentDate;setTab('diary');renderDiary()};
function download(name,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('exportJSON').onclick=()=>download('macro-ledger-backup.json',JSON.stringify({foods,logs},null,2),'application/json');
$('exportCSV').onclick=()=>{const rows=[['Date','Food','Quantity','Unit','Calories','Protein g','Carbs g','Fat g']];Object.entries(logs).forEach(([date,items])=>items.forEach(x=>rows.push([date,x.name,x.qty,x.unit,x.kcal,x.protein,x.carbs,x.fat])));const csv=rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');download('macro-ledger-history.csv',csv,'text/csv')};
function historyExportText(){const dates=Object.keys(logs).filter(date=>Array.isArray(logs[date])&&logs[date].length).sort();if(!dates.length)return "MK's Macro Ledger\n\nNo diary entries saved.";return ["MK's Macro Ledger — Food Diary Export",'',...dates.flatMap(date=>{const items=logs[date],t=totals(items);return [date,`${items.length} entries | ${Math.round(t.kcal)} kcal | Protein ${fmt(t.protein)} g | Carbs ${fmt(t.carbs)} g | Fat ${fmt(t.fat)} g`,'',...items.map(x=>`${x.name} — ${fmt(x.qty)} ${x.unit} | ${fmt(x.kcal)} kcal | P ${fmt(x.protein)} g | C ${fmt(x.carbs)} g | F ${fmt(x.fat)} g`),'','----------------------------------------','']})].join('\n')}
$('exportTXT').onclick=()=>download('macro-ledger-history.txt',historyExportText(),'text/plain;charset=utf-8');
$('exportPDF').onclick=()=>{const content=historyExportText(),printWindow=window.open('','_blank');if(!printWindow){alert('Please allow pop-ups for this site to create the PDF.');return;}const safe=esc(content);printWindow.document.open();printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Macro Ledger — Food Diary</title><style>body{font:12pt/1.5 Arial,sans-serif;color:#111;margin:24mm;white-space:pre-wrap}h1{font-size:18pt}@page{size:auto;margin:18mm}</style></head><body><h1>MK's Macro Ledger</h1><pre>${safe}</pre><script>window.onload=()=>{window.focus();window.print()}</script></body></html>`);printWindow.document.close();};
$('importJSON').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.foods)||typeof data.logs!=='object')throw Error();foods=data.foods;logs=data.logs;save();renderDiary();renderLibrary();alert('Backup restored.')}catch{alert('That file does not look like a Macro Ledger backup.')}e.target.value=''};

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


renderDiary();renderQuick();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
})();