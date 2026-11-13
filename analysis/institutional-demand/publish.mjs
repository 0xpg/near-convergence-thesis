import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=fileURLToPath(new URL('./',import.meta.url));
const read=file=>JSON.parse(readFileSync(path.join(here,file),'utf8'));
const hash=file=>createHash('sha256').update(readFileSync(path.join(here,file))).digest('hex');
const findings=read('findings.json'),manifest=read('execution-manifest.json').executed;
assert.deepEqual(manifest.map(row=>row.id),['investment-holdings','investment-units']);
const close=(actual,expected)=>assert(Math.abs(actual-expected)<=Math.max(1e-9,Math.abs(expected)*1e-12),'Executed result does not reconcile');
const numeric=value=>{assert(typeof value==='string'&&value.trim()!=='','Unknown numeric value');const n=Number(value);assert(Number.isFinite(n));return n;};
const unknown=value=>value===''||value==='null'||value===null;
const sourceRows=[];
const charts=manifest.map(item=>{
  for(const id of [item.query,item.visualization])assert(/^\d+$/.test(id));
  assert(/^[a-z0-9_-]+\.sql$/.test(item.file)&&/^[a-z0-9_-]+\.json$/.test(item.result));
  assert.equal(hash(item.file),item.localSourceSha256,'SQL changed after recorded execution');
  const result=read(item.result),[headers,...rows]=result.rows;
  assert.equal(result.query,'https://dune.com/queries/'+item.query);
  assert(Number.isFinite(Date.parse(result.retrievedAt)));
  assert.equal(new Set(headers).size,headers.length);
  assert.equal(rows.length,2);
  const records=rows.map(values=>{
    assert.equal(values.length,headers.length);
    const row=Object.fromEntries(headers.map((key,i)=>[key,values[i]]));
    assert(unknown(row.verified_net_flow_usd)&&unknown(row.verified_institutional_ownership_pct),'Unavailable measures must remain null');
    assert.equal(new URL(row.source_url).protocol,'https:');
    return row;
  });
  sourceRows.push({id:item.id,records,retrievedAt:result.retrievedAt,resultSha256:hash(item.result),sqlSha256:hash(item.file)});
  return {id:item.id,query:item.query,visualization:item.visualization};
});
const [holdings,units]=sourceRows.map(source=>source.records);
assert.equal(new Set(holdings.map(row=>row.product_isin)).size,2);
for(const fact of [findings.nrr,findings.european]){
  const row=holdings.find(row=>row.product_isin===fact.isin);assert(row);
  assert.equal(row.source_date.slice(0,10),fact.issuerDate);
  assert.equal(row.synchronized_business_cutoff_verified,'false');
  close(numeric(row.near_held),fact.nearHeld);close(numeric(row.shares_outstanding),fact.sharesOutstanding);close(numeric(row.net_assets_usd),fact.netAssetsUsd);
}
assert.equal(new Set(units.map(row=>row.source_date)).size,2);
const baseline=units.find(row=>row.source_date.startsWith(findings.european.baselineDate));
const latest=units.find(row=>row.source_date.startsWith(findings.european.issuerDate));
assert(baseline&&latest);assert(units.every(row=>row.product_isin===findings.european.isin));
close(numeric(baseline.shares_outstanding),findings.european.baselineShares);
close(numeric(latest.shares_outstanding),findings.european.sharesOutstanding);
close(numeric(baseline.units_change_from_baseline),0);
close(numeric(baseline.units_change_from_baseline_pct),0);
close(numeric(latest.units_change_from_baseline),findings.european.change.sharesChange);
close(numeric(latest.units_change_from_baseline_pct),findings.european.change.sharesChangePct);
close(numeric(latest.entitlement_change_from_baseline_pct),findings.european.change.entitlementChangePct);
// Published headline values follow executed results; original records remain their reconciliation authority.
const nrrRow=holdings.find(row=>row.product_isin===findings.nrr.isin),euRow=holdings.find(row=>row.product_isin===findings.european.isin);
const output={...findings,version:'near-investment-product-demand-published-v1',retrievedAt:sourceRows.map(row=>row.retrievedAt).sort().at(-1),charts,
  nrr:{...findings.nrr,nearHeld:numeric(nrrRow.near_held),sharesOutstanding:numeric(nrrRow.shares_outstanding),netAssetsUsd:numeric(nrrRow.net_assets_usd)},
  european:{...findings.european,nearHeld:numeric(euRow.near_held),sharesOutstanding:numeric(euRow.shares_outstanding),netAssetsUsd:numeric(euRow.net_assets_usd),change:{...findings.european.change,sharesChangePct:numeric(latest.units_change_from_baseline_pct),sharesChange:numeric(latest.units_change_from_baseline),entitlementChangePct:numeric(latest.entitlement_change_from_baseline_pct)}},
  duneExecution:sourceRows,refreshPolicy:'Archived source observations, executed on Dune and reconciled before publication. Rerunning SQL does not ingest new issuer data. Embedded chart filters do not refresh these insights.',
  researchSourceSha256:hash('findings.json')};
const encoded=JSON.stringify(output,null,2)+'\n',target=path.join(here,'../../data/institutional-demand.json');
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),encoded,'Stale investment-product public data');
else writeFileSync(target,encoded);
console.log('Investment-product publication: executed Dune rows, source cutoffs, product IDs, numeric reconciliation and unknown-flow guards passed.');
