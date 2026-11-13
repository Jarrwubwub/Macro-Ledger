(()=>{
const $=id=>document.getElementById(id), today=()=>new Date().toLocaleDateString('en-CA');
const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
let foods=load('macroFoods',window.DEFAULT_FOODS).map((f,i)=>({...f,id:f.id??`food-${i}`}));
let logs=load('macroLogs',{});
let currentDate=today(), converted=null;
const num=(v)=>Number(v)||0, fmt=(v)=>Number(v.toFixed(1)).toString();
const totals=items=>items.reduce((a,x)=>({kcal:a.kcal+x.kcal,protein:a.protein+x.protein,carbs:a.carbs+x.carbs,fat:a.fat+x.fat}),{kcal:0,protein:0,carbs:0,fat:0});
const save=()=>{localStorage.setItem('macroFoods',JSON.stringify(foods));localStorage.setItem('macroLogs',JSON.stringify(logs))};
const entries=()=>logs[currentDate]||[];
function addEntry(food,qty=food.baseQty,unit=food.unit){
 const factor=qty/food.baseQty;
 const entry={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),name:food.name,qty,unit,kcal:food.kcal*factor,protein:food.protein*factor,carbs:food.carbs*factor,fat:food.fat*factor};
 logs[currentDate]=[...entries(),entry];save();renderDiary();
}
function setTab(tab){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));['diary','library','converter','history'].forEach(id=>$(id).classList.toggle('hide',id!==tab));if(tab==='library')renderLibrary();if(tab==='converter')renderConverterSelect();if(tab==='history')renderHistory()}
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('goLibrary').onclick=()=>setTab('library');
$('logDate').value=currentDate;$('historyDate').value=currentDate;
$('logDate').onchange=e=>{currentDate=e.target.value||today();renderDiary()};
function renderDiary(){
 const t=totals(entries()), macro=t.protein*4+t.carbs*4+t.fat*9, diff=t.kcal-macro;
 $('totalKcal').textContent=Math.round(t.kcal).toLocaleString();$('totalProtein').textContent=fmt(t.protein)+' g';$('totalCarbs').textContent=fmt(t.carbs)+' g';$('totalFat').textContent=fmt(t.fat)+' g';
 $('proteinProgress').style.width=Math.min(100,t.protein/200*100)+'%';$('proteinProgressLabel').textContent=fmt(t.protein)+' / 200 g';
 $('macroCalories').textContent=Math.round(macro)+' kcal';$('difference').textContent=(diff>0?'+':'')+Math.round(diff)+' kcal';$('entryCount').textContent=entries().length;
 const notice=$('discrepancy');notice.classList.toggle('hide',entries().length===0||Math.abs(diff)<25);notice.textContent=`Your supplied food calories differ from calories calculated from macros by ${Math.round(diff)} kcal. Supplied calorie values are preserved.`;
 $('diaryEntries').innerHTML=entries().length?entries().map(x=>`<div class="entry"><div><b>${esc(x.name)}</b><div class="tiny">${fmt(x.qty)} ${esc(x.unit)} · ${Math.round(x.kcal)} kcal · P ${fmt(x.protein)} · C ${fmt(x.carbs)} · F ${fmt(x.fat)}</div></div><button class="btn danger smallbtn" data-remove="${x.id}">Remove</button></div>`).join(''):'<div class="muted tiny">No foods logged yet.</div>';
 $('diaryEntries').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{logs[currentDate]=entries().filter(x=>x.id!==b.dataset.remove);save();renderDiary()});
 $('clearDay').disabled=!entries().length;
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function foodRow(f,button=true){return `<div class="foodrow"><div class="info"><strong>${esc(f.name)}</strong><div class="tiny">${f.baseQty} ${esc(f.unit)} · ${f.kcal} kcal · P ${f.protein} g · C ${f.carbs} g · F ${f.fat} g</div><span class="pill">${esc(f.category||'Custom')}</span></div>${button?`<button class="btn secondary smallbtn" data-addfood="${f.id}">Add</button>`:''}</div>`}
function renderLibrary(){
 const cats=['All',...new Set(foods.map(f=>f.category||'Custom'))], old=$('categoryFilter').value||'All';
 $('categoryFilter').innerHTML=cats.map(c=>`<option>${esc(c)}</option>`).join('');$('categoryFilter').value=cats.includes(old)?old:'All';
 const q=$('librarySearch').value.toLowerCase(),cat=$('categoryFilter').value;
 const list=foods.filter(f=>(cat==='All'||(f.category||'Custom')===cat)&&f.name.toLowerCase().includes(q));
 $('foodCount').textContent=foods.length+' foods';
 $('foodList').innerHTML=list.map(f=>foodRow(f)).join('')||'<div class="tiny muted">No matching foods.</div>';
 $('foodList').querySelectorAll('[data-addfood]').forEach(b=>b.onclick=()=>{const f=foods.find(x=>x.id===b.dataset.addfood);addEntry(f);setTab('diary')});
}
$('librarySearch').oninput=renderLibrary;$('categoryFilter').onchange=renderLibrary;
function renderQuick(){
 const q=$('quickSearch').value.toLowerCase(),list=foods.filter(f=>f.name.toLowerCase().includes(q)).slice(0,7);
 $('quickResults').innerHTML=list.map(f=>foodRow(f)).join('');
 $('quickResults').querySelectorAll('[data-addfood]').forEach(b=>b.onclick=()=>{const f=foods.find(x=>x.id===b.dataset.addfood);addEntry(f)});
}
$('quickSearch').oninput=renderQuick;
function renderConverterSelect(){
 $('convertFood').innerHTML=foods.map(f=>`<option value="${f.id}">${esc(f.name)} — ${f.baseQty} ${esc(f.unit)}</option>`).join('');
 if(!converted&&foods.length)converted=foods[0].id;
 $('convertFood').value=converted||'';
 updateConverter();
}
function updateConverter(){
 const f=foods.find(x=>x.id===$('convertFood').value);if(!f)return;
 converted=f.id;$('convertQty').value=$('convertQty').value||f.baseQty;$('convertUnit').value=f.unit;$('baseInfo').textContent=`Base serving: ${f.baseQty} ${f.unit} = ${f.kcal} kcal · ${f.protein} g protein · ${f.carbs} g carbs · ${f.fat} g fat`;
 const qty=num($('convertQty').value),factor=qty/f.baseQty;
 const v={kcal:f.kcal*factor,protein:f.protein*factor,carbs:f.carbs*factor,fat:f.fat*factor};
 $('convertResult').innerHTML=`<strong>${Math.round(v.kcal)} kcal</strong><div class="tiny">Protein ${fmt(v.protein)} g · Carbs ${fmt(v.carbs)} g · Fat ${fmt(v.fat)} g</div>`;
 $('addConverted').disabled=qty<=0;
}
$('convertFood').onchange=()=>{$('convertQty').value=foods.find(f=>f.id===$('convertFood').value)?.baseQty||1;updateConverter()};
$('convertQty').oninput=updateConverter;
$('addConverted').onclick=()=>{const f=foods.find(x=>x.id===$('convertFood').value),qty=num($('convertQty').value);if(f&&qty>0){addEntry(f,qty);setTab('diary')}};
$('saveCustom').onclick=()=>{
 const name=$('customName').value.trim(),qty=num($('customQty').value),unit=$('customUnit').value.trim()||'serve';
 const vals=['customKcal','customProtein','customCarbs','customFat'].map(id=>$(id).value);
 if(!name||qty<=0||vals.some(v=>v===''||num(v)<0)){alert('Enter a name, serving quantity and all four nutrition values.');return}
 const [kcal,protein,carbs,fat]=vals.map(num),f={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),name,baseQty:qty,unit,kcal,protein,carbs,fat,category:'Custom'};
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
$('importJSON').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.foods)||typeof data.logs!=='object')throw Error();foods=data.foods;logs=data.logs;save();renderDiary();renderLibrary();alert('Backup restored.')}catch{alert('That file does not look like a Macro Ledger backup.')}e.target.value=''};
renderDiary();renderQuick();
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
})();