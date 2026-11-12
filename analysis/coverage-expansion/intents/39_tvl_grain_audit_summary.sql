WITH raw AS (
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day,
 coalesce(nullif(lower(trim(CAST(source_type AS varchar))), ''), 'unknown') AS source_type,
 CAST(token_id AS varchar) AS token_id, CAST(blockchain AS varchar) AS blockchain, CAST(symbol AS varchar) AS symbol,
 CAST(tvl_usd AS varchar) AS raw_usd, CAST(tvl_tokens AS varchar) AS raw_tokens,
 try_cast(tvl_usd AS double) AS balance_usd, try_cast(tvl_tokens AS double) AS balance_tokens
 FROM dune.near.dataset_near_intents_metrics
), classified AS (
 SELECT *, CASE
 WHEN (raw_usd IS NOT NULL AND (balance_usd IS NULL OR NOT is_finite(balance_usd) OR balance_usd < 0))
 OR (raw_tokens IS NOT NULL AND (balance_tokens IS NULL OR NOT is_finite(balance_tokens) OR balance_tokens < 0))
 THEN 'invalid_numeric'
 WHEN balance_usd IS NOT NULL THEN 'reported_usd'
 WHEN balance_tokens > 0 THEN 'positive_tokens_unpriced'
 WHEN balance_tokens = 0 THEN 'zero_tokens_unpriced'
 ELSE 'no_balance_fields' END AS balance_status
 FROM raw WHERE day < current_date
), token_days AS (
 SELECT day, source_type, token_id, blockchain, symbol, count(*) AS source_rows,
 count_if(balance_status = 'reported_usd') AS reported_balance_rows,
 count_if(balance_status = 'reported_usd' AND balance_usd > 0) AS positive_balance_rows,
 count(DISTINCT CASE WHEN balance_status = 'reported_usd' THEN balance_usd END) AS distinct_reported_balances,
 sum(CASE WHEN balance_status = 'reported_usd' THEN balance_usd END) AS reported_balance_sum_usd,
 min(CASE WHEN balance_status = 'reported_usd' THEN balance_usd END) AS reported_balance_min_usd,
 max(CASE WHEN balance_status = 'reported_usd' THEN balance_usd END) AS reported_balance_max_usd,
 count_if(balance_status = 'positive_tokens_unpriced') AS positive_tokens_unpriced_rows,
 count_if(balance_status = 'zero_tokens_unpriced') AS zero_tokens_unpriced_rows,
 count_if(balance_status = 'no_balance_fields') AS no_balance_fields_rows,
 count_if(balance_status = 'invalid_numeric') AS invalid_numeric_rows
 FROM classified GROUP BY 1,2,3,4,5
)
SELECT source_type, count(*) AS token_day_keys,
 count_if(reported_balance_rows > 1) AS repeated_balance_keys,
 count_if(positive_balance_rows > 1) AS repeated_positive_balance_keys,
 sum(invalid_numeric_rows) AS invalid_numeric_rows,
 sum(positive_tokens_unpriced_rows) AS positive_tokens_unpriced_rows,
 sum(zero_tokens_unpriced_rows) AS zero_tokens_unpriced_rows,
 sum(no_balance_fields_rows) AS no_balance_fields_rows,
 sum(reported_balance_rows) AS reported_balance_rows,
 min(day) AS first_day, max(day) AS last_day
FROM token_days GROUP BY 1 ORDER BY 1
