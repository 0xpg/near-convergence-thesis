WITH params AS (
 SELECT CAST('{{start_date}}' AS date) AS start_day,
 least(CAST('{{end_date}}' AS date), current_date - interval '1' day) AS end_day
), points AS (
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day,
 coalesce(nullif(lower(trim(CAST(source_type AS varchar))), ''), 'unknown') AS source_type,
 CAST(blockchain AS varchar) AS blockchain, CAST(symbol AS varchar) AS symbol,
 try_cast(volume_amount_usd AS double) AS volume_usd
 FROM dune.near.dataset_near_intents_metrics
), dimensions AS (
 SELECT day, source_type, blockchain, symbol, count(*) AS rows_at_candidate_grain,
 sum(volume_usd) AS volume_usd, count_if(volume_usd IS NULL OR volume_usd < 0) AS invalid_rows
 FROM points CROSS JOIN params WHERE day BETWEEN start_day AND end_day GROUP BY 1,2,3,4
), daily AS (
 SELECT day, source_type, sum(volume_usd) AS reported_volume_usd, sum(rows_at_candidate_grain) AS source_rows,
 sum(greatest(rows_at_candidate_grain - 1, 0)) AS extra_rows_at_candidate_grain, sum(invalid_rows) AS invalid_rows
 FROM dimensions GROUP BY 1,2
)
SELECT *, invalid_rows = 0 AS values_valid,
 'Provider aggregate notional; row grain and swap-leg convention require validation' AS volume_definition,
 current_timestamp AS retrieved_utc
FROM daily ORDER BY day, source_type
