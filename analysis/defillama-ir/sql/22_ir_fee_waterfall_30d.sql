WITH joined AS (
 SELECT i.day, i.volume_usd, i.fees_usd, i.swaps, r.intents_fees_near, r.intents_revenue_near, r.total_revenue_near, r.emissions_near, e.price_usd, e.transactions,
 max(i.day) OVER () AS end_day
 FROM query_9077358 i
 JOIN query_9077309 r ON r.day = i.day
 JOIN query_9077345 e ON e.day = i.day
), scorecard AS (
 SELECT
 min(day) AS window_start,
 max(day) AS window_end,
 count(*) AS days_covered,
 sum(volume_usd) AS volume_usd,
 sum(swaps) AS swaps,
 sum(volume_usd) / nullif(sum(swaps), 0) AS avg_swap_usd,
 sum(intents_fees_near * price_usd) AS gross_fees_usd,
 sum(intents_revenue_near * price_usd) AS retained_usd,
 sum(intents_fees_near * price_usd) - sum(intents_revenue_near * price_usd) AS paid_out_usd,
 100 * sum(intents_revenue_near) / nullif(sum(intents_fees_near), 0) AS retained_share_pct,
 1e4 * sum(intents_fees_near * price_usd) / nullif(sum(volume_usd), 0) AS gross_bps,
 1e4 * sum(intents_revenue_near * price_usd) / nullif(sum(volume_usd), 0) AS retained_bps,
 1e6 * sum(intents_revenue_near * price_usd) / nullif(sum(volume_usd), 0) AS retained_per_1m_usd,
 100 * sum(total_revenue_near) / nullif(sum(emissions_near), 0) AS revenue_pct_issuance,
 avg(transactions) AS avg_daily_transactions,
 sum(fees_usd) AS reported_fees_usd_ecosystem_feed,
 current_timestamp AS retrieved_utc
 FROM joined
 WHERE day BETWEEN date_add('day', -29, end_day) AND end_day
)
SELECT t.step, t.sort_order, 1e6 * t.amount_usd / s.volume_usd AS usd_per_1m, t.amount_usd AS usd_total, s.window_start, s.window_end
FROM scorecard s
CROSS JOIN UNNEST(
 ARRAY['Gross fees', 'Paid out', 'Retained by protocol'],
 ARRAY[1, 2, 3],
 ARRAY[s.gross_fees_usd, -s.paid_out_usd, s.retained_usd]
) AS t(step, sort_order, amount_usd)
ORDER BY t.sort_order
