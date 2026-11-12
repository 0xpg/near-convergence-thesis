WITH m AS (
 SELECT source_type,try_cast(substr(CAST(date_at AS varchar),1,10) AS date) day,
 try_cast(volume_amount_usd AS double) usd,try_cast(volume_amount_tokens AS double) tokens,
 try_cast(price AS double) price FROM dune.near.dataset_near_intents_metrics
), classified AS (
 SELECT *,CASE WHEN usd IS NOT NULL THEN 'reported USD volume' WHEN tokens>0 THEN 'positive token volume without USD' WHEN tokens=0 THEN 'zero token volume without USD' ELSE 'no volume fields' END category FROM m
)
SELECT 'metrics' dataset,source_type,category,count(*) rows_seen,min(day) first_day,max(day) last_day,sum(usd) reported_usd,count_if(price>0 AND tokens>0 AND usd IS NULL) priceable_missing_rows,sum(CASE WHEN usd IS NULL AND tokens>0 AND price>0 THEN tokens*price END) potential_usd
FROM classified GROUP BY 1,2,3
UNION ALL
SELECT 'affiliate_fees',source_type,CASE WHEN try_cast(fee AS double) IS NULL THEN 'missing fee' ELSE 'reported fee' END,count(*),min(try_cast(substr(CAST(date_at AS varchar),1,10) AS date)),max(try_cast(substr(CAST(date_at AS varchar),1,10) AS date)),sum(try_cast(fee AS double)),CAST(NULL AS bigint),CAST(NULL AS double)
FROM dune.near.dataset_near_intents_fees GROUP BY 1,2,3 ORDER BY 1,2,3
