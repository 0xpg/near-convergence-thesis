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
 SELECT day FROM bounds CROSS JOIN UNNEST(sequence(date_add('day', -59, end_day), end_day, interval '1' day)) AS t(day)
), days AS (
 SELECT c.day, i.volume_usd, i.reported_fees_usd, i.swaps, r.gross_near, r.captured_near,
 r.gross_near * e.price_usd AS gross_fees_usd, r.captured_near * e.price_usd AS retained_usd,
 r.total_revenue_near, r.emissions_near, e.transactions,
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
), periods AS (
 SELECT d.*, CASE WHEN day >= date_add('day', -29, b.end_day) THEN 'current' ELSE 'previous' END AS period
 FROM days d CROSS JOIN bounds b
), aggregated AS (
 SELECT period, min(day) AS window_start, max(day) AS window_end, count(*) AS calendar_dates,
 count_if(valid_day) AS days_covered, sum(volume_usd) AS volume_usd,
 sum(gross_fees_usd) AS gross_usd, sum(retained_usd) AS captured_usd
 FROM periods GROUP BY 1
), rates AS (
 SELECT *, calendar_dates = 30 AND days_covered = 30 AS data_complete,
 gross_usd / nullif(volume_usd, 0) AS gross_rate,
 captured_usd / nullif(gross_usd, 0) AS capture_rate
 FROM aggregated
), compared AS (
 SELECT c.window_start, c.window_end, p.window_start AS previous_start, p.window_end AS previous_end,
 c.data_complete AND p.data_complete AS comparable,
 c.volume_usd AS current_volume_usd, p.volume_usd AS previous_volume_usd,
 c.gross_usd AS current_gross_usd, p.gross_usd AS previous_gross_usd,
 c.captured_usd AS current_captured_usd, p.captured_usd AS previous_captured_usd,
 c.gross_rate AS current_gross_rate, p.gross_rate AS previous_gross_rate,
 c.capture_rate AS current_capture_rate, p.capture_rate AS previous_capture_rate
 FROM rates c CROSS JOIN rates p WHERE c.period = 'current' AND p.period = 'previous'
)
SELECT window_start, window_end, previous_start, previous_end, comparable,
 CASE WHEN comparable THEN 100 * (current_volume_usd / nullif(previous_volume_usd, 0) - 1) END AS volume_change_pct,
 CASE WHEN comparable THEN 100 * (current_captured_usd / nullif(previous_captured_usd, 0) - 1) END AS captured_change_pct,
 CASE WHEN comparable THEN 1e4 * (current_gross_rate - previous_gross_rate) END AS gross_rate_change_bps,
 CASE WHEN comparable THEN 100 * (current_capture_rate - previous_capture_rate) END AS capture_rate_change_pp,
 CASE WHEN comparable AND current_volume_usd > 0 AND previous_volume_usd > 0 THEN ln(current_volume_usd / previous_volume_usd) END AS log_volume_contribution,
 CASE WHEN comparable AND current_gross_rate > 0 AND previous_gross_rate > 0 THEN ln(current_gross_rate / previous_gross_rate) END AS log_gross_rate_contribution,
 CASE WHEN comparable AND current_capture_rate > 0 AND previous_capture_rate > 0 THEN ln(current_capture_rate / previous_capture_rate) END AS log_capture_contribution,
 CASE WHEN comparable AND current_captured_usd > 0 AND previous_captured_usd > 0 THEN ln(current_captured_usd / previous_captured_usd) END AS log_captured_change,
 'Exact log accounting identity when all factors positive; descriptive, not causal; receipt sweeps can shift periods' AS interpretation,
 current_timestamp AS retrieved_utc
FROM compared
