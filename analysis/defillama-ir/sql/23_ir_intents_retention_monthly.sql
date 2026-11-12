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
 SELECT day FROM bounds CROSS JOIN UNNEST(sequence(first_day, end_day, interval '1' day)) AS t(day)
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
), monthly AS (
 SELECT date_trunc('month', day) AS month, min(day) AS first_observed_date, max(day) AS last_observed_date,
 count(*) AS calendar_dates, count_if(valid_day) AS days_covered, count_if(NOT valid_day) AS invalid_dates,
 sum(duplicate_metric_rows) AS duplicate_metric_rows, bool_and(valid_day) AS all_days_valid,
 sum(volume_usd) AS volume_usd, sum(swaps) AS swaps, sum(gross_fees_usd) AS gross_fees_usd,
 sum(retained_usd) AS retained_usd, sum(gross_near) AS gross_near, sum(captured_near) AS captured_near
 FROM days GROUP BY 1
)
SELECT month, first_observed_date, last_observed_date, days_covered, invalid_dates, duplicate_metric_rows,
 calendar_dates <> day_of_month(last_day_of_month(month)) OR NOT all_days_valid AS partial_month,
 all_days_valid AS data_complete,
 CASE WHEN all_days_valid THEN volume_usd END AS volume_usd,
 CASE WHEN all_days_valid THEN gross_fees_usd END AS gross_fees_usd,
 CASE WHEN all_days_valid THEN retained_usd END AS retained_usd,
 CASE WHEN all_days_valid THEN gross_fees_usd - retained_usd END AS gross_less_captured_usd,
 CASE WHEN all_days_valid THEN gross_fees_usd - retained_usd END AS paid_out_usd,
 CASE WHEN all_days_valid THEN 100 * retained_usd / nullif(gross_fees_usd, 0) END AS retained_share_pct,
 CASE WHEN all_days_valid THEN 100 * captured_near / nullif(gross_near, 0) END AS retained_share_near_pct,
 CASE WHEN all_days_valid THEN 1e4 * gross_fees_usd / nullif(volume_usd, 0) END AS gross_bps,
 CASE WHEN all_days_valid THEN 1e4 * retained_usd / nullif(volume_usd, 0) END AS retained_bps,
 CASE WHEN all_days_valid THEN volume_usd / nullif(swaps, 0) END AS avg_swap_usd,
 current_timestamp AS retrieved_utc
FROM monthly ORDER BY month
