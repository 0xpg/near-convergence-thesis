-- Snapshot reproduction: 27 September through 26 October 2026 inclusive UTC. Source-reported referral labels; not beneficial-owner labels.
-- Affiliate/distribution fees only. Excludes the separate protocol fee table and is not tokenholder revenue.
WITH source AS (
 SELECT CAST(substr(CAST(date_at AS VARCHAR),1,10) AS DATE) AS day,
 coalesce(nullif(CAST(referral AS VARCHAR),''),'Unlabelled') AS name,CAST(fee AS DOUBLE) AS fees_usd
 FROM dune.near.dataset_near_intents_fees
), totals AS (
 SELECT name,sum(fees_usd) AS fees_usd,min(day) AS first_date,max(day) AS last_date FROM source
 WHERE day>=DATE '2026-09-27' AND day<=DATE '2026-10-26' GROUP BY 1
), ranked AS (SELECT *,row_number() OVER (ORDER BY fees_usd DESC,name) AS rank FROM totals),
 grouped AS (
 SELECT CASE WHEN rank<=10 THEN name ELSE 'Other' END AS name,sum(fees_usd) AS fees_usd,
 min(first_date) AS first_date,max(last_date) AS last_date FROM ranked GROUP BY 1
)
SELECT CASE WHEN length(name)>13 THEN substr(name,1,12)||'…' ELSE name END AS channel,
 name,fees_usd,100*fees_usd/nullif(sum(fees_usd) OVER (),0) AS share_pct,
 first_date,last_date,current_timestamp AS retrieved_utc FROM grouped ORDER BY fees_usd DESC
