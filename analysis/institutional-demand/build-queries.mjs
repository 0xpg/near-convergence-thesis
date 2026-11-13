import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
const read=file=>readFileSync(path.join(here,file),'utf8');
const findings=JSON.parse(read('findings.json')),n=findings.nrr,e=findings.european;
const hash=file=>createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex');
for(const source of [...findings.sources,...findings.inputHashes])assert.equal(hash(source.file),source.sha256,'Stale input: '+source.file);
assert.equal(n.verifiedNetFlowUsd,null);assert.equal(e.verifiedNetFlowUsd,null);
assert.equal(n.verifiedInstitutionalOwnershipPct,null);assert.equal(e.verifiedInstitutionalOwnershipPct,null);
assert.equal(e.businessDateIndependentlyVerified,false);
assert.equal(e.sharesOutstanding-e.baselineShares,e.change.sharesChange);
assert(Math.abs((e.sharesOutstanding/e.baselineShares-1)*100-e.change.sharesChangePct)<1e-10);
const csv=read('observations.csv').trim().split(/\r?\n/).slice(1).map(row=>row.split(','));
assert.equal(csv.length,3);assert.equal(new Set(csv.map(row=>row[0]+'|'+row[1])).size,3);
for(const [isin,date,shares,held] of [[n.isin,n.issuerDate,n.sharesOutstanding,n.nearHeld],[e.isin,e.baselineDate,e.baselineShares,e.baselineRequiredCollateralNear],[e.isin,e.issuerDate,e.sharesOutstanding,e.nearHeld]]){
  const row=csv.find(row=>row[0]===isin&&row[1]===date);assert(row);assert.equal(Number(row[2]),shares);assert.equal(Number(row[4]),held);
}
const sql=value=>"'"+String(value).replaceAll("'","''")+"'";
const finite=value=>{assert(Number.isFinite(value));return String(value);};
const date=value=>{assert(/^\d{4}-\d{2}-\d{2}$/.test(value));return "DATE '"+value+"'";};
const findingsHash=createHash('sha256').update(read('findings.json')).digest('hex');
const sourceRetrieved=findings.sources.map(source=>source.retrievedAt).sort().at(-1);
const header=`-- Validated archived issuer/admin snapshots, not automatic issuer ingestion or a live flow feed.
-- findings.json SHA256 ${findingsHash}
-- Source dates are labels, not a synchronized economic cutoff. Query execution does not refresh observations.
-- Stable product ISIN avoids double-counting the European NEAR/NEAS exchange listings.
`;
const holdings=`${header}WITH observations(product_isin,product,source_date,near_held,shares_outstanding,net_assets_usd,near_basis,source_url,cutoff_note) AS (
 VALUES
 (${sql(n.isin)},'NRR · U.S.',${date(n.issuerDate)},CAST(${sql(finite(n.nearHeld))} AS DOUBLE),CAST(${finite(n.sharesOutstanding)} AS BIGINT),DECIMAL '${finite(n.netAssetsUsd)}','Issuer fund holdings','https://nrretf.com/','Raw issuer date ${n.issuerDate}; rendered holdings label ${n.renderedHoldingsDate}. NAV has another cutoff; do not infer flows.'),
 (${sql(e.isin)},'NEAR ETP · Europe',${date(e.issuerDate)},CAST(${sql(finite(e.nearHeld))} AS DOUBLE),CAST(${finite(e.sharesOutstanding)} AS BIGINT),DECIMAL '${finite(e.netAssetsUsd)}','Issuer entitlement-backed holdings','https://bitwiseinvestments.eu/products/bitwise-near-staking-etp/','Last-updated label ${e.sourceLastUpdatedLabel}; economic business date not independently verified.')
)
SELECT *,CAST(NULL AS DOUBLE) AS verified_net_flow_usd,
 CAST(NULL AS DOUBLE) AS verified_institutional_ownership_pct,
 false AS synchronized_business_cutoff_verified,
 ${sql(sourceRetrieved)} AS archived_sources_retrieved_through_utc,
 'Product holdings are not proof of institutional beneficial ownership, new spot buying or net investor flows. Do not sum products at mismatched cutoffs.' AS interpretation,
 current_timestamp AS query_executed_utc
FROM observations ORDER BY product_isin DESC
`;
const units=`${header}WITH observations(source_date,observation_label,shares_outstanding,near_entitlement_per_unit,source_url,cutoff_note) AS (
 VALUES
 (${date(e.baselineDate)},'5 Nov · administrator',CAST(${finite(e.baselineShares)} AS BIGINT),CAST(${sql(finite(e.baselineEntitlement))} AS DOUBLE),'https://bitwiseinvestments.eu/resources/weekly_balance_report/bitwise-europe-gmbh_weekly_balance_report.pdf','Administrator report explicitly dated 5 November 2026; required collateral is distinct from actual excess collateral.'),
 (${date(e.issuerDate)},'13 Nov · issuer update',CAST(${finite(e.sharesOutstanding)} AS BIGINT),CAST(${sql(finite(e.nearEntitlement))} AS DOUBLE),'https://bitwiseinvestments.eu/products/bitwise-near-staking-etp/','Page updated ${e.sourceLastUpdatedLabel}; underlying economic business date not independently verified.')
), baseline AS (
 SELECT *,first_value(shares_outstanding) OVER (ORDER BY source_date) AS baseline_shares,
 first_value(near_entitlement_per_unit) OVER (ORDER BY source_date) AS baseline_entitlement
 FROM observations
)
SELECT ${sql(e.isin)} AS product_isin,'Bitwise NEAR Staking ETP · Europe' AS product,*,
 shares_outstanding-baseline_shares AS units_change_from_baseline,
 100.0*(CAST(shares_outstanding AS DOUBLE)/baseline_shares-1) AS units_change_from_baseline_pct,
 100.0*(near_entitlement_per_unit/baseline_entitlement-1) AS entitlement_change_from_baseline_pct,
 CAST(NULL AS DOUBLE) AS verified_net_flow_usd,
 CAST(NULL AS DOUBLE) AS verified_institutional_ownership_pct,
 ${sql(sourceRetrieved)} AS archived_sources_retrieved_through_utc,
 'Two source observations only, not a daily flow series. Unit contraction is consistent with net redemptions, but corporate actions were not exhaustively audited. Entitlement includes net staking and expenses; do not label it pure staking return. NEAR/NEAS represent one ISIN.' AS interpretation,
 current_timestamp AS query_executed_utc
FROM baseline ORDER BY source_date
`;
for(const [file,content] of [['01_product_holdings_snapshot.sql',holdings],['02_european_units_observations.sql',units]]){
  assert(!/\b(?:INSERT|UPDATE|DELETE|DROP|CREATE)\b/.test(content),'Read-only query');
  assert(content.includes('CAST(NULL AS DOUBLE) AS verified_net_flow_usd'));
  if(process.argv.includes('--check'))assert.equal(read(file),content,'Stale SQL: '+file);
  else writeFileSync(path.join(here,file),content);
}
console.log('Institutional SQL: archived source hashes, three source rows, stable IDs, exact unit change, null unknowns and query reproduction passed.');
