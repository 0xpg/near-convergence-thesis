import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const here=new URL('./',import.meta.url),root=new URL('../../',here);
const read=file=>JSON.parse(readFileSync(new URL(file,here),'utf8'));
const table=value=>value.rows.map(row=>Object.fromEntries(value.columns.map((key,i)=>[key,row[i]])));
const raw=read('overview-results.json'),seen=new Set();
const facts=table(raw).map(row=>{
 const key=row.category+'/'+row.metric;assert(!seen.has(key),'Duplicate finding');seen.add(key);
 const value=row.value===''||row.value==null?null:Number(row.value);assert(value===null||(Number.isFinite(value)&&value>=0),'Invalid finding value');
 const start=row.first_day.slice(0,10),end=row.last_day.slice(0,10);
 for(const day of [start,end])assert(/^\d{4}-\d{2}-\d{2}$/.test(day)&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day,'Invalid UTC date');
 assert(start<=end);return {category:row.category,metric:row.metric,value,unit:row.unit,start,end,interpretation:row.interpretation};
});
const fact=name=>{const rows=facts.filter(row=>row.metric===name);assert.equal(rows.length,1,'Finding must resolve uniquely: '+name);return rows[0];};
const native=table(read('native/activity-result.json'));
assert.equal(native.length,30);assert.equal(new Set(native.map(row=>row.day)).size,30);
const nativeDates=native.map(row=>row.day.slice(0,10)).sort();
assert.equal(Date.parse(nativeDates.at(-1))-Date.parse(nativeDates[0]),29*86_400_000,'Native calendar must be consecutive');
assert.equal(nativeDates[0],fact('Average daily successful execution hashes').start);
assert.equal(nativeDates.at(-1),fact('Average daily successful execution hashes').end);
const numeric=value=>{assert(value!==''&&value!=null,'Missing required numerical input');const number=Number(value);assert(Number.isFinite(number)&&number>=0,'Invalid required numerical input');return number;};
const avg=key=>native.reduce((sum,row)=>sum+numeric(row[key]),0)/native.length;
assert(Math.abs(avg('successful_execution_hashes')-fact('Average daily successful execution hashes').value)<1e-6,'Native daily/hash reconciliation');
assert(Math.abs(avg('active_originating_accounts')-fact('Average daily originating accounts').value)<1e-6,'Native originator reconciliation');
assert(native.every(row=>numeric(row.missing_hash_groups)===0&&numeric(row.inconsistent_originator_groups)===0));
const genesis=table(read('token/genesis-result.json'));
assert.equal(genesis.reduce((sum,row)=>sum+Number(row.genesis_near),0),1e9,'Genesis allocation must sum to 1bn');
assert(Math.abs(genesis.reduce((sum,row)=>sum+Number(row.genesis_share_pct),0)-100)<1e-9);
const f=fact('30D reported gross fees'),v=fact('30D reported priced volume');
assert.equal(f.start,v.start);assert.equal(f.end,v.end,'Cohort fees and volume need aligned periods');
const feeShare=fact('Confidential share of reported gross fees').value,volumeShare=fact('Confidential share of reported priced volume').value;
for(const share of [feeShare,volumeShare])assert(share===null||(share>=0&&share<=100));
const rate=(fees,volume)=>fees===null||volume===null||volume===0?null:1e4*fees/volume;
const confidentialBps=rate(f.value===null||feeShare===null?null:f.value*feeShare/100,v.value===null||volumeShare===null?null:v.value*volumeShare/100);
const publicBps=rate(f.value===null||feeShare===null?null:f.value*(1-feeShare/100),v.value===null||volumeShare===null?null:v.value*(1-volumeShare/100));
const sources=[
 ['Native status audit','9116090',null],['Filtered native activity','9116129',['13169353','13169359']],
 ['Full-history reported Intents volume','9115683',['13167168']],['Official-method gross fees','9117854',['13169471']],
 ['Non-overlapping priced Intents balances','9117785',['13169372']],['Filtered stablecoin transfers','9117819',['13169462']],
 ['Circulating stablecoin supply','9117903',['13169493']],['Historical announced allocation','9117913',['13169510']],
 ['Re-runnable findings','9117970',null]
].map(([name,id,visualizations])=>({name,query:'https://dune.com/queries/'+id,visualizations,visibility:'Public verified in Dune UI'}));
const coverage=[
 {metric:'Transactions',status:'Implemented: provider history plus raw 30D audit',filters:'Accepted parent status; successful receipt flag; distinct day/hash cohorts; missing IDs checked. Daily hashes can recur across dates.'},
 {metric:'Active accounts',status:'Implemented with explicit account definition',filters:'Distinct originating tx_from accounts in successful hash cohorts. Relayers, bots and contracts remain; not verified people or summed monthly unique users.'},
 {metric:'Stablecoin supply',status:'Implemented: provider circulation by USDC/USDT/other',filters:'Completed UTC days; source-date uniqueness; finite nonnegative USD; category reconciliation; unreleased issuer inventory excluded. Exact native/bridged supply decomposition not established.'},
 {metric:'Stablecoin transfer volume',status:'Implemented: 30D current-roster nominal movement; USD coverage partial',filters:'17 verified current contracts; positive ft_transfer leg; successful statuses; no mint, burn or self-transfer; event-key ambiguity guards; exact token/day price join. Missing USD groups withheld; refunds and custody remain.'},
 {metric:'Intents volume',status:'Implemented: full available reported priced history',filters:'Completed days; token-key diagnostics; finite nonnegative amounts; separate positive unpriced, sparse and invalid fields. Missing USD not backfilled; order-leg convention follows provider.'},
 {metric:'Intents gross fees',status:'Implemented: full reported component history',filters:'Protocol and affiliate components; finite nonnegative amounts; missing fee rows exposed. Protocol public assignment follows official query6162606 reporting convention; accrual differs from receipts.'},
 {metric:'Intents TVL/balances',status:'Implemented: reported priced custody balances',filters:'Day/source/token_id grain; duplicate balance keys block totals; invalid values withheld. Raw public is total, confidential is subtracted for public-only; unsplit history stays explicit. Positive unpriced balances remain outside priced subtotal.'},
 {metric:'Token allocation',status:'Implemented: historical 1bn genesis allocation',filters:'Seven announced categories with backers combined; sum and percentages checked; no future reward projection, current ownership or assumed 2035 supply.'},
 {metric:'Executed buybacks',status:'Not established; no purchase series published',filters:'Cash receipts, withdrawals, custody, purchases and burns remain distinct. A wallet label or withdrawal does not prove an acquisition.'}
];
const files=['overview-results.json','native/activity-result.json','token/genesis-result.json'];
const executions=read('execution-manifest.json').executed;
assert.equal(new Set(executions.map(row=>row.query)).size,executions.length,'Unique source query contracts');
for(const row of executions){
 assert(/^[\w/-]+\.sql$/.test(row.file)&&!row.file.includes('..'),'Source path must stay within the research directory');
 assert.equal(createHash('sha256').update(readFileSync(new URL(row.file,here))).digest('hex'),row.localSourceSha256,'Local SQL changed since execution: '+row.file);
}
const output={version:'near-overview-coverage-2026-11-12-v1',generatedFromSavedDuneResults:true,automaticUpstreamRefresh:false,dashboard:'https://dune.com/0xpanatagama/near-economic#activity-liquidity-token-demand',dashboardCharts:37,sources,coverage,facts,derived:{period:{start:f.start,end:f.end},confidentialReportedGrossFeeBps:confidentialBps,publicReportedGrossFeeBps:publicBps,interpretation:'Aligned reported cohort fees divided by reported notional. Accounting/mix comparison, not quoted execution fees, causal pricing power or tokenholder yield.'},lineage:files.map(file=>({file:'analysis/coverage-expansion/'+file,sha256:createHash('sha256').update(readFileSync(new URL(file,here))).digest('hex')}))};
const target=new URL('data/glance-coverage.json',root),serialized=JSON.stringify(output,null,2)+'\n';
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),serialized,'Coverage artifact is stale');else writeFileSync(target,serialized);
console.log(JSON.stringify({checks:'source dates, unique facts, native daily/finding arithmetic reconciliation, historical allocation sums, aligned cohort rates',confidentialReportedGrossFeeBps:confidentialBps,publicReportedGrossFeeBps:publicBps}));
