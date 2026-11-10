WITH days AS (
 SELECT i.day, i.volume_usd, i.swaps, r.intents_fees_near * e.price_usd AS gross_fees_usd, r.intents_revenue_near * e.price_usd AS retained_usd
 FROM query_9077358 i
 JOIN query_9077309 r ON r.day = i.day
 JOIN query_9077345 e ON e.day = i.day
)
SELECT
 date_trunc('month', day) AS month,
 count(*) AS days_covered,
 count(*) < day_of_month(last_day_of_month(min(day))) AS partial_month,
 sum(volume_usd) AS volume_usd,
 sum(gross_fees_usd) AS gross_fees_usd,
 sum(retained_usd) AS retained_usd,
 sum(gross_fees_usd) - sum(retained_usd) AS paid_out_usd,
 100 * sum(retained_usd) / nullif(sum(gross_fees_usd), 0) AS retained_share_pct,
 1e4 * sum(gross_fees_usd) / nullif(sum(volume_usd), 0) AS gross_bps,
 1e4 * sum(retained_usd) / nullif(sum(volume_usd), 0) AS retained_bps,
 sum(volume_usd) / nullif(sum(swaps), 0) AS avg_swap_usd
FROM days
GROUP BY 1
ORDER BY 1
