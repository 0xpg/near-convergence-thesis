WITH params AS (
 SELECT current_date - interval '180' day AS start_day,
 current_date - interval '1' day AS end_day
), raw AS (
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day,
 coalesce(nullif(lower(trim(CAST(source_type AS varchar))), ''), 'unknown') AS source_type,
 CAST(blockchain AS varchar) AS blockchain, CAST(symbol AS varchar) AS symbol,
 CAST(token_id AS varchar) AS token_id,
 CAST(volume_amount_usd AS varchar) AS raw_usd,
 CAST(volume_amount_tokens AS varchar) AS raw_tokens,
 try_cast(volume_amount_usd AS double) AS volume_usd,
 try_cast(volume_amount_tokens AS double) AS volume_tokens
 FROM dune.near.dataset_near_intents_metrics
), classified AS (
 SELECT *, CASE
 WHEN (raw_usd IS NOT NULL AND (volume_usd IS NULL OR NOT is_finite(volume_usd) OR volume_usd < 0))
 OR (raw_tokens IS NOT NULL AND (volume_tokens IS NULL OR NOT is_finite(volume_tokens) OR volume_tokens < 0))
 THEN 'invalid_numeric'
 WHEN volume_usd IS NOT NULL THEN 'reported_usd'
 WHEN volume_tokens > 0 THEN 'positive_tokens_unpriced'
 WHEN volume_tokens = 0 THEN 'zero_tokens_unpriced'
 ELSE 'no_volume_fields' END AS amount_status
 FROM raw CROSS JOIN params WHERE day BETWEEN start_day AND end_day
), dimensions AS (
 SELECT day, source_type, blockchain, symbol, token_id, count(*) AS source_rows,
 greatest(count(*) - 1, 0) AS extra_rows_at_candidate_grain,
 sum(CASE WHEN amount_status = 'reported_usd' THEN volume_usd END) AS reported_priced_volume_usd,
 count_if(amount_status = 'reported_usd') AS priced_rows,
 count_if(amount_status = 'positive_tokens_unpriced') AS positive_tokens_unpriced_rows,
 count_if(amount_status = 'zero_tokens_unpriced') AS zero_tokens_unpriced_rows,
 count_if(amount_status = 'no_volume_fields') AS no_volume_fields_rows,
 count_if(amount_status = 'invalid_numeric') AS invalid_numeric_rows
 FROM classified GROUP BY 1,2,3,4,5
), daily AS (
 SELECT day, source_type, sum(source_rows) AS source_rows,
 sum(extra_rows_at_candidate_grain) AS extra_rows_at_candidate_grain,
 sum(reported_priced_volume_usd) AS reported_priced_volume_usd,
 sum(priced_rows) AS priced_rows,
 sum(positive_tokens_unpriced_rows) AS positive_tokens_unpriced_rows,
 sum(zero_tokens_unpriced_rows) AS zero_tokens_unpriced_rows,
 sum(no_volume_fields_rows) AS no_volume_fields_rows,
 sum(invalid_numeric_rows) AS invalid_numeric_rows
 FROM dimensions GROUP BY 1,2
)
SELECT *, reported_priced_volume_usd AS reported_volume_usd, priced_rows > 0 AS has_reported_usd, invalid_numeric_rows = 0 AS reported_values_valid,
 CASE WHEN priced_rows = 0 THEN 'No reported priced USD'
 WHEN invalid_numeric_rows > 0 THEN 'Invalid numeric rows; reported subset only'
 WHEN positive_tokens_unpriced_rows > 0 THEN 'Priced subset; positive token amounts lack USD'
 WHEN no_volume_fields_rows > 0 OR zero_tokens_unpriced_rows > 0 THEN 'Reported priced subset; sparse volume fields present'
 ELSE 'Reported priced subset; full notional coverage not established' END AS notional_coverage_status,
 'Reported priced provider volume only; missing fields are not zero; no price backfill; swap-leg convention unverified' AS volume_definition,
 current_timestamp AS retrieved_utc
FROM daily ORDER BY day, source_type
