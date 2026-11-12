WITH params AS (
 SELECT CAST('{{start_date}}' AS date) AS start_day,
 least(CAST('{{end_date}}' AS date), current_date - interval '1' day) AS end_day
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
), expanded AS (
 SELECT day, d.dimension, coalesce(nullif(d.label, ''), 'unknown') AS label,
 source_rows, extra_rows_at_candidate_grain, reported_priced_volume_usd, priced_rows,
 positive_tokens_unpriced_rows, zero_tokens_unpriced_rows, no_volume_fields_rows, invalid_numeric_rows
 FROM dimensions CROSS JOIN UNNEST(
 ARRAY['blockchain', 'asset', 'source_type'],
 ARRAY[blockchain, token_id, source_type]
 ) AS d(dimension, label)
), totals AS (
 SELECT dimension, label, min(day) AS first_observed_day, max(day) AS last_observed_day,
 count(DISTINCT day) AS observed_dates, sum(source_rows) AS source_rows,
 sum(extra_rows_at_candidate_grain) AS extra_rows_at_candidate_grain,
 sum(reported_priced_volume_usd) AS reported_priced_volume_usd,
 sum(priced_rows) AS priced_rows,
 sum(positive_tokens_unpriced_rows) AS positive_tokens_unpriced_rows,
 sum(zero_tokens_unpriced_rows) AS zero_tokens_unpriced_rows,
 sum(no_volume_fields_rows) AS no_volume_fields_rows,
 sum(invalid_numeric_rows) AS invalid_numeric_rows
 FROM expanded GROUP BY 1,2
), shares AS (
 SELECT *, sum(reported_priced_volume_usd) OVER (PARTITION BY dimension) AS dimension_reported_priced_volume_usd,
 reported_priced_volume_usd / nullif(sum(reported_priced_volume_usd) OVER (PARTITION BY dimension), 0) AS priced_share,
 sum(positive_tokens_unpriced_rows) OVER (PARTITION BY dimension) AS dimension_positive_tokens_unpriced_rows,
 sum(no_volume_fields_rows) OVER (PARTITION BY dimension) AS dimension_no_volume_fields_rows,
 sum(invalid_numeric_rows) OVER (PARTITION BY dimension) AS dimension_invalid_numeric_rows
 FROM totals
)
SELECT *, 100 * priced_share AS share_of_reported_priced_volume_pct,
 sum(priced_share * priced_share) OVER (PARTITION BY dimension) AS priced_subset_hhi_0_to_1,
 1 / nullif(sum(priced_share * priced_share) OVER (PARTITION BY dimension), 0) AS priced_subset_effective_labels,
 row_number() OVER (PARTITION BY dimension ORDER BY reported_priced_volume_usd DESC NULLS LAST, label) AS rank_in_dimension,
 priced_rows > 0 AS has_reported_usd, invalid_numeric_rows = 0 AS reported_values_valid,
 CASE WHEN priced_rows = 0 THEN 'No reported priced USD'
 WHEN invalid_numeric_rows > 0 THEN 'Invalid numeric rows; reported subset only'
 WHEN positive_tokens_unpriced_rows > 0 THEN 'Priced subset; positive token amounts lack USD'
 WHEN no_volume_fields_rows > 0 OR zero_tokens_unpriced_rows > 0 THEN 'Reported priced subset; sparse volume fields present'
 ELSE 'Reported priced subset; full notional coverage not established' END AS notional_coverage_status,
 'Concentration of reported priced provider labels; asset labels are token IDs, not beneficial owners; no origin-only or full-market claim' AS interpretation,
 current_timestamp AS retrieved_utc
FROM shares ORDER BY dimension, rank_in_dimension
