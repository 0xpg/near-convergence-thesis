import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync(new URL('../data/'+name,import.meta.url),'utf8'));
const table=value=>value.rows.map(row=>Object.fromEntries(value.columns.map((key,i)=>[key,row[i]])));
const classified=table(read('glance-sources/intents-missingness-dune.json'));
const metrics=classified.filter(row=>row.dataset==='metrics');
const count=category=>metrics.filter(row=>row.category===category).reduce((total,row)=>total+Number(row.rows_seen),0);
const preflight=table(read('glance-sources/intents-source-preflight-dune.json')).find(row=>row.dataset==='metrics');
assert.equal(count('no volume fields')+count('positive token volume without USD'),Number(preflight.missing_amount_rows));
assert.equal(metrics.reduce((total,row)=>total+Number(row.rows_seen),0),Number(preflight.rows_seen));
const prices=table(read('glance-sources/intents-price-check-dune.json'));
assert(prices.filter(row=>row.check_name==='priced volume relation').every(row=>Number(row.mismatch_rows)>0),'Daily prices cannot be treated as an exact official backfill');
const daily=read('glance-daily.json').rows;
const monthly=table(read('glance-sources/intents-monthly-corrected-dune.json'));
for(const row of monthly){
  const rows=daily.filter(day=>day.day.slice(0,7)===row.month.slice(0,7));
  assert.equal(rows.length,Number(row.days_covered),'Monthly financial calendar coverage');
  for(const [field,key] of [['volume_usd','volumeUsd'],['gross_fees_usd','grossFeesUsd'],['retained_usd','capturedUsd']]){
    const sum=rows.reduce((total,day)=>total+day[key],0);
    assert(Math.abs(sum-Number(row[field]))<=Math.max(1e-6,Math.abs(sum)*1e-12),'Daily/monthly reconciliation: '+field);
  }
  const ratio=100*Number(row.retained_usd)/Number(row.gross_fees_usd);
  assert(Math.abs(ratio-Number(row.retained_share_pct))<1e-9,'USD ratio of sums');
  if(rows.some(day=>day.swaps===null))assert.equal(row.avg_swap_usd,'','Missing counts must not manufacture average swap size');
}
console.log('Executed source audit reconciles sparse fields, rejects blind price backfill and matches daily/monthly financial outputs.');
