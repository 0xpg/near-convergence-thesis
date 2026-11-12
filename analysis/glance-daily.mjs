import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const asOf='2026-11-12';
function canonicalDate(day){assert(/^\d{4}-\d{2}-\d{2}$/.test(day)&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day,'Invalid UTC date');return day;}
function retrievalDay(value){assert(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value),'Invalid Dune retrieval timestamp');canonicalDate(value.slice(0,10));const time=Date.parse(value);assert(Number.isFinite(time),'Invalid Dune retrieval timestamp');return canonicalDate(new Date(time).toISOString().slice(0,10));}
function completedCutoff(latest,cutoff){canonicalDate(latest);canonicalDate(cutoff);return [latest,new Date(Date.parse(cutoff+'T00:00:00Z')-86400000).toISOString().slice(0,10)].sort()[0];}
assert.equal(completedCutoff('2026-11-12','2026-11-12'),'2026-11-11','Exclude the partial UTC day');
assert.equal(completedCutoff('2026-11-03','2026-11-12'),'2026-11-03','Preserve an earlier observed cutoff');
assert.equal(completedCutoff('2026-12-01',retrievalDay('2026-12-01T15:00:00Z')),'2026-11-30','Future imports use their own completed UTC date');
assert.equal(retrievalDay('2026-11-13T01:00:00+07:00'),'2026-11-12','Normalize retrieval timestamps to UTC');
assert.throws(()=>retrievalDay('2026-02-30T00:00:00Z'),'Reject normalized invalid dates');
assert.throws(()=>retrievalDay('2026-11-12'),'Require a timezone-qualified retrieval timestamp');
const read=name=>JSON.parse(readFileSync(new URL('data/glance-sources/'+name,root),'utf8'));
const revenue=read('ir-revenue.json'),ecosystem=read('ir-ecosystem.json');
function series(chart,name){
 const matches=chart.series.filter(row=>row.name===name);assert.equal(matches.length,1,'Expected one '+name+' series');
 const values=matches[0].data;assert.equal(values.length,chart.dates.length,name+' date/value length');
 const result=new Map();
 chart.dates.forEach((day,index)=>{canonicalDate(day);assert(!result.has(day),'Duplicate '+name+' date');const value=values[index];assert(typeof value==='number'&&Number.isFinite(value)&&value>=0,'Invalid '+name+' on '+day);result.set(day,value);});
 return result;
}
const sources={volume:series(ecosystem.intents.volumeChart,'Daily Volume'),gross:series(revenue.fees.feesChart,'Intent Fees'),captured:series(revenue.revenue.revenueChart,'Intents Revenue'),price:series(ecosystem.tokenEconomics.priceChart,'Price'),swaps:series(ecosystem.intents.activityChart,'Daily Swaps'),transactions:series(ecosystem.ecosystem.txnsChart,'Transactions'),emissions:series(revenue.emissions.revenueVsEmissionsChart,'Daily Emissions'),totalRevenue:series(revenue.emissions.revenueVsEmissionsChart,'Daily Revenue')};
const dates=Object.values(sources).map(map=>[...map.keys()].sort());
const start=dates.map(days=>days[0]).sort().at(-1),end=completedCutoff(dates.map(days=>days.at(-1)).sort()[0],asOf);
assert(start&&end&&start<=end,'No overlapping source history');
const rows=[];
for(let time=Date.parse(start+'T00:00:00Z');time<=Date.parse(end+'T00:00:00Z');time+=86400000){
 const day=new Date(time).toISOString().slice(0,10);
 for(const [name,map] of Object.entries(sources))assert(map.has(day),'Missing '+name+' on '+day);
 const value=name=>sources[name].get(day),price=value('price');assert(price>0,'Nonpositive price');
 rows.push({day,volumeUsd:value('volume'),grossFeesUsd:value('gross')*price,capturedUsd:value('captured')*price,swaps:value('swaps'),transactions:value('transactions'),emissionsNear:value('emissions'),totalRevenueNear:value('totalRevenue')});
}
const manifest=JSON.parse(readFileSync(new URL('data/glance-sources/manifest.json',root),'utf8'));
const lineage=['ir-revenue.json','ir-ecosystem.json'].map(file=>{const entry=manifest.find(row=>row.file===file);assert(entry,'Missing source manifest');const sha256=createHash('sha256').update(readFileSync(new URL('data/glance-sources/'+file,root))).digest('hex');assert.equal(sha256,entry.sha256,'Changed input '+file);return {file:'data/glance-sources/'+file,url:entry.url,retrievedAt:entry.retrieved_utc,sha256};});
const output={version:'glance-daily-2026-11-12-v1',asOf,retrievedAt:lineage.map(source=>source.retrievedAt).sort()[0],sourceCutoff:end,queries:{intents:'https://dune.com/queries/9077358',revenue:'https://dune.com/queries/9077309',ecosystem:'https://dune.com/queries/9077345'},lineage,method:'Reconstructed from frozen public-provider inputs underlying the Dune queries. Daily NEAR amounts converted at the same-day provider price. Cash receipts and fee accrual dates differ. Common-lineage consistency is not independent verification.',rows};
const duneSource=new URL('data/glance-sources/glance-daily-dune.json',root);
if(existsSync(duneSource)){
 const payload=JSON.parse(readFileSync(duneSource,'utf8')),seen=new Set();assert(Array.isArray(payload.rows)&&payload.rows.length>0);
 const duneAsOf=retrievalDay(payload.retrievedAt);
 const number=(value,optional=false)=>{if(value===''||value==null){assert(optional,'Missing mandatory Dune value');return null;}assert(typeof value==='string'||typeof value==='number','Invalid Dune numeric type');const n=Number(value);assert(Number.isFinite(n)&&n>=0,'Invalid Dune numeric value');return n;};
 const duneRows=[];let missingSwapDates=0;
 for(const row of payload.rows){
  const day=canonicalDate(row.day.slice(0,10));assert(!seen.has(day),'Duplicate Dune date');seen.add(day);if(day>=duneAsOf)continue;
  for(const key of ['intents_source_rows','revenue_source_rows','ecosystem_source_rows'])assert.equal(number(row[key]),1,'Nonunique daily source');
  assert.equal(number(row.duplicate_metric_rows),0,'Duplicate source metrics');assert(number(row.price_usd)>0,'Missing price');
  const swaps=number(row.swaps,true);if(swaps===null)missingSwapDates++;
  duneRows.push({day,volumeUsd:number(row.volume_usd),grossFeesUsd:number(row.gross_fees_usd),capturedUsd:number(row.retained_usd),swaps,transactions:number(row.transactions,true),emissionsNear:number(row.emissions_near,true),totalRevenueNear:number(row.total_revenue_near,true)});
 }
 duneRows.sort((a,b)=>a.day.localeCompare(b.day));assert(duneRows.length>=30,'Insufficient daily history');
 for(let i=1;i<duneRows.length;i++)assert.equal(Date.parse(duneRows[i].day)-Date.parse(duneRows[i-1].day),86400000,'Missing Dune calendar date');
 output.asOf=duneAsOf;output.rows=duneRows;output.sourceCutoff=duneRows.at(-1).day;output.retrievedAt=payload.retrievedAt;output.queries.daily=payload.query;
 output.lineage=[{file:'data/glance-sources/glance-daily-dune.json',url:payload.query,retrievedAt:payload.retrievedAt,sha256:createHash('sha256').update(readFileSync(duneSource)).digest('hex')}];
 output.method='Executed Dune daily result snapshot, including explicit source-row quality. NEAR fee and receipt amounts converted at daily provider prices. Accrual and receipt timing differ. Missing optional counts remain null; financial outputs use complete financial inputs. Shared upstream lineage is not independent validation.';
 output.quality={missingSwapDates,financialDates:duneRows.length};
}
const target=new URL('data/glance-daily.json',root),serialized=JSON.stringify(output,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),serialized,'Daily snapshot is stale');
else writeFileSync(target,serialized);
console.log(`Validated ${output.rows.length} daily observations through ${output.sourceCutoff}; source hashes match.`);
