-- Validated archived issuer/admin snapshots, not automatic issuer ingestion or a live flow feed.
-- findings.json SHA256 04a666b4c088333128c67c1f0f2f7c009d2ae25d94346e2ba82253d4c4260865
-- Source dates are labels, not a synchronized economic cutoff. Query execution does not refresh observations.
-- Stable product ISIN avoids double-counting the European NEAR/NEAS exchange listings.
WITH observations(source_date,observation_label,shares_outstanding,near_entitlement_per_unit,source_url,cutoff_note) AS (
 VALUES
 (DATE '2026-11-05','5 Nov · administrator',CAST(3817562 AS BIGINT),CAST('5.1916866' AS DOUBLE),'https://bitwiseinvestments.eu/resources/weekly_balance_report/bitwise-europe-gmbh_weekly_balance_report.pdf','Administrator report explicitly dated 5 November 2026; required collateral is distinct from actual excess collateral.'),
 (DATE '2026-11-13','13 Nov · issuer update',CAST(2545252 AS BIGINT),CAST('5.19378063' AS DOUBLE),'https://bitwiseinvestments.eu/products/bitwise-near-staking-etp/','Page updated 13-11-2026 05:35:21; underlying economic business date not independently verified.')
), baseline AS (
 SELECT *,first_value(shares_outstanding) OVER (ORDER BY source_date) AS baseline_shares,
 first_value(near_entitlement_per_unit) OVER (ORDER BY source_date) AS baseline_entitlement
 FROM observations
)
SELECT 'DE000A4A5GV2' AS product_isin,'Bitwise NEAR Staking ETP · Europe' AS product,*,
 shares_outstanding-baseline_shares AS units_change_from_baseline,
 100.0*(CAST(shares_outstanding AS DOUBLE)/baseline_shares-1) AS units_change_from_baseline_pct,
 100.0*(near_entitlement_per_unit/baseline_entitlement-1) AS entitlement_change_from_baseline_pct,
 CAST(NULL AS DOUBLE) AS verified_net_flow_usd,
 CAST(NULL AS DOUBLE) AS verified_institutional_ownership_pct,
 '2026-11-13T05:39:54.735635+00:00' AS archived_sources_retrieved_through_utc,
 'Two source observations only, not a daily flow series. Unit contraction is consistent with net redemptions, but corporate actions were not exhaustively audited. Entitlement includes net staking and expenses; do not label it pure staking return. NEAR/NEAS represent one ISIN.' AS interpretation,
 current_timestamp AS query_executed_utc
FROM baseline ORDER BY source_date
