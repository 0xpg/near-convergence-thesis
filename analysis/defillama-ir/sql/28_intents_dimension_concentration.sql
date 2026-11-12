WITH params AS (
 SELECT CAST('{{start_date}}' AS date) AS start_day,
 least(CAST('{{end_date}}' AS date), current_date - interval '1' day) AS end_day
), points AS (
 SELECT try_cast(substr(CAST(date_at AS varchar), 1, 10) AS date) AS day,
 CAST(blockchain AS varchar) AS blockchain, CAST(symbol AS varchar) AS symbol,
 coalesce(CAST(source_type AS varchar), 'unknown') AS source_type,
 try_cast(volume_amount_usd AS double) AS volume_usd
 FROM dune.near.dataset_near_intents_metrics
), expanded AS (
 SELECT day, d.dimension, coalesce(nullif(d.label, ''), 'unknown') AS label, volume_usd
 FROM points CROSS JOIN UNNEST(ARRAY['blockchain', 'asset', 'source_type'], ARRAY[blockchain, symbol, source_type]) AS d(dimension, label)
), totals AS (
 SELECT dimension, label, min(day) AS first_observed_day, max(day) AS last_observed_day,
 count(DISTINCT day) AS observed_dates, sum(volume_usd) AS volume_usd,
 count_if(volume_usd IS NULL OR volume_usd < 0) AS invalid_rows
 FROM expanded CROSS JOIN params WHERE day BETWEEN start_day AND end_day GROUP BY 1,2
), shares AS (
 SELECT *, volume_usd / nullif(sum(volume_usd) OVER (PARTITION BY dimension), 0) AS share
 FROM totals
)
SELECT *, 100 * share AS share_pct, sum(share * share) OVER (PARTITION BY dimension) AS hhi_0_to_1,
 1 / nullif(sum(share * share) OVER (PARTITION BY dimension), 0) AS effective_labels,
 row_number() OVER (PARTITION BY dimension ORDER BY volume_usd DESC, label) AS rank_in_dimension,
 'Concentration of provider labels; not independent users, solver entities or origin-only order flow' AS interpretation,
 current_timestamp AS retrieved_utc
FROM shares ORDER BY dimension, rank_in_dimension
