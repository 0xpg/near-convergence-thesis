import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=file=>JSON.parse(readFileSync(new URL(file,root),'utf8'));
const hash=file=>createHash('sha256').update(readFileSync(new URL(file,root))).digest('hex');
const close=(a,b)=>assert(Math.abs(a-b)<=Math.max(1e-8,Math.abs(b)*1e-12),'Source value does not reconcile');
const day=value=>{assert(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value));assert.equal(new Date(value+'T00:00:00Z').toISOString().slice(0,10),value);return value;};
const amount=value=>{assert((typeof value==='number'||typeof value==='string')&&String(value).trim()!=='','Missing numeric source');const n=Number(value);assert(Number.isFinite(n)&&n>=0,'Invalid numeric source');return n;};
const daily=read('data/glance-daily.json');
assert.equal(daily.lineage.length,1,'Expected the executed Dune source');
const lineage=daily.lineage[0];assert.equal(hash(lineage.file),lineage.sha256,'Dune input hash changed');
const executed=read(lineage.file);
assert.equal(executed.query,daily.queries.daily);
const source=new Map();
for(const row of executed.rows){const date=day(row.day.slice(0,10));assert(!source.has(date),'Duplicate Dune date');source.set(date,row);}
const financialKeys={volumeUsd:'volume_usd',grossFeesUsd:'gross_fees_usd',capturedUsd:'retained_usd'};
assert(daily.rows.length>=90);
for(let i=0;i<daily.rows.length;i++){
  const row=daily.rows[i],date=day(row.day),raw=source.get(date);assert(raw,'Missing executed date');
  if(i)assert.equal(Date.parse(date)-Date.parse(daily.rows[i-1].day),86400000,'Missing calendar date');
  assert(date<new Date(executed.retrievedAt).toISOString().slice(0,10),'Partial day');
  for(const key of ['intents_source_rows','revenue_source_rows','ecosystem_source_rows'])assert.equal(amount(raw[key]),1,'Nonunique daily source');
  assert.equal(amount(raw.duplicate_metric_rows),0,'Duplicated source metrics');
  for(const [key,column] of Object.entries(financialKeys))close(amount(row[key]),amount(raw[column]));
}
assert.equal(daily.sourceCutoff,daily.rows.at(-1).day);
function aggregate(rows,days){
  assert.equal(rows.length,days);assert.equal(Date.parse(rows.at(-1).day)-Date.parse(rows[0].day),(days-1)*86400000,'Incomplete analysis window');
  const sums=Object.fromEntries(Object.keys(financialKeys).map(key=>[key,rows.reduce((sum,row)=>sum+amount(row[key]),0)]));
  assert(sums.volumeUsd>0&&sums.grossFeesUsd>0&&sums.capturedUsd<=sums.grossFeesUsd,'Invalid aggregate financial relationship');
  return {days,start:rows[0].day,end:rows.at(-1).day,...sums,grossBps:sums.grossFeesUsd/sums.volumeUsd*10000,cashCapturePct:sums.capturedUsd/sums.grossFeesUsd*100,capturedBps:sums.capturedUsd/sums.volumeUsd*10000,annualizedCapturedUsd:sums.capturedUsd*365/days};
}
const windows=[30,90].map(days=>aggregate(daily.rows.slice(-days),days));
assert.throws(()=>amount(null));assert.throws(()=>amount(''));assert.throws(()=>amount(true));assert.throws(()=>day('2026-02-30'));
assert.throws(()=>aggregate(daily.rows.slice(-29),30));
for(const window of windows){close(window.volumeUsd*window.grossBps/10000,window.grossFeesUsd);close(window.grossFeesUsd*window.cashCapturePct/100,window.capturedUsd);}
const rpcPath='analysis/lab-sources/',rpc=read(rpcPath+'manifest.json');
assert.equal(new URL(rpc.endpoint).protocol,'https:');
for(const request of rpc.requests){assert(['block.json','protocol.json'].includes(request.file));assert.equal(hash(rpcPath+request.file),request.sha256,'RPC source changed');}
const block=read(rpcPath+'block.json').result.header,protocol=read(rpcPath+'protocol.json').result;
assert.equal(block.height,rpc.blockHeight);assert.equal(block.hash,rpc.blockHash);assert.equal(block.total_supply,rpc.totalSupplyYocto);
assert.equal(protocol.protocol_version,rpc.protocolVersion);
assert.deepEqual(protocol.max_inflation_rate,rpc.maximumInflationRate);
const configRequest=rpc.requests.find(row=>row.method==='EXPERIMENTAL_protocol_config');assert.equal(configRequest.params.block_id,block.height,'Protocol config must be pinned to the supply block');
const yocto=BigInt(block.total_supply),scale=10n**24n;
const exactSupply=(yocto/scale)+'.'+(yocto%scale).toString().padStart(24,'0');
const supplyNear=amount(exactSupply);assert(supplyNear>0);
const [numerator,denominator]=protocol.max_inflation_rate;assert(Number.isSafeInteger(numerator)&&Number.isSafeInteger(denominator)&&denominator>0);
const blockUtc=new Date(Number(BigInt(block.timestamp_nanosec)/1000000n)).toISOString();
const quote=source.get(daily.sourceCutoff);const priceUsd=amount(quote.price_usd);assert(priceUsd>0);const priceDate=daily.sourceCutoff;
const monthTotals=new Map();
for(const row of daily.rows){const key=row.day.slice(0,7),entry=monthTotals.get(key)||{month:key,days:0,volumeUsd:0,grossFeesUsd:0};entry.days++;entry.volumeUsd+=amount(row.volumeUsd);entry.grossFeesUsd+=amount(row.grossFeesUsd);monthTotals.set(key,entry);}
const fullMonths=[...monthTotals.values()].filter(m=>m.days===new Date(Date.UTC(Number(m.month.slice(0,4)),Number(m.month.slice(5,7)),0)).getUTCDate());
assert(fullMonths.length>=10,'Need ten complete months for growth benchmarks');
for(let i=1;i<fullMonths.length;i++){const [y,m]=fullMonths[i-1].month.split('-').map(Number);assert.equal(fullMonths[i].month,new Date(Date.UTC(y,m,1)).toISOString().slice(0,7),'Complete months must be consecutive');}
const perDay=m=>m.volumeUsd/m.days,lastMonth=fullMonths.at(-1);
const growth=[3,6,9].map(intervals=>{const first=fullMonths.at(-1-intervals);return {intervals,start:first.month,end:lastMonth.month,startDailyVolumeUsd:perDay(first),endDailyVolumeUsd:perDay(lastMonth),monthlyGrowthPct:((perDay(lastMonth)/perDay(first))**(1/intervals)-1)*100};});
const feeMonths=fullMonths.map(m=>({month:m.month,grossBps:m.grossFeesUsd/m.volumeUsd*10000}));
const benchPath='analysis/lab-sources/benchmarks/',bench=read(benchPath+'manifest.json');
for(const request of bench.requests)assert.equal(hash(benchPath+request.file),request.sha256,'Benchmark source changed');
const caps=read(benchPath+'defillama-mcaps.json');
const multiples=bench.requests.filter(r=>r.slug).map(r=>{const body=read(benchPath+r.file),cap=caps['coingecko:'+body.gecko_id];assert(cap&&cap.mcap>0,'Missing market cap '+r.slug);const revenue=amount(body.total1y);assert(revenue>0);return {name:{tron:'TRON',near:'NEAR'}[r.slug]??body.name,slug:r.slug,marketCapUsd:cap.mcap,revenue365dUsd:revenue,multiple:cap.mcap/revenue,url:'https://defillama.com/protocol/'+r.slug};}).sort((a,b)=>a.multiple-b.multiple);
const benchmarks={growth:{source:daily.queries.daily,method:'Compound monthly growth of average daily Intents volume between complete calendar months.',windows:growth,fees:feeMonths},multiples:{retrievedAt:bench.retrievedAt,provider:bench.provider,method:'Market capitalization divided by trailing 365-day DefiLlama revenue.',rows:multiples}};
const sources=[
  {file:'data/glance-daily.json',sha256:hash('data/glance-daily.json'),url:daily.queries.daily,cutoff:daily.sourceCutoff},
  {...lineage},
  {file:rpcPath+'manifest.json',sha256:hash(rpcPath+'manifest.json'),url:rpc.endpoint,cutoff:blockUtc},
  ...rpc.requests.map(request=>({file:rpcPath+request.file,sha256:request.sha256,url:rpc.endpoint,method:request.method,params:request.params,cutoff:blockUtc})),
  ...bench.requests.map(request=>({file:benchPath+request.file,sha256:request.sha256,url:request.url,cutoff:bench.retrievedAt})),

];
const output={version:'near-lab-'+hash('data/glance-daily.json').slice(0,12)+'-'+block.height,modelStatus:'Measured historical starting observations; every projection and discretionary policy remains an assumption.',operating:{sourceCutoff:daily.sourceCutoff,defaultDays:30,windows},market:{priceUsd,sourceDate:priceDate,url:daily.queries.daily,status:'Dated reference quote; not a live price or synchronized operating cutoff.'},supply:{supplyNear,exactSupplyNear:exactSupply,issuancePct:numerator/denominator*100,blockHeight:block.height,blockHash:block.hash,blockUtc,protocolVersion:protocol.protocol_version,url:rpc.endpoint,status:'Finalized total native supply; annual issuance is the protocol maximum, not measured future issuance or circulating supply.'},benchmarks,sources,limitations:[
  'Captured Intents receipts are cash observations, not accrued net income, a verified partner payout residual or legally enforceable tokenholder distributions.',
  'Daily fees and receipts have different collection timing. Ratios of matched window sums are descriptive; they do not identify a contractual take rate.',
  '30-day and 90-day annualization describe scale, not a forecast. Projection assumptions are separate from these observed inputs.',
  'Total supply, reference quote and operating observations have separate timestamps; this is not a synchronized valuation mark.',
  'Gas burn is excluded from the default receipt denominator and supply offset; the existing provider classification is not a canonical, protocol-version-reconciled burn series.',
  'Solver identities, institutional-versus-agent attribution, route-specific economics, operating costs and future buyback or retirement policy are not identified by this baseline.',
  'Dune and provider observations share upstream lineage; their agreement is not independent verification. Rerunning this builder validates the archived snapshot and does not ingest new upstream data.'
]};
const encoded=JSON.stringify(output,null,2)+'\n',target=new URL('data/lab-baseline.json',root);
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),encoded,'Lab baseline is stale');else writeFileSync(target,encoded);
console.log(JSON.stringify({checks:'Source hashes, exact dated windows, Dune row reconciliation, positive finite inputs, matched ratio-of-sums, pinned RPC supply/config and archived quote',windows,supply:output.supply,market:output.market}));
