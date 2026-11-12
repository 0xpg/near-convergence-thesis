WITH m AS (SELECT source_type,try_cast(substr(CAST(date_at AS varchar),1,10) AS date) day,token_id,symbol,try_cast(volume_amount_usd AS double) usd,try_cast(volume_amount_tokens AS double) tokens,try_cast(price AS double) price FROM dune.near.dataset_near_intents_metrics)
SELECT 'priced volume relation' check_name,source_type,count(*) rows_seen,min(day) first_day,max(day) last_day,sum(usd) value_usd,sum(tokens*price) comparison_usd,count_if(abs(usd-tokens*price)>greatest(0.01,abs(usd)*0.000001)) mismatch_rows FROM m WHERE usd IS NOT NULL AND tokens IS NOT NULL AND price>0 GROUP BY source_type
UNION ALL
SELECT 'unpriced positive volume',source_type,count(*),min(day),max(day),sum(CASE WHEN price>0 THEN tokens*price END),CAST(NULL AS double),count_if(price IS NULL OR price<=0) FROM m WHERE usd IS NULL AND tokens>0 GROUP BY source_type
 ORDER BY 1,2
