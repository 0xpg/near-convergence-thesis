import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

const here=new URL('./',import.meta.url),root=new URL('../../',here);
const chartIds=['fee-productivity','public-participation','public-pairs','public-patterns'];
const files=['fee-productivity-result.json','public-participation-result.json','public-pairs-result.json','reverse-pattern-result.json'];
const missing=value=>value==null||value===''||value==='null'||value==='NULL';
function number(value,name,{nullable=false,integer=false}={}){
 if(missing(value)){assert(nullable,'Missing '+name);return null;}
 assert(typeof value==='number'||typeof value==='string','Invalid numeric type '+name);
 const text=String(value).trim();
 assert(/^[+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text),'Invalid numerical input '+name+': '+text);
 const parsed=Number(text);assert(Number.isFinite(parsed)&&parsed>=0&&(!integer||Number.isSafeInteger(parsed)),'Invalid '+name);return parsed;
}
function day(value){
 assert(typeof value==='string','Missing date');const date=value.slice(0,10);
 assert(/^\d{4}-\d{2}-\d{2}$/.test(date)&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date,'Invalid UTC date');return date;
}
const equal=(a,b,label)=>{if(a===null||b===null)assert.equal(a,b,label);else assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1e-7,Math.abs(b)*1e-9),label);};
const sum=(rows,key)=>rows.reduce((total,row)=>total===null||row[key]===null?null:total+row[key],0);
const share=(a,b)=>a===null||b===null||b===0?null:100*a/b;
function table(raw,required){
 assert(/^https:\/\/dune\.com\/queries\/\d+$/.test(raw.query),'Invalid source query');
 assert(typeof raw.retrievedAt==='string'&&Number.isFinite(Date.parse(raw.retrievedAt))&&/Z$/.test(raw.retrievedAt),'UTC retrieval timestamp required');
 assert(Array.isArray(raw.rows)&&raw.rows.length>1,'Source table is missing or empty');const [headers,...rows]=raw.rows;
 assert(Array.isArray(headers)&&new Set(headers).size===headers.length,'Unique source columns required');
 for(const key of required)assert(headers.includes(key),'Missing source column '+key);
 return rows.map(row=>{assert(Array.isArray(row)&&row.length===headers.length,'Source row width mismatch');return Object.fromEntries(headers.map((name,i)=>[name,row[i]]));});
}
function calendar(rows,expected){
 assert.equal(rows.length,expected,'Unexpected daily row count');rows.sort((a,b)=>a.day.localeCompare(b.day));
 assert.equal(new Set(rows.map(row=>row.day)).size,expected,'Duplicate date');
 for(let i=1;i<rows.length;i++)assert.equal(Date.parse(rows[i].day)-Date.parse(rows[i-1].day),86400000,'Missing UTC calendar day');
}
const counts=(row,keys,nullable=false)=>Object.fromEntries(keys.map(key=>[key,number(row[key],key,{integer:true,nullable})]));
const participationCounts=['successful_contract_log_rows','window_observed_contract_log_days','public_account_intents','active_signing_accounts','nonreferral_account_intents','nonreferral_active_accounts','simple_pair_account_intents','multi_or_one_sided_account_intents','fee_field_present_intents','nonempty_fee_map_intents','token_diff_log_rows','invalid_or_repeated_raw_key_rows','malformed_or_empty_data_log_rows','parsed_account_payloads','repeated_intent_hash_payloads','missing_identity_payloads','malformed_delta_payloads','malformed_json_contract_log_rows','window_nonreferral_accounts'];
const pairCounts=['public_account_intents','referred_account_intents','nonreferral_account_intents','unrecognized_asset_account_intents','fee_field_present_intents','nonempty_fee_map_intents'];
const patternCounts=['observed_successful_contract_log_rows','retained_public_account_events','behavior_unassessable_account_events','assessable_simple_account_events','no_prior_observed_simple_event','adjacent_reverse_candidate_pairs','distinct_flagged_account_events','behavioral_excluded_account_events'];

export function buildFlywheel(rawTables,manifest){
 assert.equal(rawTables.length,4);const [feeRaw,publicRaw,pairRaw,reverseRaw]=rawTables;
 const feeKeys=['reported_volume_usd','reported_gross_fees_usd','positive_unpriced_volume_rows','invalid_volume_rows','missing_fee_rows','invalid_fee_rows','reported_fees_per_million_usd','trailing_30d_fees_per_million_usd','matched_days_in_30d','missing_fee_rows_in_30d','unpriced_volume_rows_in_30d'];
 const fees=table(feeRaw,['day',...feeKeys]).map(row=>({day:day(row.day),...Object.fromEntries(feeKeys.map(key=>[key,number(row[key],key,{nullable:true,integer:key.endsWith('_rows')||key.endsWith('_30d')&&!key.includes('usd')})]))}));
 calendar(fees,90);
 for(let i=0;i<fees.length;i++){
  const row=fees[i],valid=row.reported_volume_usd>0&&row.reported_gross_fees_usd!==null&&row.invalid_volume_rows===0&&row.invalid_fee_rows===0;
  const expected=valid?row.reported_gross_fees_usd/row.reported_volume_usd*1e6:null;
  if(expected===null)assert.equal(row.reported_fees_per_million_usd,null,'Invalid daily ratio must be unavailable');else equal(row.reported_fees_per_million_usd,expected,'Daily ratio reconciliation');
  const window=fees.slice(Math.max(0,i-29),i+1),matched=window.filter(item=>item.reported_fees_per_million_usd!==null).length;
  assert.equal(row.matched_days_in_30d,matched,'Matched daily count reconciliation');
  const ratio=matched===30?sum(window,'reported_gross_fees_usd')/sum(window,'reported_volume_usd')*1e6:null;
  if(ratio===null)assert.equal(row.trailing_30d_fees_per_million_usd,null,'Incomplete window must remain unavailable');else equal(row.trailing_30d_fees_per_million_usd,ratio,'Independent ratio-of-sums reconciliation');
  equal(row.missing_fee_rows_in_30d,sum(window,'missing_fee_rows'),'Rolling missing fee count');
  equal(row.unpriced_volume_rows_in_30d,sum(window,'positive_unpriced_volume_rows'),'Rolling unpriced volume count');
 }
 const participation=table(publicRaw,['day','window_start','window_end',...participationCounts,'window_nonreferral_top5_count_share_pct','window_nonreferral_hhi_count_basis']).map(row=>({day:day(row.day),windowStart:day(row.window_start),windowEnd:day(row.window_end),...counts(row,participationCounts,true),top5SharePct:number(row.window_nonreferral_top5_count_share_pct,'top5 share',{nullable:true}),hhi:number(row.window_nonreferral_hhi_count_basis,'HHI',{nullable:true})}));
 calendar(participation,30);
 const first=participation[0],last=participation.at(-1);assert.equal(first.windowStart,first.day);assert.equal(first.windowEnd,last.day);
 for(const row of participation){
  assert.equal(row.windowStart,first.day);assert.equal(row.windowEnd,last.day);
  for(const key of ['top5SharePct','hhi','window_nonreferral_accounts'])assert.equal(row[key],first[key],'Window concentration must be constant');
  assert(row.top5SharePct===null||row.top5SharePct<=100);assert(row.hhi===null||row.hhi<=10000);
  if(row.successful_contract_log_rows===0){assert.equal(row.public_account_intents,null,'No observed logs cannot establish zero activity');continue;}
  for(const key of participationCounts)assert.notEqual(row[key],null,'Observed day missing count '+key);
  assert.equal(row.simple_pair_account_intents+row.multi_or_one_sided_account_intents,row.public_account_intents,'Pair population partition');
  assert(row.public_account_intents<=row.parsed_account_payloads,'Canonical population exceeds parsed payloads');
  assert(row.active_signing_accounts<=row.public_account_intents&&row.nonreferral_active_accounts<=row.active_signing_accounts);
  assert(row.nonreferral_account_intents<=row.public_account_intents&&row.nonreferral_active_accounts<=row.nonreferral_account_intents);
  assert(row.nonempty_fee_map_intents<=row.fee_field_present_intents&&row.fee_field_present_intents<=row.public_account_intents);
  assert(row.invalid_or_repeated_raw_key_rows<=row.token_diff_log_rows&&row.malformed_or_empty_data_log_rows<=row.token_diff_log_rows);
  assert(row.token_diff_log_rows<=row.successful_contract_log_rows);
 }
 const observedDays=participation.filter(row=>row.successful_contract_log_rows>0).length;
 for(const row of participation)assert.equal(row.window_observed_contract_log_days,observedDays,'Observed contract-day reconciliation');
 const pairs=table(pairRaw,['pair_label',...pairCounts,'share_of_canonical_account_intents_pct','first_observed_day','last_observed_day']).map(row=>({label:row.pair_label,...counts(row,pairCounts),sharePct:number(row.share_of_canonical_account_intents_pct,'pair share'),firstObservedDay:day(row.first_observed_day),lastObservedDay:day(row.last_observed_day)}));
 assert(pairs.length<=13,'Expected top12 plus reconciled Other, not truncated individual pairs');
 assert.equal(new Set(pairs.map(row=>row.label)).size,pairs.length,'Duplicate pair group');
 const canonicalObserved=participation.reduce((n,row)=>n+(row.public_account_intents??0),0);
 assert.equal(sum(pairs,'public_account_intents'),canonicalObserved,'Pair groups must reconcile to ALL retained account intents');
 equal(sum(pairs,'sharePct'),100,'Pair shares must cover the full canonical population');
 for(const row of pairs){
  assert.equal(row.referred_account_intents+row.nonreferral_account_intents,row.public_account_intents);
  assert(row.unrecognized_asset_account_intents<=row.public_account_intents&&row.nonempty_fee_map_intents<=row.fee_field_present_intents&&row.fee_field_present_intents<=row.public_account_intents);
  equal(row.sharePct,row.public_account_intents/canonicalObserved*100,'Pair share denominator');
  assert(row.firstObservedDay>=first.day&&row.lastObservedDay<=last.day&&row.firstObservedDay<=row.lastObservedDay);
 }
 for(const key of ['nonreferral_account_intents','fee_field_present_intents','nonempty_fee_map_intents'])assert.equal(sum(pairs,key),participation.reduce((n,row)=>n+(row[key]??0),0),'Pair/daily '+key);
 const reverse=table(reverseRaw,['day','window_start','window_end','horizon_minutes','tolerance_pct',...patternCounts,'flagged_share_of_assessable_events_pct']).map(row=>({day:day(row.day),windowStart:day(row.window_start),windowEnd:day(row.window_end),horizonMinutes:number(row.horizon_minutes,'horizon',{integer:true}),tolerancePct:number(row.tolerance_pct,'tolerance'),...counts(row,patternCounts),flaggedSharePct:number(row.flagged_share_of_assessable_events_pct,'flag share',{nullable:true})}));
 assert.equal(reverse.length,180,'Expected30 days x6 sensitivity scenarios');const seen=new Set();
 for(const row of reverse){
  const key=row.day+'/'+row.horizonMinutes+'/'+row.tolerancePct;assert(!seen.has(key),'Duplicate reverse scenario/date');seen.add(key);
  assert([15,60,240].includes(row.horizonMinutes)&&[1,5].includes(row.tolerancePct),'Unexpected sensitivity scenario');
  const source=participation.find(item=>item.day===row.day);assert(source,'Pattern date outside source window');assert.equal(row.windowStart,first.day);assert.equal(row.windowEnd,last.day);
  assert.equal(row.observed_successful_contract_log_rows,source.successful_contract_log_rows);
  assert.equal(row.retained_public_account_events,source.public_account_intents??0,'Pattern/participation population');
  assert.equal(row.behavior_unassessable_account_events+row.assessable_simple_account_events,row.retained_public_account_events,'Assessable partition');
  assert(row.distinct_flagged_account_events<=row.assessable_simple_account_events&&row.no_prior_observed_simple_event<=row.assessable_simple_account_events);
  assert(row.adjacent_reverse_candidate_pairs<=row.distinct_flagged_account_events);assert.equal(row.behavioral_excluded_account_events,0,'Behavior patterns must not silently exclude automation');
  const expected=share(row.distinct_flagged_account_events,row.assessable_simple_account_events);
  if(expected===null)assert.equal(row.flaggedSharePct,null);else equal(row.flaggedSharePct,expected,'Reverse daily share');
 }
 const sensitivity=[15,60,240].flatMap(horizonMinutes=>[1,5].map(tolerancePct=>{const rows=reverse.filter(row=>row.horizonMinutes===horizonMinutes&&row.tolerancePct===tolerancePct);calendar(rows,30);const assessable=sum(rows,'assessable_simple_account_events'),flagged=sum(rows,'distinct_flagged_account_events');return {horizonMinutes,tolerancePct,assessableAccountEvents:assessable,flaggedAccountEvents:flagged,flaggedSharePct:observedDays===30?share(flagged,assessable):null};}));
 const matched30=fees.slice(-30),feeLast=fees.at(-1),valid30=feeLast.matched_days_in_30d===30;
 const publicTotal=sum(participation,'public_account_intents'),parsedTotal=sum(participation,'parsed_account_payloads');
 assert(Array.isArray(manifest.executed),'Execution manifest missing');
 const charts=chartIds.map((id,i)=>{const matches=manifest.executed.filter(row=>row.chartId===id);assert.equal(matches.length,1,'One executed chart source required '+id);const source=matches[0];assert.equal(source.query,rawTables[i].query);assert(/^\d+$/.test(String(source.visualization)),'Chart visualization must be numeric');return {id,query:source.query.split('/').at(-1),visualization:String(source.visualization)};});
 return {version:'near-intents-flywheel-public-v1',snapshotSource:'Executed public Dune queries; saved aggregate results',generatedFromSavedDuneResults:true,automaticUpstreamRefresh:false,retrievedAt:rawTables.map(raw=>raw.retrievedAt).sort().at(-1),charts,
  summary:{grossFeePerMillion30d:feeLast.trailing_30d_fees_per_million_usd,volume30d:valid30?sum(matched30,'reported_volume_usd'):null,fees30d:valid30?sum(matched30,'reported_gross_fees_usd'):null,missingFeeRows30d:sum(matched30,'missing_fee_rows'),unpricedVolumeRows30d:sum(matched30,'positive_unpriced_volume_rows'),matchedFeeDays30d:feeLast.matched_days_in_30d,avgPublicAccounts:observedDays===30?sum(participation,'active_signing_accounts')/30:null,publicAccountIntents:publicTotal,top5NonreferralSharePct:first.top5SharePct,unrecognizedPairSharePct:observedDays===30?share(sum(pairs,'unrecognized_asset_account_intents'),canonicalObserved):null,reverseFlaggedShare60min5pct:sensitivity.find(row=>row.horizonMinutes===60&&row.tolerancePct===5).flaggedSharePct,canonicalRetainedSharePct:share(publicTotal,parsedTotal),windowStart:matched30[0].day,windowEnd:feeLast.day,publicWindowStart:first.day,publicWindowEnd:last.day,observedPublicContractDays:observedDays,uniqueNonreferralAccounts:first.window_nonreferral_accounts,nonreferralHhi:first.hhi,verifiedSolverCount:null},
  feeDaily:fees,publicDaily:participation,pairs,reverseDaily:reverse,sensitivity,
  limitations:['Reported fee productivity uses incomplete provider fee rows and reported priced account-side notional; not a completed unique-swap take rate or cross-protocol fee ranking.','Public account-side token_diff records exclude confidential execution; signing accounts and nonreferral counterparties are not verified solvers or people.','Representation chains are asset labels, not established deposit and withdrawal routes.','Adjacent reverse patterns can include legitimate arbitrage and automation. No behavioral events are automatically excluded.','Fee and public activity periods are source-specific; no claim of synchronized live upstream ingestion.']};
}

export function buildFiles({check=false}={}){
 const read=file=>JSON.parse(readFileSync(new URL(file,here),'utf8'));
 const manifest=read('execution-manifest.json'),tables=files.map(read);
 for(const source of manifest.executed){assert(/^[\w-]+\.sql$/.test(source.file),'Scoped SQL path required');assert.equal(createHash('sha256').update(readFileSync(new URL(source.file,here))).digest('hex'),source.localSourceSha256,'SQL changed after execution: '+source.file);}
 const output=buildFlywheel(tables,manifest);output.lineage=[...files,...manifest.executed.map(row=>row.file),'execution-manifest.json'].map(file=>({file:'analysis/intents-flywheel/'+file,sha256:createHash('sha256').update(readFileSync(new URL(file,here))).digest('hex')}));
 const serialized=JSON.stringify(output,null,2)+'\n',target=new URL('data/intents-flywheel.json',root);
 if(check)assert.equal(readFileSync(target,'utf8'),serialized,'Intents flywheel artifact is stale');else writeFileSync(target,serialized);
 return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const result=buildFiles({check:process.argv.includes('--check')});console.log(JSON.stringify({checks:'headers, finite/null values, source hashes, calendars, matched ratio-of-sums, counts and all pair groups, six reverse scenarios',summary:result.summary}));}
