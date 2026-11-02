import {defaults, modelVersion, formulas, calculate} from './analysis/model.mjs';
const $ = id => document.getElementById(id);
const money = value => value === null ? 'Not computable' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(value);
const controls = [
 ['volumeGrowthPct','Annual volume growth','% per year · hypothetical',-100,500,.5],
 ['grossFeeBps','Gross service fee','Basis points · route mix can change',0,10000,.1],
 ['receiptSharePct','Wallet-receipt share','% of gross fees · historical proxy',0,100,.1],
 ['costSharePct','Additional costs','% of receipts · not already netted',0,100,.5],
 ['purchaseSharePct','NEAR purchase allocation','% after costs · Unverified · hypothetical',0,100,.5],
 ['retentionSharePct','Purchased tokens retained','% not subsequently distributed or resold',0,100,.5],
 ['issuancePct','Maximum annual issuance','% of snapshot supply · not realized growth',0,100,.1],
 ['priceUsd','Reference token price','USD · saved 25 Oct price, editable',.01,100000,.01],
 ['hurdlePct','Absorption hurdle','% of reference total value · analyst choice',0,100,.1],
 ['horizonYears','Compounding horizon','Years of volume growth · annual output',0,10,1]
];
async function loadJson(path){const response=await fetch(path);if(!response.ok)throw new Error('Saved data unavailable ('+response.status+')');return response.json();}
if($('model-controls')) {
let snapshot, lastResult, baseline={...defaults};
for (const [key,label,help,min,max,step] of controls) {
 const row=document.createElement('div'); row.className='control';
 const labelEl=document.createElement('label'); labelEl.htmlFor=key; labelEl.textContent=label;
 const small=document.createElement('small');small.id=key+'-help';small.textContent=help;labelEl.append(small);
 const input=document.createElement('input');Object.assign(input,{id:key,name:key,type:'number',required:true,min,max,step:'any',value:defaults[key]});input.setAttribute('aria-describedby',small.id);
 row.append(labelEl,input);$('model-controls').append(row);
}
for(const [name,formula] of Object.entries(formulas)){const dt=document.createElement('dt');dt.textContent=name;const dd=document.createElement('dd');dd.textContent=formula;$('formulas').append(dt,dd);}
function render(){
 if(!snapshot)return;
 if(!$('scenario-form').checkValidity()){ $('model-status').textContent='Enter a number within the displayed input limits. Results retain the last valid scenario.';$('model-status').className='error';$('export-model').disabled=true;return; }
 try{
 const inputs=Object.fromEntries(controls.map(([key])=>[key,Number($(key).value)]));lastResult=calculate(inputs,snapshot);
 const r=lastResult;
 $('retained').textContent=money(r.retainedPurchases);$('annual-volume').textContent=money(r.volume);$('gross-fees').textContent=money(r.grossFees);$('wallet-receipts').textContent=money(r.walletReceipts);$('absorption').textContent=r.absorptionPctOfValue.toFixed(3)+'%';$('required-volume').textContent=r.requiredVolume===null?'Undefined at zero capture':money(r.requiredVolume);$('issuance').textContent=new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(r.issuanceNear)+' NEAR';
 $('purchase-note').textContent=inputs.purchaseSharePct===0?'Purchase share is unknown. This default credits no unverified purchases; it does not assert measured zero.':'Hypothetical allocation: '+inputs.purchaseSharePct+'% of after-cost wallet receipts, with '+inputs.retentionSharePct+'% retained. No holder entitlement is assumed.';
 $('version-line').textContent='Snapshot '+snapshot.snapshotVersion+' · Model '+modelVersion+' · Price reference 25 Oct 2026';
 $('model-status').textContent='Shared engine ready. All results below are hypothetical annual operating scales; source snapshot is unchanged.';$('model-status').className='';$('export-model').disabled=false;
 }catch(error){$('model-status').textContent='Cannot calculate this scenario: '+error.message;$('model-status').className='error';$('export-model').disabled=true;}
}
$('scenario-form').addEventListener('submit',event=>event.preventDefault());
$('scenario-form').addEventListener('input',()=>{document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));render();});
$('scenario-form').addEventListener('reset',event=>{event.preventDefault();for(const [key]of controls)$(key).value=baseline[key];document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset==='unverified')));render();});
const presetChanges={unverified:{},partial:{purchaseSharePct:50,costSharePct:20,retentionSharePct:50},stress:{grossFeeBps:8,purchaseSharePct:50,costSharePct:40,retentionSharePct:50}};
document.querySelectorAll('[data-preset]').forEach(button=>{button.setAttribute('aria-pressed',String(button.dataset.preset==='unverified'));button.addEventListener('click',()=>{for(const [key,value]of Object.entries({...baseline,...presetChanges[button.dataset.preset]}))$(key).value=value;document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();});});
$('export-model').disabled=true;$('export-model').addEventListener('click',()=>{if(!lastResult)return;const result={exportedAt:new Date().toISOString(),note:'Hypothetical scenario, not a price target. Purchases and retention are not measured.',snapshot, ...lastResult};const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='near-scenario-'+modelVersion+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});

loadJson('data/inputs.json').then(data=>{snapshot=data;baseline=calculate({},snapshot).inputs;for(const [key]of controls)$(key).value=baseline[key];render();}).catch(()=>{$('model-status').textContent='The saved model inputs could not be loaded. Refresh this page from the local server; the report and source downloads remain available.';$('model-status').className='error';document.querySelectorAll('#scenario-form input,#scenario-form button').forEach(x=>x.disabled=true);});
}
if($('monthly-table')) loadJson('data/outputs.json').then(data=>{const fragment=document.createDocumentFragment();for(const row of data.monthly){const tr=document.createElement('tr');for(const value of [row.month,money(row.volume),money(row.grossFees),money(row.walletReceipts)]){const td=document.createElement('td');td.textContent=value;tr.append(td);}fragment.append(tr);}$('monthly-table').replaceChildren(fragment);}).catch(()=>{$('monthly-table').textContent='Saved table unavailable. Download the CSV directly from the link below.';});
if($('load-dune')) $('load-dune').addEventListener('click',()=>{const iframe=document.createElement('iframe');iframe.title='External NEAR economic monitor on Dune';iframe.src='https://dune.com/embeds/9019417/13064021';iframe.loading='lazy';iframe.referrerPolicy='no-referrer';$('dune-frame').replaceChildren(iframe);$('load-dune').disabled=true;$('dune-status').textContent='Loading the external Intents daily-volume chart. It uses publisher definitions and a different cutoff. If blank, blocked or unavailable, use Open dashboard or the saved snapshots. Embedding cannot verify freshness or query success.';iframe.addEventListener('load',()=>{$('dune-status').textContent='External frame returned; its contents and last successful execution are controlled by Dune. If blank, blocked or stale, open the dashboard directly or use the saved data. Reported volume does not measure retained customers.';});iframe.addEventListener('error',()=>{$('dune-status').textContent='External dashboard could not load. The saved CSV, figures and report remain available.';});});

if($('current-observation')) loadJson('data/current.json').then(data=>{$('current-observation').textContent='Latest verified observation: $'+data.priceUsd.toFixed(2)+' · '+data.priceUpdatedUtc.replace('T',' ').replace('+00:00',' UTC')+'. Cached, not streaming. The scenario baseline retains the $4.44 historical reference.';}).catch(()=>{$('current-observation').textContent='Latest quote unavailable. Historical research and model reference remain accessible.';});
if($('claim-ledger')) loadJson('data/research.json').then(data=>{const fragment=document.createDocumentFragment();for(const claim of data.claims){const article=document.createElement('article');article.className='claim-record';const title=document.createElement('h4');title.textContent=claim.title;article.append(title);for(const [label,value]of [['Claim',claim.claim],['Method',claim.method],['Limitations',claim.limitations],['Potential falsifier',claim.falsifier]]){const p=document.createElement('p');const strong=document.createElement('strong');strong.textContent=label+': ';p.append(strong,document.createTextNode(value));article.append(p);}const sourceLine=document.createElement('p');sourceLine.textContent='Sources: ';for(const id of claim.sources){const source=data.sources.find(x=>x.id===id);if(!source)continue;const a=document.createElement('a');a.textContent=source.title;const url=new URL(source.url,location.href);if(url.protocol==='https:')a.href=url.href;sourceLine.append(a,document.createTextNode(' · '));}article.append(sourceLine);fragment.append(article);}$('claim-ledger').replaceChildren(fragment);}).catch(()=>{$('claim-ledger').textContent='The ledger could not be loaded. Open the research JSON directly using the download link.';});

