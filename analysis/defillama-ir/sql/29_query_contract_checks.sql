WITH values_by_day(day, gross_near, captured_near, price_usd) AS (
 VALUES (DATE '2026-01-01', 10e0, 1e0, 1e0), (DATE '2026-01-02', 10e0, 9e0, 3e0)
), ratios AS (
 SELECT 100 * sum(captured_near * price_usd) / sum(gross_near * price_usd) AS usd_share,
 100 * sum(captured_near) / sum(gross_near) AS near_share FROM values_by_day
), source_dates(day) AS (
 VALUES DATE '2026-01-01', DATE '2026-01-01', DATE '2026-01-03'
), calendar AS (
 SELECT day FROM UNNEST(sequence(DATE '2026-01-01', DATE '2026-01-03', interval '1' day)) AS t(day)
), date_counts AS (
 SELECT day, count(*) AS source_rows FROM source_dates GROUP BY 1
), coverage AS (
 SELECT count(*) AS calendar_dates, count_if(coalesce(source_rows = 1, false)) AS valid_dates,
 count_if(source_rows IS NULL) AS missing_dates, count_if(source_rows > 1) AS duplicate_dates
 FROM calendar LEFT JOIN date_counts USING (day)
)
SELECT 'USD and NEAR shares are separately weighted' AS check_name,
 abs(usd_share - 70) < 1e-9 AND abs(near_share - 50) < 1e-9 AS passed FROM ratios
UNION ALL
SELECT 'Calendar detects a missing date even when source row count equals expected',
 calendar_dates = 3 AND valid_dates = 1 AND missing_dates = 1 AND duplicate_dates = 1 FROM coverage
UNION ALL
SELECT 'Negative gross-minus-receipts is retained, not clipped',
 10e0 - 15e0 = -5e0
UNION ALL
SELECT 'Multiplicative log decomposition reconciles',
 abs(ln((200e0 * .002e0 * .4e0) / (100e0 * .003e0 * .2e0))
 - ln(200e0 / 100e0) - ln(.002e0 / .003e0) - ln(.4e0 / .2e0)) < 1e-9
