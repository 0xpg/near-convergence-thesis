import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=fileURLToPath(new URL('./',import.meta.url));
const read=file=>JSON.parse(readFileSync(path.join(here,file),'utf8'));
const hash=file=>createHash('sha256').update(readFileSync(path.join(here,file))).digest('hex');
const findings=read('findings.json'),manifest=read('execution-manifest.json').executed;
const flow=read('flow-history-candidate.json');
assert.deepEqual(manifest.map(row=>row.id),['investment-holdings','investment-units','investment-flows']);
assert.equal(flow.source,'https://cryptoetf.today/en/etf/nrr-etf-price');
for(const source of [...findings.sources,...findings.inputHashes]){
  const file=source.file.replace('analysis/institutional-demand/','');
  assert(source.file==='analysis/institutional-demand/'+file&&/^[a-z0-9_.-]+$/.test(file),'Research input must remain in research folder');
  assert.equal(hash(file),source.sha256,'Stale issuer input: '+file);
}
for(const source of flow.inputHashes){
  assert(/^[a-z0-9_.-]+$/.test(source.file),'Flow input must remain in research folder');
  assert.equal(hash(source.file),source.sha256,'Stale flow input: '+source.file);
}
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
  assert.equal(rows.length,item.id==='investment-flows'?33:2);
  const records=rows.map(values=>{
    assert.equal(values.length,headers.length);
    const row=Object.fromEntries(headers.map((key,i)=>[key,values[i]]));
    if(item.id!=='investment-flows')assert(unknown(row.verified_net_flow_usd)&&unknown(row.verified_institutional_ownership_pct),'Unavailable measures must remain null');
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
const flows=sourceRows.find(source=>source.id==='investment-flows').records;
assert.equal(flow.rows.length,33);
const days=flows.map(row=>row.day.slice(0,10));
assert(days.every(day=>/^\d{4}-\d{2}-\d{2}$/.test(day)));
assert.deepEqual(days,[...new Set(days)].sort(),'Flow dates must be unique and ordered');
assert.equal(days[0],flow.summary.start);assert.equal(days.at(-1),flow.summary.end);
let cumulative=0,grossInflows=0,grossOutflows=0;
for(const [index,row] of flows.entries()){
  const expected=flow.rows[index],daily=numeric(row.reported_net_flow_usd);
  assert.equal(days[index],expected.day);
  assert(Number.isSafeInteger(daily)&&daily%1000===0,'Provider precision must remain USD thousands');
  close(daily,expected.reportedNetFlowUsd);cumulative+=daily;
  close(numeric(row.cumulative_reported_net_flow_usd),cumulative);
  close(cumulative,expected.cumulativeReportedNetFlowUsd);
  assert.equal(row.source_url,flow.source);assert.equal(row.attribution,'Source: cryptoetf.today');
  assert(row.coverage.includes('Archived attributed chart excerpt'));
  if(daily>0)grossInflows+=daily;else grossOutflows+=daily;
}
close(cumulative,flow.summary.cumulativeNetFlowUsd);
close(grossInflows,flow.summary.grossInflowsUsd);close(grossOutflows,flow.summary.grossOutflowsUsd);
assert.equal(flow.summary.sessions,flows.length);
const peak=flow.rows.reduce((best,row)=>row.cumulativeReportedNetFlowUsd>best.cumulativeReportedNetFlowUsd?row:best);
const firstThree=flow.rows.slice(0,3).reduce((sum,row)=>sum+row.reportedNetFlowUsd,0);
const summaryChecks={positiveSessions:flow.rows.filter(row=>row.reportedNetFlowUsd>0).length,
  negativeSessions:flow.rows.filter(row=>row.reportedNetFlowUsd<0).length,
  reportedZeroSessions:flow.rows.filter(row=>row.reportedNetFlowUsd===0).length,
  peakCumulativeUsd:peak.cumulativeReportedNetFlowUsd,changeSincePeakUsd:cumulative-peak.cumulativeReportedNetFlowUsd,
  firstThreeSessionNetFlowUsd:firstThree,firstThreeSessionsShareOfLatestCumulativePct:100*firstThree/cumulative};
assert.equal(flow.summary.peakDate,peak.day);
for(const [key,value] of Object.entries(summaryChecks))close(flow.summary[key],value);
const flowSummary={...flow.summary,sourceUrl:flow.source,sourceLabel:'cryptoetf.today',
  sourceClass:flow.sourceClass,coverage:flows[0].coverage,precision:flow.sourceUnits,
  validation:{primaryNavDates:flow.validation.primaryNavDates,publicArchiveShareAnchors:flow.validation.publicArchiveShareAnchors,
    directConsecutiveArchiveShareChecks:flow.validation.directConsecutiveArchiveShareChecks.length,interpretation:flow.validation.interpretation},
  limitations:flow.limitations,licenseScope:flow.licenseReview.scope,candidateSha256:hash('flow-history-candidate.json')};
// Published headline values follow executed results; original records remain their reconciliation authority.
const nrrRow=holdings.find(row=>row.product_isin===findings.nrr.isin),euRow=holdings.find(row=>row.product_isin===findings.european.isin);
const output={...findings,version:'near-investment-product-demand-published-v1',retrievedAt:sourceRows.map(row=>row.retrievedAt).sort().at(-1),charts,
  nrr:{...findings.nrr,nearHeld:numeric(nrrRow.near_held),sharesOutstanding:numeric(nrrRow.shares_outstanding),netAssetsUsd:numeric(nrrRow.net_assets_usd)},
  european:{...findings.european,nearHeld:numeric(euRow.near_held),sharesOutstanding:numeric(euRow.shares_outstanding),netAssetsUsd:numeric(euRow.net_assets_usd),change:{...findings.european.change,sharesChangePct:numeric(latest.units_change_from_baseline_pct),sharesChange:numeric(latest.units_change_from_baseline),entitlementChangePct:numeric(latest.entitlement_change_from_baseline_pct)}},
  flowSummary,
  duneExecution:sourceRows.map(source=>source.id==='investment-flows'?{id:source.id,observations:source.records.length,retrievedAt:source.retrievedAt,resultSha256:source.resultSha256,sqlSha256:source.sqlSha256}:source),refreshPolicy:'Archived source observations, executed on Dune and reconciled before publication. Rerunning SQL does not ingest new issuer or provider data. Embedded chart filters do not refresh these insights.',
  researchSourceSha256:hash('findings.json')};
const encoded=JSON.stringify(output,null,2)+'\n',target=path.join(here,'../../data/institutional-demand.json');
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),encoded,'Stale investment-product public data');
else writeFileSync(target,encoded);
console.log('Investment-product publication: executed Dune rows, source cutoffs, product IDs, numeric reconciliation and unknown-flow guards passed.');
