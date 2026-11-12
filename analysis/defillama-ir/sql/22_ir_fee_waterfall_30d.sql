WITH intents AS (
 SELECT day, max(volume_usd) AS volume_usd,
 count(*) AS source_rows, max(duplicate_metric_rows) AS duplicate_metric_rows
 FROM query_9077358 WHERE day < current_date GROUP BY day
), revenue AS (
 SELECT day, max(intents_fees_near) AS gross_near, max(intents_revenue_near) AS captured_near,
 count(*) AS source_rows, max(duplicate_metric_rows) AS duplicate_metric_rows
 FROM query_9077309 WHERE day < current_date GROUP BY day
), ecosystem AS (
 SELECT day, max(price_usd) AS price_usd,
 count(*) AS source_rows, max(duplicate_metric_rows) AS duplicate_metric_rows
 FROM query_9077345 WHERE day < current_date GROUP BY day
), bounds AS (
 SELECT least((SELECT max(day) FROM intents), (SELECT max(day) FROM revenue),
 (SELECT max(day) FROM ecosystem), current_date - interval '1' day) AS end_day,
 greatest((SELECT min(day) FROM intents), (SELECT min(day) FROM revenue), (SELECT min(day) FROM ecosystem)) AS first_day
), calendar AS (
 SELECT day FROM bounds CROSS JOIN UNNEST(sequence(date_add('day', -29, end_day), end_day, interval '1' day)) AS t(day)
), days AS (
 SELECT c.day, i.volume_usd, r.gross_near, r.captured_near,
 r.gross_near * e.price_usd AS gross_fees_usd, r.captured_near * e.price_usd AS retained_usd,
 coalesce(i.source_rows = 1 AND r.source_rows = 1 AND e.source_rows = 1
 AND i.duplicate_metric_rows = 0 AND r.duplicate_metric_rows = 0 AND e.duplicate_metric_rows = 0
 AND i.volume_usd >= 0 AND r.gross_near >= 0 AND r.captured_near >= 0
 AND e.price_usd > 0, false) AS valid_day,
 coalesce(i.source_rows, 0) AS intents_source_rows, coalesce(r.source_rows, 0) AS revenue_source_rows,
 coalesce(e.source_rows, 0) AS ecosystem_source_rows,
 coalesce(i.duplicate_metric_rows, 0) + coalesce(r.duplicate_metric_rows, 0) + coalesce(e.duplicate_metric_rows, 0) AS duplicate_metric_rows
 FROM calendar c LEFT JOIN intents i ON i.day = c.day
 LEFT JOIN revenue r ON r.day = c.day LEFT JOIN ecosystem e ON e.day = c.day
),
totals AS (
 SELECT min(day) AS window_start, max(day) AS window_end, count(*) AS calendar_dates,
 count_if(valid_day) AS days_covered, count_if(NOT valid_day) AS invalid_dates,
 count_if(intents_source_rows <> 1 OR revenue_source_rows <> 1 OR ecosystem_source_rows <> 1) AS missing_or_duplicate_dates,
 sum(duplicate_metric_rows) AS duplicate_metric_rows,
 sum(volume_usd) AS volume_usd, sum(gross_fees_usd) AS gross_fees_usd,
 sum(retained_usd) AS retained_usd, sum(gross_near) AS gross_near, sum(captured_near) AS captured_near
 FROM days
), quality AS (
 SELECT *, calendar_dates = 30 AND days_covered = 30 AS data_complete FROM totals
), scorecard AS (
 SELECT window_start, window_end, days_covered, 30 AS days_expected, data_complete,
 invalid_dates, missing_or_duplicate_dates, duplicate_metric_rows,
 CASE WHEN data_complete THEN volume_usd END AS volume_usd,
 CASE WHEN data_complete THEN gross_fees_usd END AS gross_fees_usd,
 CASE WHEN data_complete THEN retained_usd END AS retained_usd,
 CASE WHEN data_complete THEN gross_fees_usd - retained_usd END AS gross_less_captured_usd,
 CASE WHEN data_complete THEN gross_fees_usd - retained_usd END AS paid_out_usd,
 CASE WHEN data_complete THEN 100 * retained_usd / nullif(gross_fees_usd, 0) END AS retained_share_pct,
 CASE WHEN data_complete THEN 100 * captured_near / nullif(gross_near, 0) END AS retained_share_near_pct,
 CASE WHEN data_complete THEN 1e4 * gross_fees_usd / nullif(volume_usd, 0) END AS gross_bps,
 CASE WHEN data_complete THEN 1e4 * retained_usd / nullif(volume_usd, 0) END AS retained_bps,
 CASE WHEN data_complete THEN 1e6 * retained_usd / nullif(volume_usd, 0) END AS retained_per_1m_usd,
 date_diff('day', window_end, current_date - interval '1' day) AS freshness_lag_days,
 'Gross accrual less captured cash receipts; not a verified partner-payment ledger' AS residual_definition,
 current_timestamp AS retrieved_utc
 FROM quality
)
SELECT t.step, t.sort_order, 1e6 * t.amount_usd / nullif(s.volume_usd, 0) AS usd_per_1m,
 t.amount_usd AS usd_total, s.window_start, s.window_end, s.data_complete, s.days_covered,
 s.invalid_dates, s.freshness_lag_days, s.residual_definition
FROM scorecard s
CROSS JOIN UNNEST(
 ARRAY['Gross fees', 'Gross less captured receipts', 'Captured receipts'], ARRAY[1, 2, 3],
 ARRAY[s.gross_fees_usd, -s.gross_less_captured_usd, s.retained_usd]
) AS t(step, sort_order, amount_usd)
ORDER BY t.sort_order
