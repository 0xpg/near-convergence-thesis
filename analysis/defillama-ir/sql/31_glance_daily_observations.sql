WITH intents AS (
 SELECT day, max(volume_usd) AS volume_usd, max(fees_usd) AS reported_fees_usd, max(swaps) AS swaps,
 count(*) AS source_rows, max(duplicate_metric_rows) AS duplicate_metric_rows
 FROM query_9077358 WHERE day < current_date GROUP BY day
), revenue AS (
 SELECT day, max(intents_fees_near) AS gross_near, max(intents_revenue_near) AS captured_near,
 max(total_revenue_near) AS total_revenue_near, max(emissions_near) AS emissions_near,
 count(*) AS source_rows, max(duplicate_metric_rows) AS duplicate_metric_rows
 FROM query_9077309 WHERE day < current_date GROUP BY day
), ecosystem AS (
 SELECT day, max(price_usd) AS price_usd, max(transactions) AS transactions,
 count(*) AS source_rows, max(duplicate_metric_rows) AS duplicate_metric_rows
 FROM query_9077345 WHERE day < current_date GROUP BY day
), bounds AS (
 SELECT least((SELECT max(day) FROM intents), (SELECT max(day) FROM revenue),
 (SELECT max(day) FROM ecosystem), current_date - interval '1' day) AS end_day,
 greatest((SELECT min(day) FROM intents), (SELECT min(day) FROM revenue), (SELECT min(day) FROM ecosystem)) AS first_day
), calendar AS (
 SELECT day FROM bounds CROSS JOIN UNNEST(sequence(greatest(first_day, date_add('day', -365, end_day)), end_day, interval '1' day)) AS t(day)
), days AS (
 SELECT c.day, i.volume_usd, i.reported_fees_usd, i.swaps, r.gross_near, r.captured_near,
 r.gross_near * e.price_usd AS gross_fees_usd, r.captured_near * e.price_usd AS retained_usd,
 r.total_revenue_near, r.emissions_near, e.price_usd, e.transactions,
 coalesce(i.source_rows = 1 AND r.source_rows = 1 AND e.source_rows = 1
 AND i.duplicate_metric_rows = 0 AND r.duplicate_metric_rows = 0 AND e.duplicate_metric_rows = 0
 AND i.volume_usd >= 0 AND i.reported_fees_usd >= 0 AND i.swaps >= 0
 AND r.gross_near >= 0 AND r.captured_near >= 0 AND r.total_revenue_near >= 0
 AND r.emissions_near >= 0 AND e.price_usd > 0 AND e.transactions >= 0, false) AS valid_day,
 coalesce(i.source_rows, 0) AS intents_source_rows, coalesce(r.source_rows, 0) AS revenue_source_rows,
 coalesce(e.source_rows, 0) AS ecosystem_source_rows,
 coalesce(i.duplicate_metric_rows, 0) + coalesce(r.duplicate_metric_rows, 0) + coalesce(e.duplicate_metric_rows, 0) AS duplicate_metric_rows
 FROM calendar c LEFT JOIN intents i ON i.day = c.day
 LEFT JOIN revenue r ON r.day = c.day LEFT JOIN ecosystem e ON e.day = c.day
)
SELECT *, current_timestamp AS retrieved_utc FROM days ORDER BY day
