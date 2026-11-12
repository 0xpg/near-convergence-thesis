WITH volume_daily AS (
 SELECT day,sum(reported_volume_usd) AS reported_volume_usd,
 sum(positive_tokens_unpriced_rows) AS positive_unpriced_volume_rows,
 sum(invalid_numeric_rows) AS invalid_volume_rows
 FROM query_9115683 GROUP BY 1
), fees_daily AS (
 SELECT day,sum(reported_priced_fees_usd) AS reported_gross_fees_usd,
 sum(missing_fee_rows) AS missing_fee_rows,sum(invalid_numeric_rows) AS invalid_fee_rows
 FROM query_9117854 GROUP BY 1
), cutoff AS (
 SELECT least((SELECT max(day) FROM volume_daily),(SELECT max(day) FROM fees_daily),current_date-INTERVAL '1' DAY) AS day
), calendar AS (
 SELECT t.day FROM cutoff CROSS JOIN UNNEST(sequence(cutoff.day-INTERVAL '89' DAY,cutoff.day,INTERVAL '1' DAY)) AS t(day)
), daily AS (
 SELECT c.day,v.reported_volume_usd,f.reported_gross_fees_usd,
 v.positive_unpriced_volume_rows,v.invalid_volume_rows,f.missing_fee_rows,f.invalid_fee_rows,
 CASE WHEN v.reported_volume_usd>0 AND f.reported_gross_fees_usd IS NOT NULL
 AND v.invalid_volume_rows=0 AND f.invalid_fee_rows=0
 THEN f.reported_gross_fees_usd/v.reported_volume_usd*1000000 END AS reported_fees_per_million_usd
 FROM calendar c LEFT JOIN volume_daily v ON c.day=v.day LEFT JOIN fees_daily f ON c.day=f.day
)
SELECT *,
 CASE WHEN count(reported_fees_per_million_usd) OVER w=30
 THEN sum(reported_gross_fees_usd) OVER w/nullif(sum(reported_volume_usd) OVER w,0)*1000000 END AS trailing_30d_fees_per_million_usd,
 count(reported_fees_per_million_usd) OVER w AS matched_days_in_30d,
 sum(missing_fee_rows) OVER w AS missing_fee_rows_in_30d,
 sum(positive_unpriced_volume_rows) OVER w AS unpriced_volume_rows_in_30d,
 date_diff('day',day,current_date) AS days_since_observation,
 'Reported protocol plus affiliate fee components / reported priced dataset notional. Not wash-filtered, not solver spread, not holder receipts; missing fee rows remain unknown. Both account-side notional convention and component disjointness follow provider.' AS definition,
 current_timestamp AS retrieved_utc
FROM daily
WINDOW w AS (ORDER BY day ROWS BETWEEN 29 PRECEDING AND CURRENT ROW)
ORDER BY day
