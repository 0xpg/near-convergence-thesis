-- Validated archived issuer/admin snapshots, not automatic issuer ingestion or a live flow feed.
-- findings.json SHA256 04a666b4c088333128c67c1f0f2f7c009d2ae25d94346e2ba82253d4c4260865
-- Source dates are labels, not a synchronized economic cutoff. Query execution does not refresh observations.
-- Stable product ISIN avoids double-counting the European NEAR/NEAS exchange listings.
WITH observations(product_isin,product,source_date,near_held,shares_outstanding,net_assets_usd,near_basis,source_url,cutoff_note) AS (
 VALUES
 ('US0919521015','NRR · U.S.',DATE '2026-11-12',CAST('15331373.48610193' AS DOUBLE),CAST(2930000 AS BIGINT),DECIMAL '52568509.81','Issuer fund holdings','https://nrretf.com/','Raw issuer date 2026-11-12; rendered holdings label 11/11/2026. NAV has another cutoff; do not infer flows.'),
 ('DE000A4A5GV2','NEAR ETP · Europe',DATE '2026-11-13',CAST('13219480.53' AS DOUBLE),CAST(2545252 AS BIGINT),DECIMAL '49272573.2','Issuer entitlement-backed holdings','https://bitwiseinvestments.eu/products/bitwise-near-staking-etp/','Last-updated label 13-11-2026 05:35:21; economic business date not independently verified.')
)
SELECT *,CAST(NULL AS DOUBLE) AS verified_net_flow_usd,
 CAST(NULL AS DOUBLE) AS verified_institutional_ownership_pct,
 false AS synchronized_business_cutoff_verified,
 '2026-11-13T05:39:54.735635+00:00' AS archived_sources_retrieved_through_utc,
 'Product holdings are not proof of institutional beneficial ownership, new spot buying or net investor flows. Do not sum products at mismatched cutoffs.' AS interpretation,
 current_timestamp AS query_executed_utc
FROM observations ORDER BY product_isin DESC
