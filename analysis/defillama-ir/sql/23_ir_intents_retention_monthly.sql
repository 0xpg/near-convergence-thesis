WITH days AS (
 SELECT day, volume_usd, gross_fees_usd, retained_usd, gross_near, captured_near, swaps,
 coalesce(intents_source_rows = 1 AND revenue_source_rows = 1 AND ecosystem_source_rows = 1
 AND duplicate_metric_rows = 0 AND volume_usd >= 0
 AND gross_fees_usd >= 0 AND retained_usd >= 0 AND gross_near >= 0 AND captured_near >= 0
 AND price_usd > 0, false) AS valid_financial_day,
 coalesce(intents_source_rows = 1 AND duplicate_metric_rows = 0
 AND swaps >= 0 AND swaps = floor(swaps), false) AS valid_count_day,
 duplicate_metric_rows
 FROM query_9114284 WHERE day < current_date
), monthly AS (
 SELECT date_trunc('month', day) AS month, min(day) AS first_observed_date, max(day) AS last_observed_date,
 count(*) AS calendar_dates, count_if(valid_financial_day) AS days_covered,
 count_if(NOT valid_financial_day) AS invalid_dates,
 date_diff('day', min(day), max(day)) + 1 - count(DISTINCT day) AS missing_calendar_dates,
 count(*) - count(DISTINCT day) AS duplicate_calendar_dates,
 count_if(valid_count_day) AS swap_dates_covered,
 bool_and(valid_count_day) AND count(*) = count(DISTINCT day)
 AND count(DISTINCT day) = date_diff('day', min(day), max(day)) + 1 AS swap_counts_complete,
 sum(duplicate_metric_rows) AS duplicate_metric_rows,
 bool_and(valid_financial_day) AND count(*) = count(DISTINCT day)
 AND count(DISTINCT day) = date_diff('day', min(day), max(day)) + 1 AS all_days_valid,
 sum(volume_usd) AS volume_usd, sum(swaps) AS swaps, sum(gross_fees_usd) AS gross_fees_usd,
 sum(retained_usd) AS retained_usd, sum(gross_near) AS gross_near, sum(captured_near) AS captured_near
 FROM days GROUP BY 1
)
SELECT month, first_observed_date, last_observed_date, days_covered, invalid_dates, duplicate_metric_rows,
 missing_calendar_dates, duplicate_calendar_dates, swap_dates_covered, swap_counts_complete,
 first_observed_date <> month OR last_observed_date <> last_day_of_month(month)
 OR NOT all_days_valid AS partial_month,
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
 CASE WHEN all_days_valid AND swap_counts_complete THEN volume_usd / nullif(swaps, 0) END AS avg_swap_usd,
 current_timestamp AS retrieved_utc
FROM monthly ORDER BY month
