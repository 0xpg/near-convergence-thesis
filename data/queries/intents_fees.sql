-- Snapshot reproduction: 27 September through 26 October 2026 inclusive UTC.
-- Same source feeds as the referral breakdown: protocol fees plus affiliate/distribution fees.
-- Gross service fees, not NEAR tokenholder revenue. Source-maintained datasets may be revised.
WITH fees AS (
 SELECT CAST(substr(CAST(date_at AS VARCHAR),1,10) AS DATE) AS day,
 CAST(amount_fee AS DOUBLE) AS fees_usd,0e0 AS distribution_usd
 FROM dune.near.dataset_near_intents_protocol_fees
 UNION ALL
 SELECT CAST(substr(CAST(date_at AS VARCHAR),1,10) AS DATE) AS day,
 CAST(fee AS DOUBLE) AS fees_usd,CAST(fee AS DOUBLE) AS distribution_usd
 FROM dune.near.dataset_near_intents_fees
), daily AS (
 SELECT day,sum(fees_usd) AS fees_usd,sum(distribution_usd) AS distribution_usd FROM fees
 WHERE day>=DATE '2026-09-27' AND day<=DATE '2026-10-26' GROUP BY 1
)
SELECT day,fees_usd,
 sum(fees_usd) OVER () AS gross_30d_usd,
 sum(distribution_usd) OVER () AS distribution_30d_usd
FROM daily ORDER BY day
